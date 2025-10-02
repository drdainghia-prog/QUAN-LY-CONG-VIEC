import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    doc, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    setDoc,
    query,
    orderBy,
    writeBatch
} from 'firebase/firestore';


// --- FIREBASE CONFIGURATION ---
// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqQ6D_wmrYmSZd-4ebBG_R45a1cAAlptg",
  authDomain: "lich-lam-b88aa.firebaseapp.com",
  projectId: "lich-lam-b88aa",
  storageBucket: "lich-lam-b88aa.firebasestorage.app",
  messagingSenderId: "935319627159",
  appId: "1:935319627159:web:5335467b97304c1b5110d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// --- INTERFACES ---
interface Employee {
  id: string;
  name: string;
  color: string;
  annualLeave: number;
  compLeave: number;
  preferredLocations?: string[];
}

interface Location {
  id: string;
  name: string;
  order: number;
}

interface Schedule {
  [locationId: string]: {
    [dayIndex: number]: {
      am?: string; // employeeId
      pm?: string; // employeeId
    };
  };
}

// --- UTILITY FUNCTIONS ---
const getWeekStartDate = (date: Date) => {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(startDate.setDate(diff));
};

const getWeekId = (date: Date) => {
    const startDate = getWeekStartDate(date);
    const year = startDate.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (startDate.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};


// --- SVG ICONS ---
const ArrowUp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/></svg>;
const ArrowDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>;
const Trash = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>;
const Plus = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>;
const ChevronLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>;
const ChevronRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>;
const Gear = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.837 1.626c-.246-.835-1.428-.835-1.674 0l-.094.319A1.873 1.873 0 0 1 4.377 3.07l-.292-.16c-.764-.415-1.6.42-1.184 1.185l.159.291A1.873 1.873 0 0 1 3.07 4.377l-.319.094c-.835.246-.835 1.428 0 1.674l.319.094a1.873 1.873 0 0 1 .498 1.55l-.16.292c-.415.764.42 1.6 1.185 1.184l.292-.159a1.873 1.873 0 0 1 1.55.498l.094.319c.246.835 1.428.835 1.674 0l.094-.319a1.873 1.873 0 0 1 1.55-.498l.292.159c.764.415 1.6-.42 1.184-1.184l-.159-.291a1.873 1.873 0 0 1 .498-1.55l.319-.094c.835-.246.835-1.428 0-1.674l-.319-.094a1.873 1.873 0 0 1-.498-1.55l.16-.292c.415-.764-.42-1.6-1.185-1.184l-.291.159A1.873 1.873 0 0 1 8.93 1.945l-.094-.319zm-2.633-.283c.527-1.79 3.065-1.79 3.592 0l.094.319a.873.873 0 0 0 1.255.52l.292-.16c1.64-.892 3.434.902 2.54 2.541l-.159.292a.873.873 0 0 0 .52 1.255l.319.094c1.79.527 1.79 3.065 0 3.592l-.319.094a.873.873 0 0 0-.52 1.255l.16.292c.892 1.64-.902 3.434-2.541 2.54l-.292-.159a.873.873 0 0 0-1.255.52l-.094.319c-.527 1.79-3.065 1.79-3.592 0l-.094-.319a.873.873 0 0 0-1.255-.52l-.292.16c-1.64.893-3.434-.902-2.54-2.541l.159-.292a.873.873 0 0 0-.52-1.255l-.319-.094c-1.79-.527-1.79-3.065 0-3.592l.319-.094a.873.873 0 0 0 .52-1.255l-.16-.292c-.893-1.64.902-3.434 2.541-2.54l.292.159a.873.873 0 0 0 1.255-.52l.094-.319zM8 5.754a2.246 2.246 0 1 0 0 4.492 2.246 2.246 0 0 0 0-4.492zM4.754 8a3.246 3.246 0 1 1 6.492 0 3.246 3.246 0 0 1-6.492 0z"/></svg>;


// --- MAIN APP COMPONENT ---
const App = () => {
  // --- STATE MANAGEMENT ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [draggedLocationId, setDraggedLocationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'location' | 'employee'>('location');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeColor, setNewEmployeeColor] = useState('#50e3c2');
  const [newLocationName, setNewLocationName] = useState('');
  const [popupInfo, setPopupInfo] = useState<{ x: number; y: number; locationId: string; dayIndex: number; time: 'am' | 'pm';} | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<{ id: string; name: string } | null>(null);
  const [editingLocation, setEditingLocation] = useState<{ id: string; name: string } | null>(null);
  const [preferenceModalEmployee, setPreferenceModalEmployee] = useState<Employee | null>(null);

  
  const FIXED_LOCATIONS = {
      COMP_LEAVE: { id: 'comp_leave', name: 'Nghỉ bù' },
      ANNUAL_LEAVE: { id: 'annual_leave', name: 'Nghỉ phép' },
  };

  // --- DATA FETCHING & SYNC ---
  useEffect(() => {
    setLoading(true);
    
    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const employeeQuery = query(collection(db, 'employees'));
    const unsubEmployees = onSnapshot(employeeQuery, async (querySnapshot) => {
      if (querySnapshot.empty) {
        const defaultEmployees = [
            'Nghĩa', 'Phúc', 'Minh', 'Huy', 'Duy', 'Nhật', 'Nguyên', 'Thi', 
            'Thanh', 'Khoa', 'Trang', 'Hưng', 'THuy'
        ];
        const batch = writeBatch(db);
        const employeesCollection = collection(db, 'employees');
        defaultEmployees.forEach(name => {
            const newEmpRef = doc(employeesCollection);
            batch.set(newEmpRef, {
                name: name,
                color: getRandomColor(),
                annualLeave: 12,
                compLeave: 0,
                preferredLocations: [],
            });
        });
        await batch.commit();
      } else {
          const employeesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
          employeesData.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
          setEmployees(employeesData);
      }
    });

    const locationQuery = query(collection(db, 'locations'), orderBy('order'));
    const unsubLocations = onSnapshot(locationQuery, async (querySnapshot) => {
      if (querySnapshot.empty) {
        const defaultLocations = [
            'NHŨ ẢNH', 'XQ 7-11H30', 'XQ 12H30-15H', 'XQ 15-16H30', 'XQ2', 'CR', 'MRI', 'SA1', 'FNA',
            'SA2', 'SA3', 'SA DV1', 'SA DV2', 'SA DV3', 'SA DV5', 'SA TIMTG', 'SA TQTG', 'LÀM SỐ LIỆU',
            'PK THẢO ĐIỀN', 'TRỰC SA', 'TRỰC CT', 'TRỰC TRƯA SA', 'TRỰC TRƯA CT', 'ĐI HỌC'
        ];
        const batch = writeBatch(db);
        const locationsCollection = collection(db, 'locations');
        defaultLocations.forEach((name, index) => {
            const newLocRef = doc(locationsCollection);
            batch.set(newLocRef, { name: name, order: index });
        });
        await batch.commit();
        // The listener will be re-triggered with the new data, so we don't need to set state here.
      } else {
        const locationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
        setLocations(locationsData);
      }
      setLoading(false); 
    });

    return () => {
      unsubEmployees();
      unsubLocations();
    };
  }, []);

  const weekId = useMemo(() => getWeekId(currentDate), [currentDate]);

  useEffect(() => {
    if (!weekId) return;
    const scheduleDocRef = doc(db, 'schedules', weekId);
    const unsubSchedule = onSnapshot(scheduleDocRef, (doc) => {
      if (doc.exists()) {
        setSchedule(doc.data() as Schedule);
      } else {
        setSchedule({});
      }
    });
    return () => unsubSchedule();
  }, [weekId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (popupInfo && !target.closest('.employee-selector-popup')) {
            setPopupInfo(null);
        }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [popupInfo]);

  // --- COMPUTED VALUES ---
  const weekDays = useMemo(() => {
    const start = getWeekStartDate(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const allLocations = useMemo(() => [
    ...locations, 
    FIXED_LOCATIONS.COMP_LEAVE, 
    FIXED_LOCATIONS.ANNUAL_LEAVE
  ], [locations]);

  // --- FIRESTORE HELPERS ---
  const updateScheduleInFirestore = async (newSchedule: Schedule) => {
      const weekDocRef = doc(db, 'schedules', weekId);
      await setDoc(weekDocRef, newSchedule);
  };

  // --- HANDLERS ---
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmployeeName.trim()) {
      await addDoc(collection(db, 'employees'), {
        name: newEmployeeName.trim(),
        color: newEmployeeColor,
        annualLeave: 12,
        compLeave: 0,
        preferredLocations: [],
      });
      setNewEmployeeName('');
      setNewEmployeeColor('#50e3c2');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    await deleteDoc(doc(db, 'employees', id));
    clearEmployee(id);
  };
  
  const handleEmployeeColorChange = async (id: string, newColor: string) => {
    await updateDoc(doc(db, 'employees', id), { color: newColor });
  };
  
  const handleSaveEmployeeName = async () => {
      if (editingEmployee && editingEmployee.name.trim()) {
          await updateDoc(doc(db, 'employees', editingEmployee.id), { name: editingEmployee.name.trim() });
      }
      setEditingEmployee(null);
  };

  const handleSavePreferences = async (employeeId: string, preferredLocationIds: string[]) => {
      await updateDoc(doc(db, 'employees', employeeId), { preferredLocations: preferredLocationIds });
      setPreferenceModalEmployee(null);
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocationName.trim()) {
      await addDoc(collection(db, 'locations'), {
        name: newLocationName.trim(),
        order: locations.length,
      });
      setNewLocationName('');
    }
  };

  const handleDeleteLocation = async (id: string) => {
    await deleteDoc(doc(db, 'locations', id));
    clearLocation(id);
  };
  
  const handleSaveLocationName = async () => {
      if (editingLocation && editingLocation.name.trim()) {
          await updateDoc(doc(db, 'locations', editingLocation.id), { name: editingLocation.name.trim() });
      }
      setEditingLocation(null);
  };
  
  const handleLeaveChange = async (employeeId: string, field: 'annualLeave' | 'compLeave', value: string) => {
      const numericValue = value === '' ? 0 : parseInt(value, 10);
      if (!isNaN(numericValue) && numericValue >= 0) {
          await updateDoc(doc(db, 'employees', employeeId), { [field]: numericValue });
      }
  };


  const moveLocation = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === locations.length - 1)
    ) {
      return;
    }
    const newLocations = [...locations];
    const [movedItem] = newLocations.splice(index, 1);
    newLocations.splice(index + (direction === 'up' ? -1 : 1), 0, movedItem);

    const batch = writeBatch(db);
    newLocations.forEach((loc, idx) => {
        const docRef = doc(db, 'locations', loc.id);
        batch.update(docRef, { order: idx });
    });
    await batch.commit();
  };
  
  const handleWeekChange = (direction: 'prev' | 'next') => {
      const newDate = addDays(currentDate, direction === 'prev' ? -7 : 7);
      setCurrentDate(newDate);
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, employeeId: string) => {
    setDraggedEmployeeId(employeeId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLocationDragStart = (e: React.DragEvent<HTMLDivElement>, locationId: string) => {
    setDraggedLocationId(locationId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('drop-over');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('drop-over');
  };

  const handleAssignEmployee = (employeeId: string, locationId: string, dayIndex: number, time: 'am' | 'pm') => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));

    // Remove employee from any other location AT THE SAME TIME SLOT on the same day.
    Object.keys(newSchedule).forEach(locId => {
        if (newSchedule[locId]?.[dayIndex]) {
            if (time === 'am' && newSchedule[locId][dayIndex].am === employeeId) {
                delete newSchedule[locId][dayIndex].am;
            }
            if (time === 'pm' && newSchedule[locId][dayIndex].pm === employeeId) {
                delete newSchedule[locId][dayIndex].pm;
            }
        }
    });
    
    // Add new entry
    if (!newSchedule[locationId]) newSchedule[locationId] = {};
    if (!newSchedule[locationId][dayIndex]) newSchedule[locationId][dayIndex] = {};
    newSchedule[locationId][dayIndex][time] = employeeId;
    
    updateScheduleInFirestore(newSchedule);
    setPopupInfo(null); // Close popup
  };


  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, data: { locationId: string | null; employeeId: string | null; dayIndex: number; time: 'am' | 'pm'; }) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-over');
    
    const { locationId, employeeId, dayIndex, time } = data;
    if (!locationId || !employeeId) return;

    handleAssignEmployee(employeeId, locationId, dayIndex, time);
  };
  
  const clearCell = (locationId: string, dayIndex: number, time: 'am' | 'pm') => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    if(newSchedule[locationId]?.[dayIndex]?.[time]) {
        delete newSchedule[locationId][dayIndex][time];
    }
    updateScheduleInFirestore(newSchedule);
  }

  const handleCellRightClick = (e: React.MouseEvent<HTMLTableCellElement>, locationId: string, dayIndex: number, time: 'am' | 'pm') => {
      e.preventDefault();
      clearCell(locationId, dayIndex, time);
  }
  
  const handleCellClick = (e: React.MouseEvent<HTMLTableCellElement>, locationId: string, dayIndex: number, time: 'am' | 'pm') => {
      if (e.button !== 0) return; // Ignore right-clicks
      e.preventDefault();
      setPopupInfo({
          x: e.pageX,
          y: e.pageY,
          locationId,
          dayIndex,
          time,
      });
  };

  const handleEmployeeViewCellRightClick = (e: React.MouseEvent<HTMLTableCellElement>, employeeId: string, dayIndex: number, time: 'am' | 'pm') => {
    e.preventDefault();
    let locationId: string | null = null;
    for (const locId in schedule) {
        if (schedule[locId]?.[dayIndex]?.[time] === employeeId) {
            locationId = locId;
            break;
        }
    }

    if (locationId) {
       clearCell(locationId, dayIndex, time);
    }
  };

  const clearDay = (dayIndex: number) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    Object.keys(newSchedule).forEach(locId => {
        if (newSchedule[locId][dayIndex]) {
            delete newSchedule[locId][dayIndex];
        }
    });
    updateScheduleInFirestore(newSchedule);
  };

  const clearLocation = (locationId: string) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    delete newSchedule[locationId];
    updateScheduleInFirestore(newSchedule);
  };

  const clearEmployee = (employeeId: string) => {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    Object.keys(newSchedule).forEach(locId => {
        Object.keys(newSchedule[locId]).forEach(dayIdx => {
            const dayIndex = parseInt(dayIdx, 10);
            if (newSchedule[locId][dayIndex]?.am === employeeId) delete newSchedule[locId][dayIndex].am;
            if (newSchedule[locId][dayIndex]?.pm === employeeId) delete newSchedule[locId][dayIndex].pm;
        });
    });
    updateScheduleInFirestore(newSchedule);
  };
  
  const clearWeek = () => {
      updateScheduleInFirestore({});
  }

  const handleQuickSchedule = async () => {
    if (!window.confirm("Thao tác này sẽ ghi đè lên lịch làm việc hiện tại của tuần này. Bạn có chắc chắn muốn tiếp tục?")) {
        return;
    }

    const newSchedule: Schedule = {};
    const workLocations = locations.slice(); // Copy of locations to schedule

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const time of ['am', 'pm'] as const) {
            let availableEmployees = [...employees];
            shuffleArray(availableEmployees); // Randomize for fairness
            let unassignedLocations = [...workLocations];

            // Pass 1: Assign based on preferences
            const assignedEmployeesThisSlot = new Set<string>();

            for (const employee of availableEmployees) {
                if (!employee.preferredLocations || employee.preferredLocations.length === 0) continue;
                
                for (const preferredLocId of employee.preferredLocations) {
                    const locationIndex = unassignedLocations.findIndex(l => l.id === preferredLocId);
                    if (locationIndex !== -1) {
                         // Assign
                        if (!newSchedule[preferredLocId]) newSchedule[preferredLocId] = {};
                        if (!newSchedule[preferredLocId][dayIndex]) newSchedule[preferredLocId][dayIndex] = {};
                        newSchedule[preferredLocId][dayIndex][time] = employee.id;
                        
                        // Mark as assigned
                        assignedEmployeesThisSlot.add(employee.id);
                        unassignedLocations.splice(locationIndex, 1);
                        break; // Employee assigned, move to next employee
                    }
                }
            }

            // Pass 2: Fill remaining slots
            let remainingEmployees = availableEmployees.filter(e => !assignedEmployeesThisSlot.has(e.id));
            for (const location of unassignedLocations) {
                if (remainingEmployees.length > 0) {
                    const employeeToAssign = remainingEmployees.shift()!;
                     if (!newSchedule[location.id]) newSchedule[location.id] = {};
                     if (!newSchedule[location.id][dayIndex]) newSchedule[location.id][dayIndex] = {};
                     newSchedule[location.id][dayIndex][time] = employeeToAssign.id;
                }
            }
        }
    }
    
    await updateScheduleInFirestore(newSchedule);
  };

  // --- RENDER ---
  if (loading) {
      return <div className="loading-container"><h1>Loading...</h1></div>;
  }
  
  return (
    <>
      <h1>QUAN LY CONG VIEC</h1>
      <div className="app-container">
        <div className="management-panel">
          <div className="card">
            <h3>Nhân viên</h3>
            <ul className="employee-list">
              {employees.map(emp => (
                <li key={emp.id} className="employee-item">
                    <div className="employee-name-wrapper">
                      {editingEmployee?.id === emp.id ? (
                            <input
                                type="text"
                                value={editingEmployee.name}
                                onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                onBlur={handleSaveEmployeeName}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEmployeeName();
                                    }
                                    if (e.key === 'Escape') setEditingEmployee(null);
                                }}
                                className="rename-input"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                            />
                        ) : (
                            <div
                                className="employee-tag"
                                style={{ backgroundColor: emp.color }}
                                draggable={viewMode === 'location'}
                                onDragStart={(e) => handleDragStart(e, emp.id)}
                                onDoubleClick={() => setEditingEmployee({ id: emp.id, name: emp.name })}
                                title="Double-click to rename"
                            >
                                {emp.name}
                            </div>
                        )}
                    </div>
                   <div className="employee-actions">
                        <div className="leave-input-group">
                            <label htmlFor={`annual-${emp.id}`} title="Nghỉ phép">NP</label>
                            <input
                                id={`annual-${emp.id}`}
                                type="number"
                                className="leave-input"
                                value={emp.annualLeave}
                                onChange={(e) => handleLeaveChange(emp.id, 'annualLeave', e.target.value)}
                                aria-label={`Số ngày nghỉ phép của ${emp.name}`}
                            />
                        </div>
                        <div className="leave-input-group">
                            <label htmlFor={`comp-${emp.id}`} title="Nghỉ bù">NB</label>
                            <input
                                id={`comp-${emp.id}`}
                                type="number"
                                className="leave-input"
                                value={emp.compLeave}
                                onChange={(e) => handleLeaveChange(emp.id, 'compLeave', e.target.value)}
                                aria-label={`Số ngày nghỉ bù của ${emp.name}`}
                            />
                        </div>
                        <input
                            type="color"
                            className="employee-color-picker"
                            value={emp.color}
                            onChange={(e) => handleEmployeeColorChange(emp.id, e.target.value)}
                            title={`Thay đổi màu cho ${emp.name}`}
                            aria-label={`Thay đổi màu cho ${emp.name}`}
                        />
                         <button className="icon-btn preferences-btn" onClick={() => setPreferenceModalEmployee(emp)} title="Tùy chọn vị trí"><Gear/></button>
                        <button className="icon-btn delete-btn" onClick={() => handleDeleteEmployee(emp.id)} aria-label={`Xóa ${emp.name}`}><Trash /></button>
                   </div>
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddEmployee} className="input-group">
                <input type="text" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} placeholder="Tên nhân viên mới"/>
                <input type="color" value={newEmployeeColor} onChange={e => setNewEmployeeColor(e.target.value)} />
                <button type="submit" className="btn" aria-label="Thêm nhân viên"><Plus/></button>
            </form>
          </div>

          <div className="card">
            <h3>Vị trí làm việc</h3>
            <ul className="location-list">
              {locations.map((loc, index) => (
                <li key={loc.id} className="location-item">
                  {editingLocation?.id === loc.id ? (
                        <input
                            type="text"
                            value={editingLocation.name}
                            onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                            onBlur={handleSaveLocationName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveLocationName();
                                }
                                if (e.key === 'Escape') setEditingLocation(null);
                            }}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            className="rename-input"
                        />
                    ) : (
                        <div
                            className="location-tag"
                            draggable={viewMode === 'employee'}
                            onDragStart={(e) => handleLocationDragStart(e, loc.id)}
                            onDoubleClick={() => setEditingLocation({ id: loc.id, name: loc.name })}
                            title="Double-click to rename"
                        >
                            {loc.name}
                        </div>
                    )}
                  <div className="location-controls">
                     <button className="icon-btn" onClick={() => moveLocation(index, 'up')} disabled={index === 0} aria-label={`Di chuyển ${loc.name} lên`}><ArrowUp/></button>
                     <button className="icon-btn" onClick={() => moveLocation(index, 'down')} disabled={index === locations.length -1} aria-label={`Di chuyển ${loc.name} xuống`}><ArrowDown/></button>
                     <button className="icon-btn delete-btn" onClick={() => handleDeleteLocation(loc.id)} aria-label={`Xóa ${loc.name}`}><Trash/></button>
                  </div>
                </li>
              ))}
            </ul>
             <form onSubmit={handleAddLocation} className="input-group">
                <input type="text" value={newLocationName} onChange={e => setNewLocationName(e.target.value)} placeholder="Tên vị trí mới"/>
                <button type="submit" className="btn" aria-label="Thêm vị trí"><Plus/></button>
            </form>
          </div>
        </div>

        <div className="schedule-panel">
            <div className="schedule-toolbar">
                 <div className="toolbar-group">
                    <button className="icon-btn" onClick={() => handleWeekChange('prev')}><ChevronLeft/></button>
                     <h2>Tuần {weekDays[0].toLocaleDateString('vi-VN')} - {weekDays[6].toLocaleDateString('vi-VN')}</h2>
                    <button className="icon-btn" onClick={() => handleWeekChange('next')}><ChevronRight/></button>
                </div>
                 <div className="toolbar-group view-switcher">
                    <button className={`btn ${viewMode === 'location' ? 'active' : ''}`} onClick={() => setViewMode('location')}>Xem theo Vị trí</button>
                    <button className={`btn ${viewMode === 'employee' ? 'active' : ''}`} onClick={() => setViewMode('employee')}>Xem theo Nhân viên</button>
                 </div>
                 <div className="toolbar-group">
                    <button className="btn btn-special" onClick={handleQuickSchedule}>Sắp xếp nhanh</button>
                    <button className="btn btn-danger" onClick={clearWeek}>Xóa cả tuần</button>
                </div>
            </div>
            <div className="schedule-table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th rowSpan={2}>{viewMode === 'location' ? 'Vị trí' : 'Nhân viên'}</th>
                {weekDays.map((day, index) => (
                  <th key={index} colSpan={2} className="day-header">
                      <div>{day.toLocaleDateString('vi-VN', { weekday: 'long' })}</div>
                      <div>{day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div>
                      <button className="icon-btn delete-btn" onClick={() => clearDay(index)} aria-label={`Xóa ngày ${day.toLocaleDateString('vi-VN')}`}><Trash/></button>
                  </th>
                ))}
              </tr>
              <tr>
                {weekDays.map((_, index) => (
                  <React.Fragment key={index}>
                    <th className="time-header">Sáng</th>
                    <th className="time-header">Chiều</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            {viewMode === 'location' ? (
                <LocationScheduleBody 
                    allLocations={allLocations}
                    weekDays={weekDays}
                    schedule={schedule}
                    employees={employees}
                    draggedEmployeeId={draggedEmployeeId}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleCellRightClick={handleCellRightClick}
                    handleCellClick={handleCellClick}
                    clearLocation={clearLocation}
                />
            ) : (
                <EmployeeScheduleBody
                    employees={employees}
                    weekDays={weekDays}
                    schedule={schedule}
                    allLocations={allLocations}
                    draggedLocationId={draggedLocationId}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleEmployeeViewCellRightClick={handleEmployeeViewCellRightClick}
                    clearEmployee={clearEmployee}
                />
            )}
          </table>
          </div>
        </div>

        {preferenceModalEmployee && (
            <LocationPreferenceModal
                employee={preferenceModalEmployee}
                allLocations={locations} // Only allow scheduling work locations
                onClose={() => setPreferenceModalEmployee(null)}
                onSave={handleSavePreferences}
            />
        )}
        
        {popupInfo && viewMode === 'location' && (
            <EmployeeSelectorPopup
                employees={employees}
                x={popupInfo.x}
                y={popupInfo.y}
                onSelect={(employeeId) => handleAssignEmployee(employeeId, popupInfo.locationId, popupInfo.dayIndex, popupInfo.time)}
                onClear={() => {
                    clearCell(popupInfo.locationId, popupInfo.dayIndex, popupInfo.time);
                    setPopupInfo(null);
                }}
            />
        )}
        
        <div className="stats-panel card">
            <h3>Thống kê tuần</h3>
            <StatsTable schedule={schedule} employees={employees} locations={allLocations} weekDays={weekDays} fixedLocations={FIXED_LOCATIONS}/>
        </div>

        <div className="summary-panel card">
            <h3>Bảng tổng hợp theo vị trí (số ca)</h3>
            <SummaryTable schedule={schedule} employees={employees} locations={locations} weekDays={weekDays} />
        </div>
      </div>
    </>
  );
};


// --- SCHEDULE BODY COMPONENTS ---
const LocationScheduleBody = ({ allLocations, weekDays, schedule, employees, draggedEmployeeId, handleDragOver, handleDragLeave, handleDrop, handleCellRightClick, handleCellClick, clearLocation }) => {
    return (
        <tbody>
            {allLocations.map(loc => (
                <tr key={loc.id}>
                    <th className={loc.id.includes('_leave') ? 'fixed-location' : ''}>
                        {loc.name}
                        {!loc.id.includes('_leave') && <button className="icon-btn delete-btn" onClick={() => clearLocation(loc.id)} aria-label={`Xóa ca làm của ${loc.name}`}><Trash/></button>}
                    </th>
                    {weekDays.map((_, dayIndex) => {
                        const amEmployeeId = schedule[loc.id]?.[dayIndex]?.am;
                        const pmEmployeeId = schedule[loc.id]?.[dayIndex]?.pm;
                        const amEmployee = employees.find(e => e.id === amEmployeeId);
                        const pmEmployee = employees.find(e => e.id === pmEmployeeId);
                        return (
                            <React.Fragment key={dayIndex}>
                                <td 
                                    className="schedule-cell editable" 
                                    onDragOver={handleDragOver} 
                                    onDragLeave={handleDragLeave} 
                                    onDrop={(e) => handleDrop(e, { locationId: loc.id, employeeId: draggedEmployeeId, dayIndex, time: 'am' })}
                                    onClick={(e) => handleCellClick(e, loc.id, dayIndex, 'am')}
                                    onContextMenu={(e) => handleCellRightClick(e, loc.id, dayIndex, 'am')}
                                >
                                    {amEmployee && <div className="employee-tag" style={{backgroundColor: amEmployee.color}}>{amEmployee.name}</div>}
                                </td>
                                <td 
                                    className="schedule-cell editable" 
                                    onDragOver={handleDragOver} 
                                    onDragLeave={handleDragLeave} 
                                    onDrop={(e) => handleDrop(e, { locationId: loc.id, employeeId: draggedEmployeeId, dayIndex, time: 'pm' })}
                                    onClick={(e) => handleCellClick(e, loc.id, dayIndex, 'pm')}
                                    onContextMenu={(e) => handleCellRightClick(e, loc.id, dayIndex, 'pm')}
                                >
                                    {pmEmployee && <div className="employee-tag" style={{backgroundColor: pmEmployee.color}}>{pmEmployee.name}</div>}
                                </td>
                            </React.Fragment>
                        );
                    })}
                </tr>
            ))}
        </tbody>
    );
};

const EmployeeScheduleBody = ({ employees, weekDays, schedule, allLocations, draggedLocationId, handleDragOver, handleDragLeave, handleDrop, handleEmployeeViewCellRightClick, clearEmployee }) => {
    const findAssignment = useCallback((employeeId, dayIndex, time) => {
        for (const locId of Object.keys(schedule)) {
            if (schedule[locId]?.[dayIndex]?.[time] === employeeId) {
                return allLocations.find(l => l.id === locId);
            }
        }
        return null;
    }, [schedule, allLocations]);

    return (
        <tbody>
            {employees.map(emp => (
                <tr key={emp.id}>
                    <th>
                        <div className="employee-row-header">
                           <div className="employee-tag" style={{ backgroundColor: emp.color }}>{emp.name}</div>
                           <button className="icon-btn delete-btn" onClick={() => clearEmployee(emp.id)} aria-label={`Xóa lịch làm của ${emp.name}`}><Trash/></button>
                        </div>
                    </th>
                    {weekDays.map((_, dayIndex) => {
                        const amLocation = findAssignment(emp.id, dayIndex, 'am');
                        const pmLocation = findAssignment(emp.id, dayIndex, 'pm');
                        
                        return (
                            <React.Fragment key={dayIndex}>
                                <td
                                    className="schedule-cell"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, { employeeId: emp.id, locationId: draggedLocationId, dayIndex, time: 'am' })}
                                    onContextMenu={(e) => handleEmployeeViewCellRightClick(e, emp.id, dayIndex, 'am')}
                                >
                                    {amLocation && <div className="location-tag-cell">{amLocation.name}</div>}
                                </td>
                                <td
                                    className="schedule-cell"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, { employeeId: emp.id, locationId: draggedLocationId, dayIndex, time: 'pm' })}
                                    onContextMenu={(e) => handleEmployeeViewCellRightClick(e, emp.id, dayIndex, 'pm')}
                                >
                                    {pmLocation && <div className="location-tag-cell">{pmLocation.name}</div>}
                                </td>
                            </React.Fragment>
                        );
                    })}
                </tr>
            ))}
        </tbody>
    );
};

