import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { LogEntry, LogLevel } from '../types';

interface ConsoleContextType {
  logs: LogEntry[];
  isVisible: boolean;
  toggleVisibility: () => void;
  clearLogs: () => void;
  logEvent: (source: string, level: LogLevel, ...message: any[]) => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export const ConsoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const logEvent = useCallback((source: string, level: LogLevel, ...message: any[]) => {
    setLogs(prevLogs => [...prevLogs, { source, level, message, timestamp: new Date() }]);
    // También imprimir en la consola real para no perder la referencia nativa
    // (Omitimos esto para evitar bucles si sobreescribimos console.log, pero aquí es seguro)
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // Atajo de teclado: Ctrl + 0
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === '0') {
        event.preventDefault();
        toggleVisibility();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVisibility]);

  return (
    <ConsoleContext.Provider value={{ logs, isVisible, toggleVisibility, clearLogs, logEvent }}>
      {children}
      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-black/90 text-green-400 font-mono text-xs p-4 overflow-y-auto z-[9999] border-t-2 border-green-600">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/90 pb-2 border-b border-gray-700">
                <span className="font-bold">CONSOLA DE DEPURACIÓN</span>
                <div className="flex gap-2">
                    <button onClick={clearLogs} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">Limpiar</button>
                    <button onClick={toggleVisibility} className="px-2 py-1 bg-red-900 hover:bg-red-700 rounded">Cerrar</button>
                </div>
            </div>
            {logs.map((log, i) => (
                <div key={i} className="mb-1 border-b border-gray-800 pb-1">
                    <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span>
                    <span className={`mx-2 font-bold ${log.level === 'error' ? 'text-red-500' : log.level === 'warn' ? 'text-yellow-500' : 'text-blue-400'}`}>
                        [{log.source}]
                    </span>
                    <span className="text-white whitespace-pre-wrap">
                        {log.message.map(m => (typeof m === 'object' ? JSON.stringify(m) : String(m))).join(' ')}
                    </span>
                </div>
            ))}
        </div>
      )}
    </ConsoleContext.Provider>
  );
};

export const useConsole = (): ConsoleContextType => {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error('useConsole debe usarse dentro de un ConsoleProvider');
  }
  return context;
};