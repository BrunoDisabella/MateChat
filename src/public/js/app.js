// app.js - Cliente para la interfaz de MateChat

// Estado global de la aplicación
const appState = {
  connected: false,
  selectedConversation: null,
  conversations: [],
  messages: {},
  businessInfo: null,
  apiSettings: {
    apiUrl: 'https://graph.facebook.com/v19.0',
    appId: '1157968849126039',
    appSecret: 'e173f3786a59318a4239dfa265d39bff',
    accessToken: '5af85ca86531c3d789f8b5c0bfa41f47',
    phoneNumberId: ''
  },
  filteredConversations: []
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
const searchInput = document.getElementById('searchInput');
const newChatButton = document.getElementById('newChatButton');
const settingsButton = document.getElementById('settingsButton');

// Modales
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const apiSettingsForm = document.getElementById('apiSettingsForm');
const newChatModal = document.getElementById('newChatModal');
const closeNewChatModal = document.getElementById('closeNewChatModal');
const newChatForm = document.getElementById('newChatForm');

// Inicializar la aplicación
function initializeApp() {
  // Cargar configuración guardada
  loadApiSettings();
  
  // Comprobar estado de conexión al cargar
  checkConnectionStatus();
  
  // Configurar manejadores de eventos para la interfaz principal
  connectButton.addEventListener('click', connectWhatsApp);
  disconnectButton.addEventListener('click', disconnectWhatsApp);
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Eventos para búsqueda
  searchInput.addEventListener('input', filterConversations);
  
  // Eventos para nuevo chat
  newChatButton.addEventListener('click', openNewChatModal);
  closeNewChatModal.addEventListener('click', () => {
    newChatModal.style.display = 'none';
  });
  newChatForm.addEventListener('submit', handleNewChat);
  
  // Eventos para configuración
  settingsButton.addEventListener('click', openSettingsModal);
  closeSettingsModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  apiSettingsForm.addEventListener('submit', saveApiSettings);
  
  // Eventos para navegación en mobile
  document.querySelector('.back-button').addEventListener('click', () => {
    document.querySelector('.content').classList.remove('show-chat');
  });
  
  // Cerrar modales al hacer clic fuera
  window.addEventListener('click', (event) => {
    if (event.target === newChatModal) {
      newChatModal.style.display = 'none';
    }
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  // Configurar actualización automática de conversaciones
  setInterval(updateConversations, 30000); // Cada 30 segundos
}

// Cargar configuración de API
function loadApiSettings() {
  const savedSettings = localStorage.getItem('apiSettings');
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      appState.apiSettings = { ...appState.apiSettings, ...settings };
      
      // Actualizar formulario de configuración
      document.getElementById('apiUrl').value = appState.apiSettings.apiUrl || '';
      document.getElementById('appId').value = appState.apiSettings.appId || '';
      document.getElementById('appSecret').value = appState.apiSettings.appSecret || '';
      document.getElementById('accessToken').value = appState.apiSettings.accessToken || '';
      document.getElementById('phoneNumberId').value = appState.apiSettings.phoneNumberId || '';
    } catch (error) {
      console.error('Error al cargar configuración de API:', error);
    }
  }
}

// Guardar configuración de API
function saveApiSettings(event) {
  event.preventDefault();
  
  const formData = new FormData(apiSettingsForm);
  const newSettings = {
    apiUrl: formData.get('apiUrl'),
    appId: formData.get('appId'),
    appSecret: formData.get('appSecret'),
    accessToken: formData.get('accessToken'),
    phoneNumberId: formData.get('phoneNumberId')
  };
  
  appState.apiSettings = newSettings;
  
  // Guardar en localStorage
  localStorage.setItem('apiSettings', JSON.stringify(newSettings));
  
  // Cerrar modal
  settingsModal.style.display = 'none';
  
  // Mostrar notificación
  showNotification('Configuración guardada', 'Los ajustes de API han sido guardados correctamente');
  
  // Reconectar si estaba conectado
  if (appState.connected) {
    connectWhatsApp();
  }
}

// Abrir modal de configuración
function openSettingsModal() {
  // Actualizar valores del formulario con la configuración actual
  document.getElementById('apiUrl').value = appState.apiSettings.apiUrl || '';
  document.getElementById('appId').value = appState.apiSettings.appId || '';
  document.getElementById('appSecret').value = appState.apiSettings.appSecret || '';
  document.getElementById('accessToken').value = appState.apiSettings.accessToken || '';
  document.getElementById('phoneNumberId').value = appState.apiSettings.phoneNumberId || '';
  
  settingsModal.style.display = 'block';
}

// Abrir modal de nuevo chat
function openNewChatModal() {
  // Limpiar el formulario
  newChatForm.reset();
  newChatModal.style.display = 'block';
}

// Manejar nuevo chat
function handleNewChat(event) {
  event.preventDefault();
  
  const formData = new FormData(newChatForm);
  const phone = formData.get('recipientPhone').trim();
  const name = formData.get('recipientName').trim() || `Contacto ${phone}`;
  const firstMessage = formData.get('firstMessage').trim();
  
  if (!phone) {
    showNotification('Error', 'El número de teléfono es obligatorio', 'error');
    return;
  }
  
  // Crear nueva conversación
  const newConversationId = `new-${Date.now()}`;
  const newConversation = {
    id: newConversationId,
    contact: {
      name: name,
      phone: phone
    },
    lastMessage: {
      text: firstMessage || '(Sin mensajes)',
      timestamp: new Date().toISOString(),
      direction: 'outbound'
    }
  };
  
  // Agregar a conversaciones
  appState.conversations.unshift(newConversation);
  appState.filteredConversations = [...appState.conversations];
  renderConversations(appState.filteredConversations);
  
  // Seleccionar la nueva conversación
  selectConversation(newConversationId);
  
  // Si hay mensaje inicial, enviarlo
  if (firstMessage) {
    messageInput.value = firstMessage;
    sendMessage();
  }
  
  // Cerrar modal
  newChatModal.style.display = 'none';
  
  // En móvil, mostrar chat
  if (window.innerWidth <= 768) {
    document.querySelector('.content').classList.add('show-chat');
  }
}

// Filtrar conversaciones
function filterConversations() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (!searchTerm) {
    appState.filteredConversations = [...appState.conversations];
  } else {
    appState.filteredConversations = appState.conversations.filter(conversation => {
      return (
        conversation.contact.name.toLowerCase().includes(searchTerm) ||
        conversation.contact.phone.toLowerCase().includes(searchTerm) ||
        conversation.lastMessage.text.toLowerCase().includes(searchTerm)
      );
    });
  }
  
  renderConversations(appState.filteredConversations);
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
    
    // Enviar configuración actual con la conexión
    const response = await fetch('/api/whatsapp/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiSettings: appState.apiSettings
      })
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
  appState.filteredConversations = [];
  
  updateConnectionUI(false);
  renderConversations([]);
  renderMessages([]);
  
  showNotification('Desconectado', 'Sesión finalizada correctamente');
}