// --- POPUP COMPONENT ---
const EmployeeSelectorPopup = ({ employees, x, y, onSelect, onClear }) => {
    return (
        <div className="employee-selector-popup" style={{ top: y, left: x }}>
            <ul className="employee-selector-list">
                {employees.map(emp => (
                    <li key={emp.id} className="employee-selector-item" onClick={() => onSelect(emp.id)}>
                         <div className="employee-tag-small" style={{ backgroundColor: emp.color }}></div>
                         {emp.name}
                    </li>
                ))}
            </ul>
            <button className="employee-selector-clear" onClick={onClear}>
                <Trash/> Xóa
            </button>
        </div>
    );
};

// --- LOCATION PREFERENCE MODAL ---
const LocationPreferenceModal = ({ employee, allLocations, onClose, onSave }) => {
    const [preferred, setPreferred] = useState<Location[]>([]);
    
    useEffect(() => {
        const initialPreferred = (employee.preferredLocations || [])
            .map(id => allLocations.find(loc => loc.id === id))
            .filter((loc): loc is Location => !!loc);
        setPreferred(initialPreferred);
    }, [employee, allLocations]);

    const addPreference = (location: Location) => {
        if (!preferred.some(p => p.id === location.id)) {
            setPreferred([...preferred, location]);
        }
    };
    
    const removePreference = (locationId: string) => {
        setPreferred(preferred.filter(p => p.id !== locationId));
    };
    
    const handleSave = () => {
        onSave(employee.id, preferred.map(p => p.id));
    };

    const availableLocations = allLocations.filter(loc => !preferred.some(p => p.id === loc.id));

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Tùy chọn vị trí cho {employee.name}</h3>
            <button onClick={onClose} className="modal-close-btn">&times;</button>
          </div>
          <div className="modal-body preference-columns">
            <div className="preference-column">
              <h4>Vị trí ưu tiên (kéo thả để sắp xếp)</h4>
              <ul className="location-select-list">
                {preferred.map(loc => (
                  <li key={loc.id} className="location-select-item">
                    <span>{loc.name}</span>
                    <button onClick={() => removePreference(loc.id)} className="icon-btn delete-btn"><Trash/></button>
                  </li>
                ))}
                 {preferred.length === 0 && <li className="empty-list-placeholder">Chưa có vị trí nào</li>}
              </ul>
            </div>
            <div className="preference-column">
              <h4>Tất cả vị trí</h4>
              <ul className="location-select-list">
                {availableLocations.map(loc => (
                  <li key={loc.id} className="location-select-item" onClick={() => addPreference(loc)}>
                     <span>{loc.name}</span>
                     <button className="icon-btn"><Plus/></button>
                  </li>
                ))}
                {availableLocations.length === 0 && <li className="empty-list-placeholder">Đã chọn hết</li>}
              </ul>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button className="btn" onClick={handleSave}>Lưu thay đổi</button>
          </div>
        </div>
      </div>
    );
};

