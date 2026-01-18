import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, Trash2 } from 'lucide-react';
import { SendIcon, MicIcon } from './Icons'; // Using custom legacy icons
import { QuickReply } from '../types';
import { useConsole } from '../contexts/ConsoleContext';

interface Props {
  onSendMessage: (text: string, audioBlob?: Blob) => void;
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
      onSendMessage(text);
      setText('');
      setShowSuggestions(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#f0f2f5] px-4 py-3 flex items-center gap-2 relative z-20 min-h-[62px]">
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
                <button className="text-[#54656f] hover:text-gray-600">
                    <Smile className="w-7 h-7" strokeWidth={1.5} />
                </button>
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
                {hasText ? <SendIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
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