import React, { useState, useEffect, useMemo, memo } from 'react';
import type { Socket } from 'socket.io-client';
import type { Chat, Label, ChatLabels } from '../types';
import Avatar from './common/Avatar';
import { MoreVertical, Settings, Key, Zap, Webhook, CircleDashed, Search, Trash2, LogOut } from 'lucide-react';

// --- Sub-componentes internos ---

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    chatId: string | null;
}

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim() || !text) {
        return <>{text}</>;
    }
    const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) && part.toLowerCase() === highlight.toLowerCase() ? (
                    <span key={i} className="bg-yellow-300 rounded-sm px-0.5">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

const ChatListItem: React.FC<{
    chat: Chat;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, chatId: string) => void;
    labels: Label[];
    chatLabelIds: string[];
    searchTerm: string;
}> = memo(({ chat, isSelected, onSelect, onContextMenu, labels, chatLabelIds, searchTerm }) => {
    const chatSpecificLabels = labels.filter(l => chatLabelIds.includes(l.id));

    return (
        <li
            onClick={() => onSelect(chat.id)}
            onContextMenu={(e) => onContextMenu(e, chat.id)}
            className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-[#f5f6f6] flex items-center gap-3 transition-colors ${isSelected ? 'bg-[#f0f2f5]' : ''}`}
        >
            <div className="relative">
                <Avatar name={chat.name} src={chat.profilePicUrl} size="lg" isGroup={chat.isGroup} />
            </div>

            <div className="flex-1 overflow-hidden min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <div className="font-normal text-[#111b21] text-[17px] truncate">
                        <HighlightText text={chat.name} highlight={searchTerm} />
                    </div>
                    {/* Timestamp could go here if available in chat object */}
                </div>

                <div className="flex justify-between items-center">
                    <p className="text-[14px] text-[#667781] truncate pr-2">
                        <HighlightText text={chat.lastMessage?.body || (chat.lastMessage?.hasMedia ? '📷 Media' : '')} highlight={searchTerm} />
                    </p>
                    {chat.unreadCount && chat.unreadCount > 0 ? (
                        <span className="flex-shrink-0 bg-[#25d366] text-white text-xs font-bold rounded-full h-5 min-w-[1.25rem] px-1.5 flex items-center justify-center shadow-sm">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                    ) : null}
                </div>

                {chatSpecificLabels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {chatSpecificLabels.map(label => (
                            <span key={label.id} className="text-[10px] text-white px-1.5 py-0.5 rounded-sm font-medium tracking-wide shadow-sm" style={{ backgroundColor: label.color }}>
                                {label.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </li>
    );
});

const LabelContextMenu: React.FC<{
    menuState: ContextMenuState;
    onClose: () => void;
    allLabels: Label[];
    chatLabels: ChatLabels;
    socket: Socket | null;
}> = ({ menuState, onClose, allLabels, chatLabels, socket }) => {
    if (!menuState.visible || !menuState.chatId) return null;

    const currentChatLabels = chatLabels[menuState.chatId] || [];

    const handleLabelToggle = (labelId: string, isChecked: boolean) => {
        if (!menuState.chatId) return;
        const event = isChecked ? 'assign-label' : 'unassign-label';
        socket?.emit(event, { chatId: menuState.chatId, labelId });
    };

    // Auto-close on mouse leave could be annoying, better click outside (handled in parent)

    return (
        <div
            className="fixed z-50 bg-white shadow-xl rounded-lg border border-gray-100 py-2 min-w-[200px] animate-in fade-in zoom-in duration-100"
            style={{ top: menuState.y, left: menuState.x }}
            onClick={(e) => e.stopPropagation()}
        >
            <h4 className="text-xs font-bold text-gray-500 px-4 pb-2 mb-1 border-b uppercase tracking-wider">Etiquetas</h4>
            <div className="flex flex-col max-h-64 overflow-y-auto custom-scrollbar">
                {allLabels.length > 0 ? allLabels.map(label => (
                    <label key={label.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
                            checked={currentChatLabels.includes(label.id)}
                            onChange={(e) => handleLabelToggle(label.id, e.target.checked)}
                        />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }}></span>
                        <span className="text-sm text-gray-700">{label.name}</span>
                    </label>
                )) : <div className="p-4 text-sm text-gray-400 text-center">Sin etiquetas</div>}
            </div>
        </div>
    );
};

// --- Componente Principal ---

interface ChatListProps {
    chats: Chat[];
    selectedChatId: string | null;
    onSelectChat: (id: string) => void;
    loading: boolean;

    // Props de Sidebar Legacy
    allLabels: Label[];
    chatLabels: ChatLabels;
    onToggleLabels: () => void;
    socket: Socket | null;

    // Props de Menú de Sistema
    onOpenApiKeyModal: () => void;
    onOpenWebhooksModal: () => void;
    onOpenQuickRepliesModal: () => void;
    onOpenStatusModal: () => void;

    // Acciones de Usuario
    onUserLogout: () => void;
    onResetWAConnection: () => void;
    userEmail?: string;
}

export const ChatList: React.FC<ChatListProps> = ({
    chats,
    selectedChatId,
    onSelectChat,
    loading,
    allLabels,
    chatLabels,
    onToggleLabels,
    socket,
    onOpenApiKeyModal,
    onOpenWebhooksModal,
    onOpenQuickRepliesModal,
    onOpenStatusModal,
    onUserLogout,
    onResetWAConnection,
    userEmail
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<string>(''); // Single filter string for Select
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, chatId: null });
    const [showSystemMenu, setShowSystemMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Calcular conteos de etiquetas (fallback si el backend no lo envía)
    // Pero si el backend envía 'count' en la etiqueta, usaremos ese.
    const labelCounts = useMemo(() => {
        const counts: Record<string, number> = {};

        // 1. Usar conteo del backend si viene en los labels
        allLabels.forEach(l => {
            if (typeof (l as any).count === 'number') {
                counts[l.id] = (l as any).count;
            }
        });

        // 2. Si hay etiquetas sin conteo del backend (o es 0 y queremos verificar local), sumar localmente?
        // Mejor confiar en el backend si ya implementamos la lógica "hard" allá. 
        // Solo si count no existe, hacemos fallback.
        const useFallback = allLabels.some(l => (l as any).count === undefined);

        if (useFallback) {
            Object.values(chatLabels).forEach(labels => {
                labels.forEach(labelId => {
                    counts[labelId] = (counts[labelId] || 0) + 1;
                });
            });
        }

        return counts;
    }, [chatLabels, allLabels]);

    // Filter Logic updated for Select
    const filteredChats = useMemo(() => {
        const sorted = [...chats].sort((a, b) => {
            const tA = a.lastMessage?.timestamp || 0;
            const tB = b.lastMessage?.timestamp || 0;
            return tB - tA;
        });

        return sorted.filter(chat => {
            // Filter by Label (Single Select)
            if (selectedFilter && selectedFilter !== 'all') {
                const chatIds = chatLabels[chat.id] || [];
                if (!chatIds.includes(selectedFilter)) return false;
            }

            // Filter by Search Term
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;

            const name = chat.name?.toLowerCase() || '';
            const lastMessage = chat.lastMessage?.body?.toLowerCase() || '';

            return name.includes(term) || lastMessage.includes(term);
        });
    }, [chats, searchTerm, selectedFilter, chatLabels]);

    const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, chatId });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0, chatId: null });
    };

    useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        if (contextMenu.visible) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [contextMenu.visible]);

    return (
        <aside className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full relative z-20">
            <LabelContextMenu
                menuState={contextMenu}
                onClose={closeContextMenu}
                allLabels={allLabels}
                chatLabels={chatLabels}
                socket={socket}
            />

            {/* Header del Sidebar */}
            <div className="bg-[#f0f2f5] p-3 py-2.5 flex justify-between items-center h-[60px] shrink-0 px-4 border-b border-gray-200">
                <div className="flex items-center gap-3 relative">
                    <div className="cursor-pointer" onClick={() => setShowUserMenu(!showUserMenu)}>
                        <Avatar name="Me" size="md" />
                    </div>

                    {/* Menú de Usuario Dropdown */}
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                            <div className="absolute left-0 top-12 bg-white shadow-xl rounded-lg py-2 w-64 z-50 border border-gray-100 animate-in fade-in zoom-in duration-200">
                                <div className="px-4 py-3 border-b border-gray-100 mb-1">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Conectado como</p>
                                    <p className="text-sm font-medium text-gray-800 truncate">{userEmail || 'Usuario'}</p>
                                </div>

                                <button
                                    onClick={() => { setShowUserMenu(false); onResetWAConnection(); }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Eliminar conexión WhatsApp
                                </button>

                                <button
                                    onClick={() => { setShowUserMenu(false); onUserLogout(); }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" /> Cerrar Sesión
                                </button>
                            </div>
                        </>
                    )}

                    <button
                        onClick={onOpenStatusModal}
                        className="p-2 rounded-full hover:bg-gray-200 text-[#54656f] transition-colors"
                        title="Programar Estados"
                    >
                        <CircleDashed className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex gap-4 text-[#54656f]">
                    {/* Botón de Sistema */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSystemMenu(!showSystemMenu)}
                            className={`p-2 rounded-full transition-colors ${showSystemMenu ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Menú de Sistema */}
                        {showSystemMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowSystemMenu(false)}></div>
                                <div className="absolute right-0 top-10 bg-white shadow-xl rounded-lg py-2 w-56 z-40 border border-gray-100 animate-in fade-in zoom-in duration-200 origin-top-right">
                                    <button onClick={() => { setShowSystemMenu(false); onOpenApiKeyModal(); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                        <Key className="w-4 h-4" /> API Keys
                                    </button>
                                    <button onClick={() => { setShowSystemMenu(false); onOpenWebhooksModal(); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                        <Webhook className="w-4 h-4" /> Webhooks
                                    </button>
                                    <button onClick={() => { setShowSystemMenu(false); onOpenQuickRepliesModal(); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                        <Zap className="w-4 h-4" /> Respuestas Rápidas
                                    </button>
                                    <div className="h-px bg-gray-100 my-1"></div>
                                    <button onClick={() => window.location.reload()} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                        <Settings className="w-4 h-4" /> Recargar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Buscador y Filtro */}
            <div className="p-2 border-b border-gray-100 flex flex-col gap-2">
                <div className="bg-[#f0f2f5] rounded-lg flex items-center px-4 py-1.5">
                    <Search className="w-4 h-4 text-gray-500 mr-2" />
                    <input
                        type="text"
                        placeholder="Buscar o empezar un nuevo chat"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent w-full text-[14px] outline-none text-[#3b4a54] placeholder:text-[#54656f] h-8"
                    />
                </div>

                {/* Nuevo Filtro Dropdown con color y conteo */}
                <div className="px-1 flex items-center gap-2">
                    <div className="relative w-full">
                        <select
                            className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-md p-2 pl-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all cursor-pointer appearance-none"
                            value={selectedFilter}
                            onChange={(e) => setSelectedFilter(e.target.value)}
                            style={{
                                color: selectedFilter && selectedFilter !== 'all'
                                    ? allLabels.find(l => l.id === selectedFilter)?.color || 'inherit'
                                    : 'inherit',
                                fontWeight: selectedFilter && selectedFilter !== 'all' ? '600' : 'normal'
                            }}
                        >
                            <option value="" disabled className="text-gray-400">Filtrar por etiqueta...</option>
                            <option value="all" className="text-gray-800 font-normal">📝 Todas las etiquetas</option>
                            {allLabels.map(label => (
                                <option
                                    key={label.id}
                                    value={label.id}
                                    style={{ color: label.color, fontWeight: 'bold' }}
                                >
                                    ● {label.name} ({labelCounts[label.id] || 0})
                                </option>
                            ))}
                        </select>
                        {/* Flechita custom para que se vea más pro */}
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Chats */}
            <ul className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                {loading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#00a884] rounded-full animate-spin"></div>
                    </div>
                ) : !chats || chats.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        <p>No hay chats disponibles</p>
                    </div>
                ) : filteredChats.length > 0 ? (
                    filteredChats.map(chat => (
                        <ChatListItem
                            key={chat.id}
                            chat={chat}
                            isSelected={selectedChatId === chat.id}
                            onSelect={onSelectChat}
                            onContextMenu={handleContextMenu}
                            labels={allLabels}
                            chatLabelIds={chatLabels[chat.id] || []}
                            searchTerm={searchTerm}
                        />
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No se encontraron chats con ese filtro
                    </div>
                )}
            </ul>

            {/* Botón Gestión Etiquetas */}
            <div className="p-3 border-t border-gray-200 bg-[#f0f2f5]">
                <button
                    onClick={onToggleLabels}
                    className="w-full bg-white border border-gray-300 text-[#00a884] text-sm font-bold py-2 rounded shadow-sm hover:bg-gray-50 transition-colors uppercase tracking-wide"
                >
                    Gestionar Etiquetas
                </button>
            </div>
        </aside>
    );
};