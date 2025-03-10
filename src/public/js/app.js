// Conectar al servidor Socket.io con reconexión automática
const socket = io({
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
    transports: ['websocket', 'polling']
});

// Registro de eventos de reconexión para depuración
socket.on('connect_error', (error) => {
    console.error('Error de conexión Socket.io:', error);
    connectionInfo.textContent = 'Error de conexión. Intentando reconectar...';
    statusEl.className = 'status disconnected';
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Intento de reconexión ${attemptNumber}...`);
});

socket.on('reconnect', () => {
    console.log('Reconectado exitosamente');
});

// Elementos del DOM
const qrContainer = document.getElementById('qr-container');
const qrCode = document.getElementById('qr-code');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const connectionInfo = document.getElementById('connection-info');
const messageForm = document.getElementById('message-form');
const phoneInput = document.getElementById('phone');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const sendResult = document.getElementById('send-result');

// Estado inicial
let isConnected = false;

// Elementos adicionales para la interfaz de chat
const chatInterface = document.getElementById('chat-interface');
const featuresSection = document.getElementById('features-section');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const chatPlaceholder = document.getElementById('chat-placeholder');
const currentChatName = document.getElementById('current-chat-name');
const currentChatStatus = document.getElementById('current-chat-status');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const logoutBtn = document.getElementById('logout-btn');

// Variables para gestionar el chat
let chats = [];
let currentChat = null;
let currentChatMessages = [];

// Función para actualizar el estado de la conexión
function updateConnectionStatus(status, message) {
    statusEl.className = `status ${status}`;
    statusText.textContent = message;
    
    if (status === 'connected') {
        isConnected = true;
        qrContainer.classList.add('hidden');
        
        // Mostrar la interfaz de chat y cargar los chats
        chatInterface.classList.remove('hidden');
        featuresSection.classList.add('hidden');
        messageForm.classList.add('hidden');
        
        // Mostrar botón de desconexión
        logoutBtn.classList.remove('hidden');
        
        // Cargar los chats
        loadChats();
    } else if (status === 'disconnected') {
        isConnected = false;
        qrContainer.classList.remove('hidden');
        chatInterface.classList.add('hidden');
        featuresSection.classList.remove('hidden');
        messageForm.classList.add('hidden');
        connectionInfo.textContent = '';
        
        // Ocultar botón de desconexión
        logoutBtn.classList.add('hidden');
    } else if (status === 'connecting') {
        isConnected = false;
        qrContainer.classList.remove('hidden');
        chatInterface.classList.add('hidden');
        featuresSection.classList.remove('hidden');
        messageForm.classList.add('hidden');
        
        // Ocultar botón de desconexión
        logoutBtn.classList.add('hidden');
    }
}

// Función para cargar la lista de chats
async function loadChats() {
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (data.success) {
            chats = data.chats;
            renderChatList(chats);
            console.log('Chats cargados:', chats.length);
        } else {
            console.error('Error al cargar chats:', data.message);
        }
    } catch (error) {
        console.error('Error al cargar chats:', error);
    }
}

// Función para renderizar la lista de chats
function renderChatList(chats) {
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('li');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        
        // Formatear la fecha del último mensaje
        const lastMessageTime = chat.lastMessage ? formatTime(new Date(chat.lastMessage.timestamp * 1000)) : '';
        
        chatItem.innerHTML = `
            <div class="chat-avatar">
                ${chat.profilePic 
                    ? `<img src="${chat.profilePic}" alt="${chat.name}">`
                    : `<div class="default-avatar"><i class="fas fa-${chat.isGroup ? 'users' : 'user'}"></i></div>`
                }
            </div>
            <div class="chat-info">
                <div class="chat-name">
                    ${chat.name || 'Chat sin nombre'}
                    <span class="chat-time">${lastMessageTime}</span>
                </div>
                <div class="chat-last-message">
                    ${chat.lastMessage ? (chat.lastMessage.fromMe ? 'Tú: ' : '') + chat.lastMessage.body : 'No hay mensajes'}
                </div>
            </div>
            ${chat.unreadCount > 0 ? `<div class="chat-unread">${chat.unreadCount}</div>` : ''}
        `;
        
        // Evento para cargar mensajes al hacer clic en el chat
        chatItem.addEventListener('click', () => loadChatMessages(chat.id));
        
        chatList.appendChild(chatItem);
    });
}

// Función para cargar los mensajes de un chat
async function loadChatMessages(chatId) {
    try {
        // Actualizar la UI para mostrar que se está cargando
        messagesContainer.innerHTML = '<div class="loading">Cargando mensajes...</div>';
        chatPlaceholder.classList.add('hidden');
        
        // Marcar el chat activo en la lista
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            }
        });
        
        // Obtener los mensajes del chat
        const response = await fetch(`/api/chats/${chatId}/messages`);
        const data = await response.json();
        
        if (data.success) {
            currentChat = data.chatInfo;
            currentChatMessages = data.messages;
            
            // Actualizar la información del chat actual
            currentChatName.textContent = currentChat.name || 'Chat sin nombre';
            currentChatStatus.textContent = currentChat.isGroup ? 'Grupo' : 'Contacto';
            
            // Renderizar los mensajes
            renderMessages(currentChatMessages);
            
            // Habilitar el envío de mensajes
            messageInput.disabled = false;
            sendMessageBtn.disabled = false;
        } else {
            console.error('Error al cargar mensajes:', data.message);
            messagesContainer.innerHTML = `<div class="error">Error al cargar mensajes: ${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
        messagesContainer.innerHTML = `<div class="error">Error al cargar mensajes: ${error.message}</div>`;
    }
}

// Función para renderizar los mensajes
function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages">No hay mensajes en este chat</div>';
        return;
    }
    
    messages.forEach(message => {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.fromMe ? 'message-outgoing' : 'message-incoming'}`;
        messageEl.dataset.messageId = message.id;
        
        // Formatear la fecha del mensaje
        const messageTime = formatTime(new Date(message.timestamp * 1000));
        
        // Manejar tipos especiales de mensajes
        let messageContent = '';
        
        if (message.hasMedia) {
            // Si es un mensaje con multimedia
            if (message.type === 'image') {
                messageContent = '<div class="message-media"><i class="fas fa-image"></i> [Imagen]</div>';
            } else if (message.type === 'video') {
                messageContent = '<div class="message-media"><i class="fas fa-video"></i> [Video]</div>';
            } else if (message.type === 'audio') {
                messageContent = '<div class="message-media"><i class="fas fa-headphones"></i> [Audio]</div>';
            } else if (message.type === 'document') {
                messageContent = '<div class="message-media"><i class="fas fa-file"></i> [Documento]</div>';
            } else {
                messageContent = '<div class="message-media"><i class="fas fa-paperclip"></i> [Archivo]</div>';
            }
            
            // Si tiene texto además del multimedia
            if (message.body) {
                messageContent += `<div class="message-content">${message.body}</div>`;
            }
        } else {
            // Mensaje de texto normal
            messageContent = `<div class="message-content">${message.body}</div>`;
        }
        
        messageEl.innerHTML = `
            ${(!message.fromMe && currentChat && currentChat.isGroup) ? 
                `<div class="message-sender">${message.sender || 'Desconocido'}</div>` : ''}
            ${messageContent}
            <div class="message-time">${messageTime}</div>
        `;
        
        messagesContainer.appendChild(messageEl);
    });
    
    // Scroll al último mensaje
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Función para formatear la hora
function formatTime(date) {
    if (!date) return '';
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (isToday) {
        return `${hours}:${minutes}`;
    } else if (isYesterday) {
        return `Ayer ${hours}:${minutes}`;
    } else {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    }
}

// Escuchar eventos de Socket.io
socket.on('connect', () => {
    console.log('Conectado al servidor Socket.io');
    updateConnectionStatus('connecting', 'Esperando código QR...');
    
    // Solicitar explícitamente el código QR al servidor
    setTimeout(() => {
        socket.emit('requestQR');
    }, 1000);
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor Socket.io');
    updateConnectionStatus('disconnected', 'Desconectado');
});

// Evento para actualizaciones de estado
socket.on('status', (data) => {
    console.log('Estado actualizado:', data);
    updateConnectionStatus(data.status, data.message);
});

// Escuchar evento de código QR
socket.on('qr', (qr) => {
    console.log('QR recibido en el cliente, longitud:', qr.length);
    updateConnectionStatus('connecting', 'Escanea el código QR');
    
    // Almacenar el QR en almacenamiento local para depuración y recuperación
    try {
        localStorage.setItem('lastQrCode', qr);
        console.log('QR guardado en localStorage para recuperación');
        
        // Añadir un enlace a la página de visualización QR dedicada
        const qrPageLink = document.createElement('a');
        qrPageLink.href = `/qr?data=${encodeURIComponent(qr)}`;
        qrPageLink.className = 'button';
        qrPageLink.style.backgroundColor = '#34B7F1';
        qrPageLink.style.color = 'white';
        qrPageLink.style.padding = '8px 16px';
        qrPageLink.style.borderRadius = '5px';
        qrPageLink.style.textDecoration = 'none';
        qrPageLink.style.display = 'block';
        qrPageLink.style.margin = '10px auto';
        qrPageLink.style.width = 'fit-content';
        qrPageLink.target = '_blank';
        qrPageLink.textContent = 'Ver QR en página dedicada';
        
        // Insertamos el enlace en el contenedor de QR
        if (!document.getElementById('qr-page-link')) {
            qrPageLink.id = 'qr-page-link';
            qrCode.parentNode.insertBefore(qrPageLink, qrCode.nextSibling);
        }
    } catch (storageError) {
        console.error('No se pudo guardar QR en localStorage:', storageError);
    }
    
    // Limpiar el contenedor de QR antes de generar uno nuevo
    qrCode.innerHTML = '';
    
    // Variable para rastrear si alguno de los métodos ha tenido éxito
    let qrSuccess = false;
    
    // Generar código QR en el frontend con múltiples métodos de fallback
    try {
        // MÉTODO 0: Usar la función directa si existe (desde index.html)
        if (window.showQrDirectly && typeof window.showQrDirectly === 'function') {
            qrSuccess = window.showQrDirectly(qr, 'qr-code');
            if (qrSuccess) {
                console.log('QR generado con función directa del índice');
                return;
            }
        }
        
        // MÉTODO 1: Usar QRCode constructor (davidshimjs/qrcodejs)
        if (!qrSuccess && typeof QRCode === 'function') {
            try {
                qrCode.innerHTML = ''; // Asegurar que está vacío
                new QRCode(qrCode, {
                    text: qr,
                    width: 300,
                    height: 300,
                    colorDark: "#128C7E",
                    colorLight: "#ffffff",
                });
                console.log('QR generado con QRCode constructor');
                qrSuccess = true;
                return;
            } catch (constructorError) {
                console.error('Error al generar QR con constructor:', constructorError);
            }
        }
        
        // MÉTODO 2: Usar la biblioteca QRCode con canvas
        if (!qrSuccess && window.QRCode && typeof QRCode.toCanvas === 'function') {
            try {
                QRCode.toCanvas(qrCode, qr, { 
                    width: 300,
                    margin: 1,
                    color: {
                        dark: '#128C7E',
                        light: '#FFFFFF'
                    }
                }, (error) => {
                    if (error) {
                        throw new Error('Error en toCanvas: ' + error.message);
                    } else {
                        console.log('QR generado con QRCode.toCanvas');
                        qrSuccess = true;
                    }
                });
                
                if (qrCode.children.length > 0) {
                    console.log('Canvas QR creado correctamente');
                    qrSuccess = true;
                    return;
                }
            } catch (canvasError) {
                console.error('Error al generar QR con toCanvas:', canvasError);
            }
        }
        
        // MÉTODO 3: Usar dataURL
        if (!qrSuccess && window.QRCode && typeof QRCode.toDataURL === 'function') {
            try {
                QRCode.toDataURL(qr, { width: 300, margin: 1 }, (err, url) => {
                    if (err) {
                        throw new Error('Error en toDataURL: ' + err.message);
                    }
                    const img = document.createElement('img');
                    img.src = url;
                    img.width = 300;
                    qrCode.innerHTML = '';
                    qrCode.appendChild(img);
                    console.log('QR generado con QRCode.toDataURL');
                    qrSuccess = true;
                });
                
                // Si hay una promesa en curso para dataURL, esperemos un poco
                setTimeout(() => {
                    if (qrCode.children.length > 0 && !qrSuccess) {
                        console.log('DataURL QR parecía funcionar');
                        qrSuccess = true;
                        return;
                    }
                    
                    // Si todavía no hay éxito, continuar con métodos alternativos
                    if (!qrSuccess) continueWithAlternatives();
                }, 500);
                
                return;
            } catch (dataUrlError) {
                console.error('Error al generar QR con toDataURL:', dataUrlError);
            }
        }
        
        // Función para continuar con métodos alternativos
        function continueWithAlternatives() {
            if (qrSuccess) return;
            
            // MÉTODO 4: Usar API externa para generar QR
            try {
                const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
                const img = document.createElement('img');
                img.src = qrApiUrl;
                img.width = 300;
                img.alt = 'Código QR de WhatsApp';
                qrCode.innerHTML = '';
                qrCode.appendChild(img);
                console.log('QR generado con API externa');
                qrSuccess = true;
                return;
            } catch (apiError) {
                console.error('Error al generar QR con API externa:', apiError);
            }
            
            // MÉTODO 5: Mostrar enlace al QR y datos en texto
            if (!qrSuccess) {
                qrCode.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <p>No se pudo generar el código QR en el navegador.</p>
                        <p>Puedes usar este enlace para ver el código:</p>
                        <a href="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" 
                           target="_blank" style="color: #128C7E; font-weight: bold; display: block; margin-bottom: 20px;">
                           <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" 
                           width="300" height="300" alt="Código QR">
                        </a>
                        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px;">
                            Recargar página
                        </button>
                    </div>
                `;
                console.log('Generando enlace al QR como fallback');
                qrSuccess = true;
            }
        }
        
        // Si llegamos hasta aquí y no hay éxito, probar métodos alternativos
        if (!qrSuccess) {
            continueWithAlternatives();
        }
        
    } catch (e) {
        console.error('Error general al generar QR:', e);
        
        // Último recurso: mostrar QR con API externa y botón de reintento
        qrCode.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: red;">Hubo un error al generar el código QR localmente.</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" 
                   width="300" height="300" alt="Código QR">
                <p>Si no puedes ver el QR, intenta recargar la página.</p>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px;">
                    Recargar página
                </button>
            </div>
        `;
    }
});

// Escuchar evento cuando el cliente está listo
socket.on('ready', (data) => {
    console.log('Cliente WhatsApp listo:', data);
    updateConnectionStatus('connected', 'Conectado a WhatsApp');
    connectionInfo.textContent = 'La sesión está activa';
    
    // Limpiar el contenedor de QR
    qrCode.innerHTML = '';
    
    // Mostrar el botón de desconexión
    if (logoutBtn) {
        logoutBtn.classList.remove('hidden');
        logoutBtn.style.display = 'inline-flex';
        console.log('Botón de desconexión mostrado');
    } else {
        console.error('No se encontró el botón de desconexión');
    }
});

// Escuchar evento de desconexión de WhatsApp
socket.on('disconnected', (data) => {
    console.log('WhatsApp desconectado:', data);
    updateConnectionStatus('disconnected', 'Desconectado de WhatsApp');
    connectionInfo.textContent = data.reason || 'La sesión ha finalizado';
    
    // Limpiar datos de estado
    chats = [];
    currentChat = null;
    currentChatMessages = [];
});

// Escuchar evento de nuevo mensaje
socket.on('message', (data) => {
    console.log('Nuevo mensaje recibido:', data);
    
    // Podríamos mostrar una notificación o agregar a una lista de mensajes recientes
    if (isConnected) {
        const notification = `Nuevo mensaje de ${data.from}: ${data.body.substring(0, 30)}${data.body.length > 30 ? '...' : ''}`;
        connectionInfo.textContent = notification;
        
        // Limpiar después de 5 segundos
        setTimeout(() => {
            if (connectionInfo.textContent === notification) {
                connectionInfo.textContent = 'La sesión está activa';
            }
        }, 5000);
    }
});

// Manejar envío de mensaje en la interfaz de chat
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Verificar si el botón de logout existe y está cargado
if (logoutBtn) {
    console.log('Botón de logout encontrado y configurado');
    
    // Manejar clic en botón de desconexión
    logoutBtn.addEventListener('click', async () => {
        console.log('Botón de desconexión clickeado');
        if (!isConnected) return;
        
        const confirmLogout = confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?');
        if (!confirmLogout) return;
        
        try {
            logoutBtn.disabled = true;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desconectando...';
            connectionInfo.textContent = 'Cerrando sesión...';
            
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('Sesión cerrada correctamente');
                // La actualización de la UI se hará cuando se reciba el evento de desconexión
            } else {
                console.error('Error al cerrar sesión:', data.message);
                connectionInfo.textContent = `Error al cerrar sesión: ${data.message}`;
                logoutBtn.disabled = false;
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Desconectar';
            }
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            connectionInfo.textContent = `Error al cerrar sesión: ${error.message}`;
            logoutBtn.disabled = false;
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Desconectar';
        }
    });
} else {
    console.error('No se encontró el botón de logout, verificar ID y DOM');
}

// Función para enviar mensaje en la interfaz de chat
async function sendMessage() {
    if (!currentChat || !messageInput.value.trim()) return;
    
    const messageText = messageInput.value.trim();
    const chatId = currentChat.id;
    
    // Limpiar input y deshabilitar botón mientras se envía
    messageInput.value = '';
    sendMessageBtn.disabled = true;
    
    try {
        // Agregar mensaje temporal a la UI
        const tempMessageId = 'temp-' + Date.now();
        const tempMessage = {
            id: tempMessageId,
            body: messageText,
            fromMe: true,
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        currentChatMessages.push(tempMessage);
        renderMessages(currentChatMessages);
        
        // Enviar mensaje al servidor
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to: chatId, message: messageText })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Error al enviar mensaje:', data.message);
            // Marcar el mensaje como fallido
            const tempMessageEl = document.querySelector(`[data-message-id="${tempMessageId}"]`);
            if (tempMessageEl) {
                tempMessageEl.classList.add('message-error');
                tempMessageEl.querySelector('.message-time').innerHTML += ' <i class="fas fa-exclamation-circle"></i> Error';
            }
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
    } finally {
        // Restaurar botón
        sendMessageBtn.disabled = false;
        messageInput.focus();
    }
}

// Manejar envío de mensaje en el formulario de prueba
sendBtn.addEventListener('click', async () => {
    const phone = phoneInput.value.trim();
    const message = messageInput.value.trim();
    
    if (!phone || !message) {
        sendResult.textContent = 'Por favor completa todos los campos';
        sendResult.className = 'error';
        return;
    }
    
    // Deshabilitar botón mientras se envía
    sendBtn.disabled = true;
    sendBtn.textContent = 'Enviando...';
    
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to: phone, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sendResult.textContent = 'Mensaje enviado correctamente';
            sendResult.className = 'success';
            messageInput.value = '';
        } else {
            sendResult.textContent = `Error: ${data.message || 'No se pudo enviar el mensaje'}`;
            sendResult.className = 'error';
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        sendResult.textContent = `Error: ${error.message || 'No se pudo enviar el mensaje'}`;
        sendResult.className = 'error';
    } finally {
        // Restaurar botón
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar Mensaje';
    }
});