// Actualizar UI basada en el estado de conexión
function updateConnectionUI(connected) {
  if (connected) {
    statusIndicator.textContent = 'Conectado';
    statusIndicator.className = 'status-indicator status-connected';
    connectButton.style.display = 'none';
    disconnectButton.style.display = 'block';
    
    if (appState.businessInfo && appState.businessInfo.name) {
      businessName.textContent = appState.businessInfo.name;
    }
  } else {
    statusIndicator.textContent = 'Desconectado';
    statusIndicator.className = 'status-indicator status-disconnected';
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
      appState.filteredConversations = [...appState.conversations];
      
      // Conservar filtro actual si hay
      if (searchInput.value.trim()) {
        filterConversations();
      } else {
        renderConversations(appState.filteredConversations);
      }
      
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
    if (!appState.connected) {
      emptyItem.textContent = 'Conecta tu cuenta de WhatsApp Business para ver las conversaciones';
    } else if (searchInput.value.trim()) {
      emptyItem.textContent = 'No se encontraron conversaciones';
    } else {
      emptyItem.textContent = 'No hay conversaciones';
    }
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
      
      // En móvil, mostrar chat
      if (window.innerWidth <= 768) {
        document.querySelector('.content').classList.add('show-chat');
      }
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
  
  const conversation = appState.conversations.find(c => c.id === conversationId);
  
  if (conversation) {
    // Actualizar información de contacto en el chat
    document.querySelector('.contact-header-name').textContent = conversation.contact.name;
    document.querySelector('.contact-status').textContent = conversation.contact.phone;
    
    // Seleccionar en la lista
    const selectedItem = Array.from(document.querySelectorAll('.conversation-item')).find(
      item => item.querySelector('.contact-phone').textContent === conversation.contact.phone
    );
    
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // Obtener mensajes
    updateMessages(conversationId);
  }
}

// Obtener y actualizar mensajes de una conversación
async function updateMessages(conversationId) {
  try {
    const response = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`);
    const data = await response.json();
    
    if (data.success) {
      appState.messages[conversationId] = data.data.messages;
      renderMessages(data.data.messages);
      
      // Actualizar contador de mensajes
      document.querySelector('.contact-status').textContent = 
        `${data.data.messages.length} mensaje${data.data.messages.length !== 1 ? 's' : ''}`;
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
      
      // Actualizar último mensaje en la lista de conversaciones
      const conversationIndex = appState.conversations.findIndex(c => c.id === appState.selectedConversation);
      if (conversationIndex !== -1) {
        appState.conversations[conversationIndex].lastMessage = {
          text,
          timestamp: new Date().toISOString(),
          direction: 'outbound'
        };
        
        // Mover conversación al principio de la lista
        const conversation = appState.conversations.splice(conversationIndex, 1)[0];
        appState.conversations.unshift(conversation);
        
        // Actualizar lista filtrada
        if (searchInput.value.trim()) {
          filterConversations();
        } else {
          appState.filteredConversations = [...appState.conversations];
          renderConversations(appState.filteredConversations);
        }
      }
      
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
  console.log(`[${type}] ${title}: ${message}`);
  
  // Crear elemento para notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const titleEl = document.createElement('div');
  titleEl.className = 'notification-title';
  titleEl.textContent = title;
  
  const messageEl = document.createElement('div');
  messageEl.className = 'notification-message';
  messageEl.textContent = message;
  
  notification.appendChild(titleEl);
  notification.appendChild(messageEl);
  
  // Agregar al DOM
  document.body.appendChild(notification);
  
  // Mostrar con animación
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remover después de 5 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Formatear timestamp a hora legible
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeApp);

// Agregar estilos para notificaciones
const style = document.createElement('style');
style.textContent = `
  .notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 20px;
    background-color: white;
    border-left: 4px solid #128C7E;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-radius: 4px;
    max-width: 350px;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 1000;
  }
  
  .notification.show {
    transform: translateY(0);
    opacity: 1;
  }
  
  .notification-title {
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .notification-info {
    border-left-color: #128C7E;
  }
  
  .notification-error {
    border-left-color: #f44336;
  }
`;
document.head.appendChild(style);