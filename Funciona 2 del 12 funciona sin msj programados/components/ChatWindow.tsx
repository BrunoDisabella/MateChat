import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { Chat, Message, QuickReply } from '../types';
import { formatTime } from '../utils/formatters';
import { MoreVertical, Search, Phone, Video } from 'lucide-react';
import { PlayIcon, PauseIcon, DoubleCheckmarkIcon } from './Icons';
import { MessageInput } from './MessageInput';
import Avatar from './common/Avatar';

// --- Format Text Body (Legacy Logic) ---
const MessageBody: React.FC<{ text: string; highlight: string }> = React.memo(({ text, highlight }) => {
  if (!text) return null;

  const parts = useMemo(() => {
    if (!text) return [];
    const formattingRegex = /(\*.*?\*)|(_.*?_)|(~.*?~)|(```[\s\S]*?```)|((?:https?:\/\/|www\.)[^\s]+)/g;
    return text.split(formattingRegex).filter(part => part);
  }, [text]);

  const highlightRegex = useMemo(() => {
    if (!highlight || !highlight.trim()) return null;
    const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`(${escapedHighlight})`, 'gi');
  }, [highlight]);

  return (
    <>
      {parts.map((part, index) => {
        let element: React.ReactNode = part;

        if (part.startsWith('*') && part.endsWith('*')) element = <strong>{part.slice(1, -1)}</strong>;
        else if (part.startsWith('_') && part.endsWith('_')) element = <em>{part.slice(1, -1)}</em>;
        else if (part.startsWith('~') && part.endsWith('~')) element = <s>{part.slice(1, -1)}</s>;
        else if (part.startsWith('```') && part.endsWith('```')) element = <code className="font-mono bg-gray-300/50 p-1 rounded text-sm whitespace-pre-wrap">{part.slice(3, -3)}</code>;
        else if (part.match(/^(https?:\/\/|www\.)[^\s]+$/)) {
           const url = part.startsWith('www.') ? `http://${part}` : part;
           element = <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline" onClick={e => e.stopPropagation()}>{part}</a>;
        } else if (highlightRegex && typeof element === 'string') {
            const textParts = part.split(highlightRegex);
            element = <>{textParts.map((textPart, i) => textPart.toLowerCase() === highlight.toLowerCase() ? <span key={i} className="bg-yellow-300 rounded-sm px-0.5">{textPart}</span> : textPart)}</>;
        }
        return <React.Fragment key={index}>{element}</React.Fragment>;
      })}
    </>
  );
});