// --- STATS COMPONENT ---
const StatsTable = ({schedule, employees, locations, weekDays, fixedLocations}) => {
    const weeklyStats = useMemo(() => {
        const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        return sortedEmployees.map(emp => {
            let workShifts = 0;
            let compLeaveTaken = 0;
            let annualLeaveTaken = 0;
            
            for(let dayIndex = 0; dayIndex < weekDays.length; dayIndex++) {
                locations.forEach(loc => {
                   const daySchedule = schedule[loc.id]?.[dayIndex];
                   if(daySchedule) {
                       if(daySchedule.am === emp.id) {
                           if (loc.id === fixedLocations.COMP_LEAVE.id) compLeaveTaken += 0.5;
                           else if (loc.id === fixedLocations.ANNUAL_LEAVE.id) annualLeaveTaken += 0.5;
                           else workShifts += 0.5;
                       }
                       if(daySchedule.pm === emp.id) {
                           if (loc.id === fixedLocations.COMP_LEAVE.id) compLeaveTaken += 0.5;
                           else if (loc.id === fixedLocations.ANNUAL_LEAVE.id) annualLeaveTaken += 0.5;
                           else workShifts += 0.5;
                       }
                   }
                });
            }
            
            return {
                ...emp,
                workShifts,
                compLeaveTaken,
                annualLeaveTaken,
                remainingComp: emp.compLeave - compLeaveTaken,
                remainingAnnual: emp.annualLeave - annualLeaveTaken,
            }
        });
    }, [schedule, employees, locations, weekDays, fixedLocations]);

    return (
        <table className="stats-table">
            <thead>
                <tr>
                    <th>Nhân viên</th>
                    <th>Tổng ca làm</th>
                    <th>Nghỉ bù đã lấy (ngày)</th>
                    <th>Nghỉ phép đã lấy (ngày)</th>
                    <th>Nghỉ bù còn lại</th>
                    <th>Nghỉ phép còn lại</th>
                </tr>
            </thead>
            <tbody>
                {weeklyStats.map(stat => (
                    <tr key={stat.id}>
                        <td>{stat.name}</td>
                        <td>{stat.workShifts}</td>
                        <td>{stat.compLeaveTaken}</td>
                        <td>{stat.annualLeaveTaken}</td>
                        <td>{stat.remainingComp}</td>
                        <td>{stat.remainingAnnual}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// --- SUMMARY TABLE COMPONENT ---
const SummaryTable = ({ schedule, employees, locations, weekDays }) => {
    const sortedEmployees = useMemo(() => [...employees].sort((a, b) => a.name.localeCompare(b.name, 'vi')), [employees]);
    const summaryData = useMemo(() => {
        const summary = {};
        employees.forEach(emp => {
            summary[emp.id] = {};
            locations.forEach(loc => {
                let shiftCount = 0;
                for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex++) {
                    const daySchedule = schedule[loc.id]?.[dayIndex];
                    if (daySchedule) {
                        if (daySchedule.am === emp.id) {
                            shiftCount += 0.5;
                        }
                        if (daySchedule.pm === emp.id) {
                            shiftCount += 0.5;
                        }
                    }
                }
                summary[emp.id][loc.id] = shiftCount;
            });
        });
        return summary;
    }, [schedule, employees, locations, weekDays]);

    return (
        <table className="stats-table">
            <thead>
                <tr>
                    <th>Nhân viên</th>
                    {locations.map(loc => <th key={loc.id}>{loc.name}</th>)}
                </tr>
            </thead>
            <tbody>
                {sortedEmployees.map(emp => (
                    <tr key={emp.id}>
                        <td>{emp.name}</td>
                        {locations.map(loc => (
                            <td key={loc.id}>
                                {summaryData[emp.id]?.[loc.id] > 0 ? summaryData[emp.id][loc.id] : ''}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};


// --- RENDER APP ---
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);