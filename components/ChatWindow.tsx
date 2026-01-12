import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { Chat, Message, QuickReply, ScheduledMessage, Label } from '../types';
import { formatTime } from '../utils/formatters';
import { MoreVertical, Search, Phone, Video, Clock, PlayCircle, PauseCircle, Trash2, Tag, Loader2 } from 'lucide-react';
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
                className={`rounded-lg px-3 py-2 shadow-sm relative text-sm ${isSent ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
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
                                {/* DEBUG: Log mimetype */}
                                {console.log(`[DEBUG UI] Media render fallback. Type: ${msg.type}, Mimetype: ${msg.media.mimetype}`, msg.media)}
                                <span className="text-gray-600">📄 Archivo: {msg.media.filename || msg.type} ({msg.media.mimetype})</span>
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

// --- Scheduled Message Bubble ---
const ScheduledMessageBubble: React.FC<{
    msg: ScheduledMessage;
    onToggle: (id: string, active: boolean) => void;
    onDelete: (id: string) => void
}> = ({ msg, onToggle, onDelete }) => {
    const scheduledDate = new Date(msg.scheduled_time);

    return (
        <div className="flex items-end gap-2 max-w-[85%] md:max-w-[75%] mb-3 self-end">
            <div className="rounded-lg rounded-tr-none px-3 py-2 shadow-sm relative text-sm bg-yellow-50 border border-yellow-200 w-full">

                {/* Header: Estado y Fecha */}
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-yellow-100">
                    <div className="flex items-center gap-1 text-xs text-yellow-700 font-bold">
                        <Clock className="w-3 h-3" />
                        <span>Programado: {scheduledDate.toLocaleDateString()} {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${msg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {msg.is_active ? 'ACTIVO' : 'PAUSADO'}
                    </span>
                </div>

                {/* Contenido */}
                <div className="text-gray-700 break-words whitespace-pre-wrap leading-relaxed mb-2 italic">
                    {msg.body}
                </div>

                {/* Controles */}
                <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                        onClick={() => onToggle(msg.id, !msg.is_active)}
                        className={`p-1 rounded-full transition-colors ${msg.is_active ? 'text-yellow-600 hover:bg-yellow-200' : 'text-green-600 hover:bg-green-100'}`}
                        title={msg.is_active ? "Pausar envío" : "Activar envío"}
                    >
                        {msg.is_active ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => onDelete(msg.id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Eliminar mensaje programado"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Chat Window ---
interface Props {
    chat: Chat | null;
    messages: Message[];
    scheduledMessages?: ScheduledMessage[];
    currentUserId: string;
    onSendMessage: (text: string, audioBlob?: Blob, scheduledTime?: number) => void;
    loadingHistory: boolean;
    loadingMore?: boolean; // Nuevo prop
    onLoadMore?: () => void; // Nuevo prop
    quickReplies: QuickReply[];
    onToggleSchedule?: (id: string, active: boolean) => void;
    onDeleteSchedule?: (id: string) => void;

    // Props de etiquetas
    allLabels: Label[];
    currentChatLabels: string[];
    onToggleLabel: (labelId: string, checked: boolean) => void;
    onBack?: () => void; // Nuevo prop para mobile
}

export const ChatWindow: React.FC<Props> = ({
    chat,
    messages,
    scheduledMessages = [],
    onSendMessage,
    loadingHistory,
    loadingMore = false,
    onLoadMore,
    quickReplies,
    onToggleSchedule,
    onDeleteSchedule,
    allLabels = [],
    currentChatLabels = [],
    onToggleLabel,
    onBack
}) => {
    const [showLabelMenu, setShowLabelMenu] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevMessagesLengthRef = useRef(0);
    const isFirstLoadRef = useRef(true);

    // Manejar scroll y autoscroll
    useLayoutEffect(() => {
        // Si es la primera carga o cambiamos de chat
        if (loadingHistory || isFirstLoadRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            isFirstLoadRef.current = false;
        }
        // Si estamos recibiendo nuevos mensajes (enviados o recibidos, no historial)
        else if (messages.length > prevMessagesLengthRef.current && !loadingMore) {
            // Solo autoscroll si el usuario ya estaba cerca del final
            const container = messagesContainerRef.current;
            if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                if (isNearBottom) {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
        // Si cargamos historial antiguo (pagination)
        else if (loadingMore && messages.length > prevMessagesLengthRef.current) {
            // Mantener posición visual
            const container = messagesContainerRef.current;
            if (container) {
                const newScrollHeight = container.scrollHeight;
                const oldScrollHeight = container.getAttribute('data-scroll-height');
                if (oldScrollHeight) {
                    const diff = newScrollHeight - parseInt(oldScrollHeight);
                    container.scrollTop += diff;
                }
            }
        }

        prevMessagesLengthRef.current = messages.length;
    }, [messages, loadingHistory, loadingMore, chat?.id]);

    // Reset flag on chat change
    useEffect(() => {
        isFirstLoadRef.current = true;
        prevMessagesLengthRef.current = 0;
    }, [chat?.id]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        if (container.scrollTop === 0 && !loadingHistory && !loadingMore && onLoadMore) {
            // Guardar altura actual antes de cargar más
            container.setAttribute('data-scroll-height', container.scrollHeight.toString());
            onLoadMore();
        }
    };

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
                <div className="flex items-center gap-5 text-[#54656f] relative">
                    <Video className="w-5 h-5 cursor-pointer hover:text-gray-600 hidden sm:block" />
                    <Phone className="w-5 h-5 cursor-pointer hover:text-gray-600 hidden sm:block" />
                    <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block"></div>

                    {/* Botón de Etiquetas */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLabelMenu(!showLabelMenu)}
                            className={`outline-none transition-colors ${showLabelMenu ? 'text-[#00a884]' : 'hover:text-gray-600'}`}
                            title="Etiquetas del chat"
                        >
                            <Tag className="w-5 h-5" />
                        </button>

                        {/* Dropdown de Etiquetas */}
                        {showLabelMenu && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={() => setShowLabelMenu(false)}></div>
                                <div className="absolute top-10 right-0 bg-white shadow-xl rounded-lg py-2 w-72 z-30 border border-gray-100 animate-in fade-in zoom-in duration-200 origin-top-right">
                                    <h4 className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                                        Etiquetas
                                    </h4>
                                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                        {allLabels.length > 0 ? allLabels.map(label => (
                                            <label key={label.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors select-none">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-[#00a884] focus:ring-[#00a884] cursor-pointer"
                                                    checked={currentChatLabels.includes(label.id)}
                                                    onChange={(e) => onToggleLabel(label.id, e.target.checked)}
                                                />
                                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }}></div>
                                                <span className="text-sm text-gray-700 truncate font-medium">{label.name}</span>
                                            </label>
                                        )) : (
                                            <div className="px-4 py-6 text-center">
                                                <p className="text-sm text-gray-400 mb-2">No hay etiquetas creadas.</p>
                                                <p className="text-xs text-gray-400">Ve a "Gestionar Etiquetas" en el menú principal.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <Search className="w-5 h-5 cursor-pointer hover:text-gray-600" />
                    <MoreVertical className="w-5 h-5 cursor-pointer hover:text-gray-600" />
                </div>
            </header>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 md:px-[5%] lg:px-[8%] flex flex-col gap-1 custom-scrollbar"
            >
                {/* Loader Superior */}
                {(loadingHistory || loadingMore) && (
                    <div className="flex justify-center p-2 mb-2 shrink-0">
                        <span className="flex items-center gap-2 text-xs bg-white/90 px-3 py-1.5 rounded-full shadow-sm text-gray-500 uppercase font-medium tracking-wide">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {loadingHistory ? 'Cargando chat...' : 'Cargando más mensajes...'}
                        </span>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <MessageBubble key={msg.id || idx} msg={msg} searchTerm="" senderName={chat.name} />
                ))}

                {/* Scheduled Messages Section */}
                {scheduledMessages.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300/50">
                        <div className="flex justify-center mb-4">
                            <span className="bg-white/80 px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest shadow-sm">
                                Mensajes Programados ({scheduledMessages.length})
                            </span>
                        </div>
                        {scheduledMessages.map(sMsg => (
                            <ScheduledMessageBubble
                                key={sMsg.id}
                                msg={sMsg}
                                onToggle={onToggleSchedule!}
                                onDelete={onDeleteSchedule!}
                            />
                        ))}
                    </div>
                )}

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