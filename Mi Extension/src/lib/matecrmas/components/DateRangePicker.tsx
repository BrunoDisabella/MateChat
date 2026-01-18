import React, { useState, useMemo, useEffect } from 'react';

// Utility functions
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};
const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate: Date;
  initialEndDate: Date;
  onApply: (startDate: Date, endDate: Date) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ isOpen, onClose, initialStartDate, initialEndDate, onApply }) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  useEffect(() => {
    if (isOpen) {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        setCurrentMonth(startOfMonth(initialEndDate));
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  const calendarGrid = useMemo(() => {
    const weeks: Date[][] = [];
    const monthStart = startOfMonth(currentMonth);
    let currentDate = new Date(monthStart);
    currentDate.setDate(currentDate.getDate() - (currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1));

    for (let i = 0; i < 6; i++) {
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
            week.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    if (!startDate || (startDate && endDate)) {
        setStartDate(day);
        setEndDate(null);
        setHoverDate(null);
    } else if (startDate && !endDate) {
        if (day < startDate) {
            setEndDate(startDate);
            setStartDate(day);
        } else {
            setEndDate(day);
        }
        setHoverDate(null);
    }
  };
  
  const handleApplyClick = () => {
    if (startDate && endDate) {
        onApply(startDate, endDate);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">&#x3c;</button>
                <span className="font-semibold text-lg dark:text-white capitalize">
                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">&#x3e;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
                {calendarGrid.flat().map((day, index) => {
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    
                    const isStartDate = isSameDay(day, startDate);
                    const isEndDate = isSameDay(day, endDate);

                    const tempEndDate = endDate || hoverDate;
                    
                    let isInRange = false;
                    if (startDate && tempEndDate && !isSameDay(startDate, tempEndDate)) {
                       if (tempEndDate > startDate) {
                           isInRange = day > startDate && day < tempEndDate;
                       } else {
                           isInRange = day < startDate && day > tempEndDate;
                       }
                    }

                    return (
                        <div 
                            key={index}
                            className={`
                                flex items-center justify-center
                                ${(isInRange) && 'bg-blue-100 dark:bg-blue-900/50'}
                                ${isStartDate && tempEndDate && !isSameDay(startDate, tempEndDate) && 'rounded-l-full bg-blue-100 dark:bg-blue-900/50'}
                                ${isEndDate && startDate && 'rounded-r-full'}
                                ${isSameDay(day, hoverDate) && startDate && !endDate && tempEndDate > startDate && 'rounded-r-full'}
                                ${isSameDay(day, hoverDate) && startDate && !endDate && tempEndDate < startDate && 'rounded-l-full'}
                            `}
                            onMouseEnter={() => startDate && !endDate && setHoverDate(day)}
                        >
                             <button
                                type="button"
                                onClick={() => isCurrentMonth && handleDayClick(day)}
                                className={`
                                    w-10 h-10 mx-auto rounded-full text-sm flex items-center justify-center transition-colors
                                    ${isCurrentMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'}
                                    ${(isStartDate || isEndDate) ? 'bg-blue-600 text-white font-bold' : isCurrentMonth ? 'hover:bg-gray-200 dark:hover:bg-gray-700' : ''}
                                `}
                                disabled={!isCurrentMonth}
                            >
                                {day.getDate()}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700 gap-3">
            <button type="button" onClick={onClose} className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600">Cancelar</button>
            <button type="button" onClick={handleApplyClick} className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50" disabled={!startDate || !endDate}>Aplicar</button>
        </div>
      </div>
    </div>
  );
};
