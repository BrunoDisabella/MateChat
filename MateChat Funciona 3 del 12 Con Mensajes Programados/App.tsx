import React, { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from './services/supabase';
import { Login } from './components/Login';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { Chat, Message, User, ConnectionStatus, QuickReply, Session, Label, ChatLabels, ScheduledMessage } from './types';
import { blobToBase64 } from './utils/formatters';
import { ConsoleProvider, useConsole } from './contexts/ConsoleContext';

// Modales
import { ApiKeyManagerModal } from './components/modals/ApiKeyManagerModal';
import { WebhookManagerModal } from './components/modals/WebhookManagerModal';
import { QuickReplyManagerModal } from './components/modals/QuickReplyManagerModal';
import { LabelManagerModal } from './components/modals/LabelManagerModal';

// CONFIGURACIÓN DE URL DINÁMICA
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SOCKET_URL = IS_LOCALHOST ? 'http://localhost:3001' : undefined; 
const API_BASE_URL = IS_LOCALHOST ? 'http://localhost:3001' : '';

// Componente interno para usar hooks dentro del provider
const MateChatApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Estados de UI
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [scheduledMessages, setScheduledMessages] = useState<Record<string, ScheduledMessage[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [serverError, setServerError] = useState(false);
  
  // Estados de Etiquetas
  const [labels, setLabels] = useState<Label[]>([]);
  const [chatLabels, setChatLabels] = useState<ChatLabels>({});

  // Estados de Modales
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showWebhooksModal, setShowWebhooksModal] = useState(false);
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);
  const [showLabelManagerModal, setShowLabelManagerModal] = useState(false);

  const { logEvent } = useConsole();

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      if (supabaseSession?.user) {
        setUser({ id: supabaseSession.user.id, email: supabaseSession.user.email });
        setSession({ access_token: supabaseSession.access_token, user: { id: supabaseSession.user.id } });
        logEvent('Auth', 'info', 'Sesión recuperada', supabaseSession.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (supabaseSession?.user) {
        setUser({ id: supabaseSession.user.id, email: supabaseSession.user.email });
        setSession({ access_token: supabaseSession.access_token, user: { id: supabaseSession.user.id } });
      } else {
        setUser(null);
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [logEvent]);

  // Fetch Quick Replies
  const fetchQuickReplies = useCallback(async () => {
      if(!session) return;
      try {
          const res = await fetch(`${API_BASE_URL}/api/quick-replies`, {
             headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          const data = await res.json();
          if(data.success) {
              setQuickReplies(data.quickReplies);
              logEvent('Data', 'info', `Cargadas ${data.quickReplies.length} respuestas rápidas`);
          }
      } catch(e) {
          logEvent('Data', 'error', 'Error cargando respuestas rápidas', e);
      }
  }, [session, logEvent]);

  useEffect(() => {
      if(session) fetchQuickReplies();
  }, [session, fetchQuickReplies]);


  // Socket Connection
  useEffect(() => {
    if (!user || !session) return;

    setStatus(ConnectionStatus.CONNECTING);
    setServerError(false);
    const connectionUrl = SOCKET_URL || window.location.origin;
    logEvent('Socket', 'info', 'Iniciando conexión...', connectionUrl);

    const newSocket = io(connectionUrl, {
      auth: { token: session.access_token },
      transports: ['websocket', 'polling'] 
    });

    newSocket.on('connect', () => {
      logEvent('Socket', 'info', 'Conectado al servidor Socket.IO');
      setServerError(false);
      newSocket.emit('client-ready');
      newSocket.emit('get-all-labels');
    });

    newSocket.on('connect_error', (err) => {
        logEvent('Socket', 'error', 'Error de conexión websocket', err.message);
        setServerError(true);
    });

    newSocket.on('connected', (isConnected: boolean) => {
      if (isConnected) {
        setStatus(ConnectionStatus.CONNECTED);
        setQrCode(null);
        logEvent('WhatsApp', 'info', 'Cliente de WhatsApp listo');
      } else {
        setStatus(ConnectionStatus.QR_READY);
        logEvent('WhatsApp', 'warn', 'Esperando escaneo de QR');
      }
    });

    newSocket.on('qr', (qr: string) => {
      setStatus(ConnectionStatus.QR_READY);
      setQrCode(qr);
      logEvent('WhatsApp', 'info', 'Nuevo código QR recibido');
    });

    newSocket.on('chats', (incomingChats: Chat[]) => {
      setChats(incomingChats);
      logEvent('WhatsApp', 'info', `Recibidos ${incomingChats.length} chats`);
    });

    newSocket.on('chat-history', ({ chatId, messages: history }: { chatId: string, messages: Message[] }) => {
      setMessages(prev => ({ ...prev, [chatId]: history }));
      setLoadingHistory(false);
      logEvent('Chat', 'info', `Historial cargado para ${chatId}`);
    });
    
    // Scheduled Messages Updates
    newSocket.on('scheduled-messages', ({ chatId, messages }) => {
        setScheduledMessages(prev => ({ ...prev, [chatId]: messages }));
    });

    newSocket.on('new-message', (msg: Message & { chatId: string }) => {
      setChats(prevChats => prevChats.map(c => {
          if (c.id === msg.chatId) {
              return { 
                  ...c, 
                  lastMessage: msg,
                  unreadCount: msg.fromMe || selectedChatId === msg.chatId ? 0 : (c.unreadCount || 0) + 1 
              };
          }
          return c;
      }).sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)));

      setMessages(prev => {
        const chatMsgs = prev[msg.chatId] || [];
        if (chatMsgs.find(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.chatId]: [...chatMsgs, msg] };
      });
      
      if(msg.fromMe) logEvent('Chat', 'info', 'Mensaje enviado confirmado', msg.id);
      else logEvent('Chat', 'info', 'Nuevo mensaje recibido', msg.id);
    });
    
    newSocket.on('message-media-update', ({ chatId, messageId, media }) => {
        setMessages(prev => {
            const chatMsgs = prev[chatId] || [];
            return {
                ...prev,
                [chatId]: chatMsgs.map(m => m.id === messageId ? { ...m, media, hasMedia: true } : m)
            };
        });
    });

    newSocket.on('chat-profile-pic-update', ({ chatId, profilePicUrl }) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, profilePicUrl } : c));
    });

    newSocket.on('all-labels', (serverLabels: Label[]) => {
        setLabels(serverLabels);
    });
    
    newSocket.on('chat-labels-updated', (data: ChatLabels) => {
        setChatLabels(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, session, selectedChatId, logEvent]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (!messages[chatId]) {
      setLoadingHistory(true);
      socket?.emit('select-chat', chatId);
    }
    // Fetch scheduled messages for this chat
    socket?.emit('get-scheduled-messages', chatId);
  };

  const handleSendMessage = async (text: string, audioBlob?: Blob, scheduledTime?: number) => {
    if (!socket || !selectedChatId) return;

    if (audioBlob) {
      try {
        logEvent('Chat', 'info', 'Procesando envío de audio...');
        const base64Audio = await blobToBase64(audioBlob);
        socket.emit('send-message', {
          to: selectedChatId,
          text: '',
          audioBase64: base64Audio,
          audioMime: audioBlob.type,
          isVoiceMessage: true
        });
      } catch (e) {
        logEvent('Chat', 'error', 'Error codificando audio', e);
      }
    } else if (text) {
      socket.emit('send-message', {
        to: selectedChatId,
        text,
        scheduledTime // Will be undefined if normal send, or number if scheduled
      });
      
      if (scheduledTime) {
          logEvent('Schedule', 'info', 'Mensaje programado enviado al servidor');
      }
    }
  };
  
  // Handlers for Scheduling Controls
  const handleToggleSchedule = (id: string, active: boolean) => {
      socket?.emit('toggle-schedule', { id, active, chatId: selectedChatId });
  };

  const handleDeleteSchedule = (id: string) => {
      if(confirm('¿Eliminar mensaje programado?')) {
          socket?.emit('delete-schedule', { id, chatId: selectedChatId });
      }
  };
  
  // Acciones de Gestión de Cuenta
  const handleLogout = async () => {
      await supabase.auth.signOut();
      if (socket) socket.disconnect();
      setUser(null);
      setSession(null);
  };
  
  const handleResetConnection = () => {
      if (socket) {
          console.log('Enviando solicitud reset-session al servidor...');
          logEvent('Auth', 'warn', 'Solicitando reinicio de sesión de WhatsApp...');
          setQrCode(null);
          setStatus(ConnectionStatus.CONNECTING);
          socket.emit('reset-session');
      } else {
          console.error('No se pudo resetear: Socket no conectado');
      }
  };

  if (!user) return <Login />;

  return (
    <div className="flex h-screen overflow-hidden flex-col relative">
        {/* Banner de Error de Servidor */}
        {IS_LOCALHOST && serverError && (
             <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-bold z-50 absolute top-0 w-full shadow-md animate-in slide-in-from-top">
                 ⚠️ ERROR: No se puede conectar al servidor (Backend). Asegúrate de ejecutar "node server.js" en otra terminal.
             </div>
        )}

        <div className="flex flex-1 overflow-hidden">
            {/* Modales */}
            {session && (
                <>
                    <ApiKeyManagerModal 
                        isOpen={showApiKeyModal} 
                        onClose={() => setShowApiKeyModal(false)} 
                        session={session} 
                    />
                    <WebhookManagerModal 
                        isOpen={showWebhooksModal} 
                        onClose={() => setShowWebhooksModal(false)} 
                        session={session} 
                    />
                    <QuickReplyManagerModal 
                        isOpen={showQuickRepliesModal} 
                        onClose={() => setShowQuickRepliesModal(false)} 
                        session={session} 
                        quickReplies={quickReplies}
                        onUpdate={fetchQuickReplies}
                    />
                    <LabelManagerModal 
                        isOpen={showLabelManagerModal}
                        onClose={() => setShowLabelManagerModal(false)}
                        session={session}
                        labels={labels}
                        socket={socket}
                    />
                </>
            )}

            {/* Condición para mostrar QR */}
            {status === ConnectionStatus.QR_READY || (status === ConnectionStatus.CONNECTING && chats.length === 0) ? (
                <div className="w-full h-full">
                    <QRCodeDisplay 
                        qrCode={qrCode} 
                        error={null}
                        onLogout={handleLogout}
                        onResetConnection={handleResetConnection}
                    />
                </div>
            ) : (
                <>
                    <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
                        <ChatList 
                            chats={chats} 
                            selectedChatId={selectedChatId} 
                            onSelectChat={handleSelectChat}
                            loading={status === ConnectionStatus.CONNECTING}
                            allLabels={labels}
                            chatLabels={chatLabels}
                            onToggleLabels={() => setShowLabelManagerModal(true)}
                            socket={socket}
                            onOpenApiKeyModal={() => setShowApiKeyModal(true)}
                            onOpenWebhooksModal={() => setShowWebhooksModal(true)}
                            onOpenQuickRepliesModal={() => setShowQuickRepliesModal(true)}
                        />
                    </div>

                    <div className={`${!selectedChatId ? 'hidden md:flex' : 'flex'} flex-1 h-full relative`}>
                        {selectedChatId && (
                            <button 
                                onClick={() => setSelectedChatId(null)}
                                className="md:hidden absolute top-3 left-3 z-30 bg-white/90 p-2 rounded-full shadow text-gray-600 border border-gray-200"
                            >
                                ←
                            </button>
                        )}
                        
                        <ChatWindow 
                            chat={chats.find(c => c.id === selectedChatId) || null}
                            messages={selectedChatId ? (messages[selectedChatId] || []) : []}
                            scheduledMessages={selectedChatId ? (scheduledMessages[selectedChatId] || []) : []}
                            currentUserId={user.id}
                            onSendMessage={handleSendMessage}
                            loadingHistory={loadingHistory}
                            quickReplies={quickReplies}
                            onToggleSchedule={handleToggleSchedule}
                            onDeleteSchedule={handleDeleteSchedule}
                        />
                    </div>
                </>
            )}
        </div>
    </div>
  );
};

const App: React.FC = () => (
    <ConsoleProvider>
        <MateChatApp />
    </ConsoleProvider>
);

export default App;