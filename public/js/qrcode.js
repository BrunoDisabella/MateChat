document.addEventListener('DOMContentLoaded', function() {
  // Connect to Socket.io server with auto reconnection (improved settings)
  const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 60000
  });
  const qrCodeElement = document.getElementById('qr-code');
  const phoneLoginButton = document.getElementById('phone-login');
  const disconnectButton = document.getElementById('disconnect-btn');
  
  // Estado global para evitar múltiples inicializaciones
  let hasInitialized = false;
  
  // Socket connection events
  socket.on('connect', function() {
    console.log('Socket connected');
    // Solo inicializar una vez para evitar múltiples solicitudes
    if (!hasInitialized) {
      hasInitialized = true;
      socket.emit('initWhatsApp');
    }
  });
  
  socket.on('connect_error', function(error) {
    console.error('Connection error:', error);
    qrCodeElement.innerHTML = '<div class="error-message">Error de conexión con el servidor</div>';
  });
  
  socket.on('reconnect', function(attemptNumber) {
    console.log('Reconnected after ' + attemptNumber + ' attempts');
    // No reinicializar automáticamente en reconexión para evitar desconexiones
  });
  
  // Botón de desconexión
  disconnectButton.addEventListener('click', function(e) {
    e.preventDefault();
    // Mostrar mensaje de desconexión en proceso
    qrCodeElement.innerHTML = '<div class="authenticating">Desconectando WhatsApp Web...</div>';
    // Enviar evento al servidor para desconectar
    socket.emit('disconnectWhatsApp');
  });
  
  // Manejar respuesta de desconexión exitosa
  socket.on('disconnectSuccess', function(data) {
    console.log('Desconexión exitosa:', data.message);
    qrCodeElement.innerHTML = '<div class="disconnected">Desconectado de WhatsApp Web</div>';
    // Reiniciar el estado para permitir una nueva inicialización
    hasInitialized = false;
    // Agregar botón para volver a conectar
    qrCodeElement.innerHTML += '<div class="reconnect-btn"><button id="reconnect-btn">Volver a conectar</button></div>';
    
    // Agregar evento al botón de reconexión
    document.getElementById('reconnect-btn').addEventListener('click', function() {
      qrCodeElement.innerHTML = '<div class="loading">Cargando código QR...</div>';
      hasInitialized = true;
      socket.emit('initWhatsApp');
    });
  });
  
  // Handle QR code received
  socket.on('qrCode', function(data) {
    if (data.qrCode) {
      qrCodeElement.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
    }
  });
  
  // Handle client ready event (when QR code is scanned and authenticated)
  socket.on('clientReady', function() {
    qrCodeElement.innerHTML = '<div class="success-message">¡Conectado correctamente!</div>';
    
    // Redirigir automáticamente a la página de chat
    setTimeout(function() {
      window.location.href = '/chat';
    }, 2000);
  });
  
  // Handle authentication event
  socket.on('authenticated', function() {
    qrCodeElement.innerHTML = '<div class="authenticating">Autenticando...</div>';
  });
  
  // Handle authentication failure
  socket.on('authFailure', function(data) {
    qrCodeElement.innerHTML = `<div class="error-message">Error de autenticación: ${data.error}</div>`;
  });
  
  // Handle initialization error
  socket.on('initError', function(data) {
    qrCodeElement.innerHTML = `<div class="error-message">Error de inicialización: ${data.error}</div>`;
    // Reiniciar estado para permitir reintentar
    hasInitialized = false;
  });
  
  // Handle disconnected event
  socket.on('disconnected', function(data) {
    console.log('WhatsApp client disconnected:', data.reason);
    qrCodeElement.innerHTML = `<div class="error-message">Desconectado: ${data.reason}</div>`;
    
    // Ocultar panel de webhook
    document.getElementById('webhook-panel').classList.add('hidden');
    
    // Reiniciar el estado para permitir una nueva inicialización
    hasInitialized = false;
    
    // Agregar botón para volver a conectar
    qrCodeElement.innerHTML += '<div class="reconnect-btn"><button id="reconnect-btn">Volver a conectar</button></div>';
    
    // Agregar evento al botón de reconexión
    setTimeout(() => {
      const reconnectBtn = document.getElementById('reconnect-btn');
      if (reconnectBtn) {
        reconnectBtn.addEventListener('click', function() {
          qrCodeElement.innerHTML = '<div class="loading">Cargando código QR...</div>';
          hasInitialized = true;
          socket.emit('initWhatsApp');
        });
      }
    }, 100);
  });
  
  // Phone login button event (placeholder functionality)
  phoneLoginButton.addEventListener('click', function(e) {
    e.preventDefault();
    alert('Esta funcionalidad no está disponible en esta versión de demostración.');
  });
  
  // Webhook functionality
  const saveWebhookBtn = document.getElementById('save-webhook');
  const webhookUrlInput = document.getElementById('webhook-url');
  const webhookStatusElement = document.getElementById('webhook-status');
  
  // Guardar webhook
  saveWebhookBtn.addEventListener('click', function() {
    const url = webhookUrlInput.value.trim();
    
    if (!url) {
      alert('Por favor ingresa una URL válida');
      return;
    }
    
    // Enviar la URL del webhook al servidor
    socket.emit('setWebhook', { url: url });
  });
  
  // Respuesta del servidor al guardar webhook
  socket.on('webhookSet', function(data) {
    if (data.success) {
      webhookStatusElement.textContent = 'Configurado: ' + data.url;
      webhookStatusElement.className = 'status-configured';
    } else {
      webhookStatusElement.textContent = 'Error: ' + data.error;
      webhookStatusElement.className = 'status-error';
    }
  });
});