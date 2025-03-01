// app.js - Cliente para la interfaz de MateChat

// Estado global de la aplicación
const appState = {
  connected: false,
  selectedConversation: null,
  conversations: [],
  messages: {},
  businessInfo: null
};

// Elementos DOM
const conversationsList = document.getElementById('conversationsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const statusIndicator = document.getElementById('statusIndicator');
const businessName = document.getElementById('businessName');

// Inicializar la aplicación
function initializeApp() {
  // Comprobar estado de conexión al cargar
  checkConnectionStatus();
  
  // Configurar manejadores de eventos
  connectButton.addEventListener('click', connectWhatsApp);
  disconnectButton.addEventListener('click', disconnectWhatsApp);
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Configurar actualización automática de conversaciones
  setInterval(updateConversations, 30000); // Cada 30 segundos
}

// Comprobar estado de conexión
async function checkConnectionStatus() {
  try {
    const response = await fetch('/api/whatsapp/status');
    const data = await response.json();
    
    if (data.success && data.connected) {
      appState.connected = true;
      appState.businessInfo = data.businessInfo;
      updateConnectionUI(true);
      updateConversations();
    } else {
      updateConnectionUI(false);
    }
  } catch (error) {
    console.error('Error al comprobar estado:', error);
    updateConnectionUI(false);
  }
}

// Conectar a WhatsApp Business API
async function connectWhatsApp() {
  try {
    statusIndicator.textContent = 'Conectando...';
    connectButton.disabled = true;
    
    const response = await fetch('/api/whatsapp/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      appState.connected = true;
      appState.businessInfo = data.businessInfo;
      updateConnectionUI(true);
      updateConversations();
      
      // Mostrar notificación
      showNotification('Conexión exitosa', 'Conectado a WhatsApp Business API');
    } else {
      updateConnectionUI(false);
      showNotification('Error de conexión', data.error, 'error');
    }
  } catch (error) {
    console.error('Error al conectar:', error);
    updateConnectionUI(false);
    showNotification('Error de conexión', error.message, 'error');
  } finally {
    connectButton.disabled = false;
  }
}

// Desconectar de WhatsApp Business API
function disconnectWhatsApp() {
  // Simular desconexión (en una implementación real, harías una llamada a la API)
  appState.connected = false;
  appState.businessInfo = null;
  appState.conversations = [];
  appState.messages = {};
  appState.selectedConversation = null;
  
  updateConnectionUI(false);
  renderConversations([]);
  renderMessages([]);
  
  showNotification('Desconectado', 'Sesión finalizada correctamente');
}

// Actualizar UI basada en el estado de conexión
function updateConnectionUI(connected) {
  if (connected) {
    statusIndicator.textContent = 'Conectado';
    statusIndicator.className = 'status-connected';
    connectButton.style.display = 'none';
    disconnectButton.style.display = 'block';
    
    if (appState.businessInfo && appState.businessInfo.name) {
      businessName.textContent = appState.businessInfo.name;
    }
  } else {
    statusIndicator.textContent = 'Desconectado';
    statusIndicator.className = 'status-disconnected';
    connectButton.style.display = 'block';
    disconnectButton.style.display = 'none';
    businessName.textContent = 'MateChat';
  }
}

// Obtener y actualizar lista de conversaciones
async function updateConversations() {
  if (!appState.connected) return;
  
  try {
    const response = await fetch('/api/whatsapp/conversations');
    const data = await response.json();
    
    if (data.success) {
      appState.conversations = data.data.conversations;
      renderConversations(appState.conversations);
      
      // Si hay una conversación seleccionada, actualizar mensajes
      if (appState.selectedConversation) {
        updateMessages(appState.selectedConversation);
      }
    }
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
  }
}

// Renderizar lista de conversaciones
function renderConversations(conversations) {
  conversationsList.innerHTML = '';
  
  if (conversations.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'conversation-item empty';
    emptyItem.textContent = 'No hay conversaciones';
    conversationsList.appendChild(emptyItem);
    return;
  }
  
  conversations.forEach(conversation => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    if (appState.selectedConversation === conversation.id) {
      item.classList.add('selected');
    }
    
    const contactInfo = document.createElement('div');
    contactInfo.className = 'contact-info';
    
    const name = document.createElement('div');
    name.className = 'contact-name';
    name.textContent = conversation.contact.name;
    
    const phone = document.createElement('div');
    phone.className = 'contact-phone';
    phone.textContent = conversation.contact.phone;
    
    const lastMessage = document.createElement('div');
    lastMessage.className = 'last-message';
    lastMessage.textContent = conversation.lastMessage.text;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(conversation.lastMessage.timestamp);
    
    contactInfo.appendChild(name);
    contactInfo.appendChild(phone);
    item.appendChild(contactInfo);
    item.appendChild(lastMessage);
    item.appendChild(time);
    
    item.addEventListener('click', () => {
      selectConversation(conversation.id);
    });
    
    conversationsList.appendChild(item);
  });
}

// Seleccionar una conversación
function selectConversation(conversationId) {
  appState.selectedConversation = conversationId;
  
  // Actualizar UI
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = Array.from(document.querySelectorAll('.conversation-item')).find(
    item => item.querySelector('.contact-phone').textContent === 
      appState.conversations.find(c => c.id === conversationId)?.contact.phone
  );
  
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
  
  // Obtener mensajes
  updateMessages(conversationId);
}

// Obtener y actualizar mensajes de una conversación
async function updateMessages(conversationId) {
  try {
    const response = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`);
    const data = await response.json();
    
    if (data.success) {
      appState.messages[conversationId] = data.data.messages;
      renderMessages(data.data.messages);
    }
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
  }
}

// Renderizar mensajes
function renderMessages(messages) {
  messagesContainer.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-messages';
    emptyMessage.textContent = 'No hay mensajes en esta conversación';
    messagesContainer.appendChild(emptyMessage);
    return;
  }
  
  messages.forEach(message => {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.direction === 'outbound' ? 'sent' : 'received'}`;
    
    const textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.textContent = message.text;
    
    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = formatTime(message.timestamp);
    
    messageEl.appendChild(textEl);
    messageEl.appendChild(timeEl);
    messagesContainer.appendChild(messageEl);
  });
  
  // Scroll al último mensaje
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Enviar un mensaje
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !appState.selectedConversation) return;
  
  try {
    const conversation = appState.conversations.find(c => c.id === appState.selectedConversation);
    if (!conversation) return;
    
    const to = conversation.contact.phone;
    
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        message: text
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Agregar mensaje localmente (optimistic UI)
      const newMessage = {
        id: `local-${Date.now()}`,
        text,
        timestamp: new Date().toISOString(),
        direction: 'outbound'
      };
      
      if (!appState.messages[appState.selectedConversation]) {
        appState.messages[appState.selectedConversation] = [];
      }
      
      appState.messages[appState.selectedConversation].push(newMessage);
      renderMessages(appState.messages[appState.selectedConversation]);
      
      // Limpiar input
      messageInput.value = '';
    } else {
      showNotification('Error al enviar', data.error, 'error');
    }
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    showNotification('Error al enviar', error.message, 'error');
  }
}

// Mostrar notificación
function showNotification(title, message, type = 'info') {
  // Implementación básica de notificaciones (en una app real usarías un componente de notificaciones)
  console.log(`[${type}] ${title}: ${message}`);
  alert(`${title}: ${message}`);
}

// Formatear timestamp a hora legible
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeApp);