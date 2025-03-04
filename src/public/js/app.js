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

// Función para actualizar el estado de la conexión
function updateConnectionStatus(status, message) {
    statusEl.className = `status ${status}`;
    statusText.textContent = message;
    
    if (status === 'connected') {
        isConnected = true;
        qrContainer.classList.add('hidden');
        messageForm.classList.remove('hidden');
    } else if (status === 'disconnected') {
        isConnected = false;
        qrContainer.classList.remove('hidden');
        messageForm.classList.add('hidden');
        connectionInfo.textContent = '';
    } else if (status === 'connecting') {
        isConnected = false;
        qrContainer.classList.remove('hidden');
        messageForm.classList.add('hidden');
    }
}

// Escuchar eventos de Socket.io
socket.on('connect', () => {
    console.log('Conectado al servidor Socket.io');
    updateConnectionStatus('connecting', 'Esperando código QR...');
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor Socket.io');
    updateConnectionStatus('disconnected', 'Desconectado');
});

// Escuchar evento de código QR
socket.on('qr', (qr) => {
    console.log('QR recibido');
    updateConnectionStatus('connecting', 'Escanea el código QR');
    
    // Limpiar el contenedor de QR antes de generar uno nuevo
    qrCode.innerHTML = '';
    
    // Generar código QR en el frontend con manejo de errores mejorado
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
                console.error('Error al generar QR con toCanvas:', error);
                // Método alternativo si toCanvas falla
                QRCode.toDataURL(qr, { width: 300, margin: 1 }, (err, url) => {
                    if (err) {
                        console.error('Error al generar QR con toDataURL:', err);
                        // Último recurso: mostrar el texto del QR
                        qrCode.textContent = 'Error al generar QR. Consulta los logs.';
                    } else {
                        const img = document.createElement('img');
                        img.src = url;
                        img.width = 300;
                        qrCode.innerHTML = '';
                        qrCode.appendChild(img);
                    }
                });
            }
        });
    } catch (e) {
        console.error('Error general al generar QR:', e);
        qrCode.textContent = 'Error al generar QR. Por favor recarga la página.';
    }
});

// Escuchar evento cuando el cliente está listo
socket.on('ready', (data) => {
    console.log('Cliente WhatsApp listo:', data);
    updateConnectionStatus('connected', 'Conectado a WhatsApp');
    connectionInfo.textContent = 'La sesión está activa';
    
    // Limpiar el contenedor de QR
    qrCode.innerHTML = '';
});

// Escuchar evento de desconexión de WhatsApp
socket.on('disconnected', (data) => {
    console.log('WhatsApp desconectado:', data);
    updateConnectionStatus('disconnected', 'Desconectado de WhatsApp');
    connectionInfo.textContent = data.reason || 'La sesión ha finalizado';
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

// Manejar envío de mensaje
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