// --- Legacy Audio Player ---
const AudioPlayer: React.FC<{ media: any; isSent: boolean; senderName: string; }> = React.memo(({ media, isSent }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioSrc, setAudioSrc] = useState('');

    useEffect(() => {
        if (!media || !media.data) return;
        
        // Decode logic from legacy
        try {
            const src = `data:${media.mimetype};base64,${media.data}`;
            setAudioSrc(src);
        } catch (e) {
            console.error("Error setting audio src", e);
        }
    }, [media]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || !audioRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const newTime = (offsetX / rect.width) * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-2 w-full max-w-xs min-w-[240px] pt-1">
            <audio
                ref={audioRef}
                src={audioSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
            />
            <div className="flex-shrink-0">
               <Avatar name={isSent ? 'Tú' : 'User'} size="sm" />
            </div>
            
            <button onClick={togglePlayPause} className="flex-shrink-0 text-gray-500 hover:text-gray-700">
                {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
            </button>
            
            <div className="flex-grow flex flex-col justify-center h-full gap-1">
                <div
                    ref={progressBarRef}
                    onClick={handleSeek}
                    className="relative w-full h-3 flex items-center cursor-pointer group"
                >
                    <div className="absolute w-full h-1 bg-gray-300 rounded-full"></div>
                    <div
                        className={`absolute h-1 rounded-full ${isSent ? 'bg-[#00a884]' : 'bg-gray-500'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                    <div
                        className={`absolute w-3 h-3 rounded-full transition-transform ${isSent ? 'bg-[#00a884]' : 'bg-gray-500'} ${isPlaying ? 'scale-110' : 'scale-0 group-hover:scale-100'}`}
                        style={{ left: `calc(${progress}% - 6px)` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
});


// --- Legacy Message Bubble ---
const MessageBubble: React.FC<{ msg: Message; searchTerm: string; senderName: string }> = React.memo(({ msg, searchTerm, senderName }) => {
    const isSent = msg.fromMe;
    
    // Time formatter internal to match legacy
    const timeString = React.useMemo(() => {
        if (!msg.timestamp) return '';
        const date = new Date(msg.timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [msg.timestamp]);

    return (
        <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] mb-2 ${isSent ? 'self-end' : 'self-start'}`}>
            <div 
                className={`rounded-lg px-3 py-2 shadow-sm relative text-sm ${
                    isSent ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
                }`}
            >
                {/* Media Content */}
                {msg.hasMedia && msg.media && (
                    <div className="mb-1">
                        {(msg.isVoiceMessage || msg.media.mimetype.startsWith('audio/')) ? (
                            <AudioPlayer media={msg.media} isSent={isSent} senderName={senderName} />
                        ) : msg.media.mimetype.startsWith('image/') ? (
                             <img src={`data:${msg.media.mimetype};base64,${msg.media.data}`} alt="Media" className="max-w-xs rounded-lg mt-1" />
                        ) : (
                             <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                                <span className="text-gray-600">📄 Archivo: {msg.media.filename || msg.type}</span>
                             </div>
                        )}
                    </div>
                )}

                {/* Text Content */}
                {msg.body && (
                    <div className="text-gray-800 break-words whitespace-pre-wrap leading-relaxed pr-6">
                        <MessageBody text={msg.body} highlight={searchTerm} />
                    </div>
                )}
                
                {/* Metadata (Time & Check) */}
                <div className="flex justify-end items-center gap-1 float-right -mt-3 ml-2 translate-y-1">
                    <span className="text-[11px] text-gray-500">{timeString}</span>
                    {isSent && <DoubleCheckmarkIcon className="w-4 h-3 text-blue-400" />}
                </div>
            </div>
        </div>
    );
});

// --- Main Chat Window ---
interface Props {
  chat: Chat | null;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (text: string, audioBlob?: Blob) => void;
  loadingHistory: boolean;
  quickReplies: QuickReply[];
}

export const ChatWindow: React.FC<Props> = ({ 
  chat, 
  messages, 
  onSendMessage,
  loadingHistory,
  quickReplies
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, chat?.id]);

  // Background style from legacy
  const backgroundStyle = {
    backgroundColor: '#efeae2',
    backgroundImage: 'radial-gradient(#d4d0c9 1px, transparent 1px)',
    backgroundSize: '20px 20px'
  };

  if (!chat) {
    return (
        <div className="flex-1 flex-col justify-center items-center text-gray-500 hidden md:flex" style={backgroundStyle}>
            <div className="text-center bg-white/80 backdrop-blur-sm p-8 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">MateChat Web</h3>
                <p className="text-sm text-gray-600">Selecciona un chat para comenzar.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative w-full" style={backgroundStyle}>
      {/* Header */}
      <header className="bg-[#f0f2f5] px-4 py-2.5 flex items-center justify-between border-b border-gray-200 shrink-0 z-10 h-[60px]">
        <div className="flex items-center gap-4 cursor-pointer">
           <Avatar name={chat.name} src={chat.profilePicUrl || undefined} size="md" />
           <div className="flex flex-col justify-center">
             <h2 className="text-[#111b21] text-base font-normal leading-tight truncate">{chat.name}</h2>
             <p className="text-[13px] text-[#667781] leading-tight">Haga clic aquí para la info. del contacto</p>
           </div>
        </div>
        <div className="flex items-center gap-5 text-[#54656f]">
           <Video className="w-5 h-5 cursor-pointer" />
           <Phone className="w-5 h-5 cursor-pointer" />
           <div className="w-px h-6 bg-gray-300 mx-1"></div>
           <Search className="w-5 h-5 cursor-pointer" />
           <MoreVertical className="w-5 h-5 cursor-pointer" />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:px-[5%] lg:px-[8%] flex flex-col gap-1 custom-scrollbar">
        {loadingHistory && (
            <div className="flex justify-center p-2 mb-4">
                <span className="text-xs bg-white/90 px-3 py-1.5 rounded-full shadow-sm text-gray-500 uppercase font-medium tracking-wide">Cargando...</span>
            </div>
        )}
        
        {messages.map((msg, idx) => (
          <MessageBubble key={msg.id || idx} msg={msg} searchTerm="" senderName={chat.name} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput 
        onSendMessage={onSendMessage}
        quickReplies={quickReplies}
      />
    </div>
  );
};