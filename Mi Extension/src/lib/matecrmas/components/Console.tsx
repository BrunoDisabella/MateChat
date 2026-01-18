import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from './icons.tsx';
import { Logger, LogMessage, LogLevel } from '../lib/logger.ts';

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;

const InitialMessage = () => (
    <>
        <p className="text-green-400">MateCRM Console</p>
        <p className="text-gray-400">&gt; Presiona Ctrl + 0 para abrir/cerrar.</p>
        <p className="text-gray-400">&gt; Arrastra la barra superior para mover.</p>
        <p className="text-gray-400">&gt; Arrastra la esquina inferior derecha para redimensionar.</p>
        <p className="text-gray-400">&gt; Esperando registros de la aplicación...</p>
    </>
);

const LogLine: React.FC<{ msg: LogMessage }> = ({ msg }) => {
    const getLevelColor = (level: LogLevel) => {
        switch(level) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            case 'log':
            default: return 'text-gray-300';
        }
    };

    const isError = msg.level === 'error';

    return (
        <div className={`p-1 rounded-sm ${isError ? 'bg-red-900/30' : ''}`}>
            <div className="flex gap-2 items-start">
                <span className="text-gray-500 flex-shrink-0">{msg.timestamp.toLocaleTimeString()}</span>
                <span className={`${getLevelColor(msg.level)} break-words`}>{msg.message}</span>
            </div>
            {msg.data && (
                <pre className="text-xs text-gray-400 mt-1 p-2 bg-black/30 rounded overflow-x-auto">
                    {JSON.stringify(msg.data, null, 2)}
                </pre>
            )}
            {msg.stack && (
                <pre className="text-xs text-red-400/70 mt-1 p-2 bg-black/30 rounded overflow-x-auto">
                    {msg.stack}
                </pre>
            )}
        </div>
    );
};

export const Console: React.FC<ConsoleProps> = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 250, y: window.innerHeight / 2 - 150 });
  const [size, setSize] = useState({ width: 500, height: 300 });
  const [messages, setMessages] = useState<LogMessage[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const consoleRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
      const handleNewMessage = (message: LogMessage) => {
          if (message.message === 'CONSOLE_CLEARED') {
              setMessages([]);
              return;
          }
          setMessages(prev => [...prev.slice(-100), message]); // Keep last 100 messages
      };

      const unsubscribe = Logger.subscribe(handleNewMessage);
      
      if (isOpen) {
          Logger.info('Consola abierta y suscrita a los registros.');
      }

      return () => unsubscribe();
  }, [isOpen]);

  // Dragging logic
  const onDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!consoleRef.current) return;
    setIsDragging(true);
    const rect = consoleRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  // Resizing logic
  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y,
        });
      }
      if (isResizing) {
        if (!consoleRef.current) return;
        const rect = consoleRef.current.getBoundingClientRect();
        setSize({
          width: Math.max(MIN_WIDTH, e.clientX - rect.left),
          height: Math.max(MIN_HEIGHT, e.clientY - rect.top),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);
  
  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={consoleRef}
      className="fixed bg-gray-900/90 dark:bg-black/80 backdrop-blur-sm text-white rounded-lg shadow-2xl flex flex-col font-mono z-[100] select-none animate-fade-in-up"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
      }}
    >
      <div
        className="flex justify-between items-center p-2 bg-gray-800/80 dark:bg-gray-900/80 rounded-t-lg cursor-move"
        onMouseDown={onDragMouseDown}
      >
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Consola</span>
             <button
              onClick={() => Logger.clear()}
              className="text-gray-400 text-xs hover:bg-gray-700/80 hover:text-white rounded px-2 py-0.5"
              aria-label="Limpiar consola"
            >
              Limpiar
            </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:bg-gray-700/80 hover:text-white rounded p-1"
          aria-label="Cerrar consola"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <div ref={logContainerRef} className="flex-grow p-3 overflow-y-auto text-sm space-y-1">
        {messages.length === 0 ? <InitialMessage /> : messages.map((msg, i) => <LogLine key={i} msg={msg} />)}
      </div>
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          borderBottom: '2px solid rgba(255,255,255,0.4)',
          borderRight: '2px solid rgba(255,255,255,0.4)',
        }}
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
};