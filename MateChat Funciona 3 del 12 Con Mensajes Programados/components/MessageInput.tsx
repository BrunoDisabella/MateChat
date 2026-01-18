import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, Trash2, Calendar, Clock, X } from 'lucide-react';
import { SendIcon, MicIcon } from './Icons';
import { QuickReply } from '../types';
import { useConsole } from '../contexts/ConsoleContext';

interface Props {
  onSendMessage: (text: string, audioBlob?: Blob, scheduledTime?: number) => void;
  quickReplies: QuickReply[];
}

export const MessageInput: React.FC<Props> = ({ onSendMessage, quickReplies }) => {
  const { logEvent } = useConsole();
  const [text, setText] = useState('');
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Scheduling States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  // Quick Replies States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<QuickReply[]>([]);

  const hasText = text.trim().length > 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (text.startsWith('/')) {
        const term = text.substring(1).toLowerCase();
        const filtered = quickReplies.filter(qr => qr.shortcut.toLowerCase().includes(term));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    } else {
        setShowSuggestions(false);
    }
  }, [text, quickReplies]);

  const applyQuickReply = (qr: QuickReply) => {
      setText(qr.message);
      setShowSuggestions(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      logEvent('Audio', 'error', 'Error accediendo al micrófono', err);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (shouldSend && audioBlob.size > 0) {
          onSendMessage('', audioBlob);
        }
        
        const tracks = mediaRecorderRef.current?.stream.getTracks();
        tracks?.forEach(track => track.stop());
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null;
    stopRecording(false);
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim()) {
      let scheduleTimestamp: number | undefined = undefined;

      if (scheduledDate) {
          const date = new Date(scheduledDate);
          if (isNaN(date.getTime())) {
              alert('Fecha inválida');
              return;
          }
          if (date <= new Date()) {
              alert('La fecha programada debe ser futura.');
              return;
          }
          scheduleTimestamp = date.getTime() / 1000;
      }

      onSendMessage(text, undefined, scheduleTimestamp);
      
      // Reset states
      setText('');
      setShowSuggestions(false);
      setScheduledDate('');
      setShowDatePicker(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current datetime string for min attribute
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="bg-[#f0f2f5] px-4 py-3 flex flex-col gap-2 relative z-20 min-h-[62px]">
       
       {/* Scheduled Date Indicator */}
       {scheduledDate && (
           <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 p-2 rounded-md text-sm text-yellow-800 animate-in slide-in-from-bottom-2">
               <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4" />
                   <span>Programado para: <strong>{new Date(scheduledDate).toLocaleString()}</strong></span>
               </div>
               <button onClick={() => setScheduledDate('')} className="p-1 hover:bg-yellow-100 rounded-full">
                   <X className="w-4 h-4" />
               </button>
           </div>
       )}

       {/* Suggestions */}
       {showSuggestions && (
            <div className="absolute bottom-full left-16 right-16 bg-white rounded-t-lg shadow-xl border border-gray-200 mb-0 overflow-hidden z-30 max-h-64 overflow-y-auto">
                {suggestions.map(qr => (
                    <div 
                        key={qr.id} 
                        onClick={() => applyQuickReply(qr)}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                        <span className="font-bold text-[#00a884] block text-xs mb-1">/{qr.shortcut}</span>
                        <span className="text-sm text-gray-700 truncate block">{qr.message}</span>
                    </div>
                ))}
            </div>
        )}

      {/* Main Bar */}
      <div className="flex items-center gap-3 w-full">
        {!isRecording ? (
            <>
                <button className="text-[#54656f] hover:text-gray-600 relative">
                    <Smile className="w-7 h-7" strokeWidth={1.5} />
                </button>
                
                {/* Botón de Calendario */}
                <div className="relative">
                    <button 
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className={`transition-colors ${scheduledDate ? 'text-[#00a884]' : 'text-[#54656f] hover:text-gray-600'}`}
                        title="Programar mensaje"
                    >
                        <Calendar className="w-6 h-6" strokeWidth={1.5} />
                    </button>
                    
                    {/* Popover de Fecha */}
                    {showDatePicker && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white p-3 rounded-lg shadow-xl border border-gray-200 z-50">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Fecha y Hora de Envío</label>
                            <input 
                                type="datetime-local" 
                                min={minDateTime}
                                value={scheduledDate}
                                onChange={(e) => {
                                    setScheduledDate(e.target.value);
                                    setShowDatePicker(false);
                                }}
                                className="border border-gray-300 rounded p-1 text-sm focus:outline-none focus:border-[#00a884]"
                            />
                        </div>
                    )}
                </div>

                <button className="text-[#54656f] hover:text-gray-600">
                    <Paperclip className="w-6 h-6" strokeWidth={1.5} />
                </button>
                
                <form onSubmit={handleSendText} className="flex-1">
                    <input
                    type="text"
                    placeholder="Escribe un mensaje"
                    className="w-full py-2.5 px-4 rounded-lg bg-white border border-white focus:outline-none text-[#3b4a54] text-[15px] placeholder:text-[#54656f]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendText();
                        }
                    }}
                    />
                </form>

                <button 
                onClick={hasText ? () => handleSendText() : startRecording}
                className="text-[#54656f] hover:text-[#00a884] transition-colors p-1"
                >
                {hasText ? (
                    scheduledDate ? <Clock className="w-6 h-6 text-[#00a884]" /> : <SendIcon className="w-6 h-6" />
                ) : (
                    <MicIcon className="w-6 h-6" />
                )}
                </button>
            </>
        ) : (
            // Recording UI State matching Legacy
            <div className="flex-1 flex items-center gap-2 pl-2">
                <button onClick={cancelRecording} className="text-gray-500 hover:text-gray-700 p-2">
                    <Trash2 className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-gray-600 font-mono text-base">{formatDuration(recordingTime)}</span>
                </div>
                
                <button 
                    onClick={() => stopRecording(true)}
                    className="text-[#00a884] hover:text-[#008f6f] p-2"
                >
                    <SendIcon className="w-6 h-6" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};