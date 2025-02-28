document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const chatList = document.getElementById('chat-list');
  const welcomeScreen = document.getElementById('welcome-screen');
  const chatWindow = document.getElementById('chat-window');
  const messagesContainer = document.getElementById('messages-container');
  const messageText = document.getElementById('message-text');
  const sendMessageButton = document.getElementById('send-message');
  const chatContactName = document.getElementById('chat-contact-name');
  const chatContactStatus = document.getElementById('chat-contact-status');
  const chatContactAvatar = document.getElementById('chat-contact-avatar');
  const openSettingsButton = document.getElementById('open-settings');
  const closeSettingsButton = document.getElementById('close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const webhookUrlInput = document.getElementById('webhook-url');
  const saveWebhookButton = document.getElementById('save-webhook');
  const searchInput = document.getElementById('search-input');
  const statusButton = document.querySelector('.status-btn');
  const tagButton = document.querySelector('.tag-btn');
  const newChatButton = document.querySelector('.new-chat-btn');
  const tagList = document.getElementById('tag-list');
  const addNewTagButton = document.getElementById('add-new-tag');
  const tagEditModal = document.getElementById('tag-edit-modal');
  const closeTagModalButton = document.getElementById('close-tag-modal');
  const saveTagButton = document.getElementById('save-tag');
  const deleteTagButton = document.getElementById('delete-tag');
  const logoutButton = document.getElementById('logout-btn');
  const connectionStatus = document.getElementById('connection-status');
  const backToChatsButton = document.getElementById('back-to-chats');
  const chatOptionsBtn = document.getElementById('chat-options-btn');
  const sidebar = document.querySelector('.sidebar');
  
  // Connect to Socket.io server
  const socket = io();
  
  // Variables
  let currentChatId = null;
  let chats = [];
  let pinnedChats = JSON.parse(localStorage.getItem('pinnedChats') || '[]');
  let tags = JSON.parse(localStorage.getItem('chatTags') || '[]');
  let chatTags = JSON.parse(localStorage.getItem('chatTagAssignments') || '{}');
  let searchResults = [];
  let contextMenu = null;
  
  // Inicializar
  socket.emit('getChats');
  
  // Configurar actualización periódica cada 10 segundos
  const autoRefreshInterval = setInterval(() => {
    if (currentChatId) {
      console.log('Actualizando mensajes automáticamente...');
      socket.emit('getChatMessages', { chatId: currentChatId, limit: 50 });
    }
    socket.emit('getChats');
  }, 10000);
  
  // Funcionalidad de búsqueda de chats
  const searchContainer = document.querySelector('.search-container');
  let searchResultsDiv = document.createElement('div');
  searchResultsDiv.className = 'search-results';
  searchContainer.appendChild(searchResultsDiv);
  
  // Escuchar eventos de entrada en la búsqueda
  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    
    if (query.length < 1) {
      searchResultsDiv.classList.remove('visible');
      return;
    }
    
    // Filtrar chats que coincidan con la búsqueda
    searchResults = chats.filter(chat => {
      const matchName = chat.name && chat.name.toLowerCase().includes(query);
      const matchLastMessage = chat.lastMessage && chat.lastMessage.body && 
                              chat.lastMessage.body.toLowerCase().includes(query);
      
      return matchName || matchLastMessage;
    });
    
    // Mostrar resultados sin encabezado
    if (searchResults.length > 0) {
      searchResultsDiv.innerHTML = '';
      renderChatList(searchResults);
      searchResultsDiv.classList.add('visible');
    } else {
      searchResultsDiv.innerHTML = '';
      searchResultsDiv.classList.remove('visible');
    }
  });
  
  // Cerrar resultados de búsqueda cuando se hace clic fuera
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResultsDiv.contains(e.target)) {
      searchResultsDiv.classList.remove('visible');
    }
  });
  
  // Al presionar Escape, cerrar la búsqueda
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchResultsDiv.classList.remove('visible');
    }
  });
  
  // Handle chats retrieved
  socket.on('chats', function(data) {
    console.log('Chats recibidos:', data.chats ? data.chats.length : 0);
    chats = data.chats || [];
    renderChatList();
  });
  
  // Handle chats update (con fotos de perfil)
  socket.on('chatsUpdate', function(data) {
    console.log('Actualización de chats recibida:', data.chats ? data.chats.length : 0);
    // Actualizar solo los chats que recibieron foto de perfil
    if (data.chats && data.chats.length > 0) {
      data.chats.forEach(updatedChat => {
        const index = chats.findIndex(c => c.id === updatedChat.id);
        if (index !== -1) {
          chats[index] = updatedChat;
        }
      });
      renderChatList();
    }
  });
  
  // Guardar la foto de mi propio perfil
  socket.on('myProfilePic', function(data) {
    console.log('Mi foto de perfil recibida');
    if (data.profilePicUrl) {
      localStorage.setItem('myProfilePic', data.profilePicUrl);
      // Actualizar avatar en la interfaz si existe
      const myAvatar = document.querySelector('.user-profile .avatar img');
      if (myAvatar) {
        myAvatar.src = data.profilePicUrl;
      }
    }
  });
  
  // Manejar actualizaciones individuales de chats (para fotos de perfil)
  socket.on('chatUpdate', function(data) {
    console.log('Actualización individual de chat recibida:', data.chat ? data.chat.name : 'desconocido');
    if (data.chat) {
      const index = chats.findIndex(c => c.id === data.chat.id);
      if (index !== -1) {
        chats[index] = data.chat;
        renderChatList();
      }
    }
  });
  
  // Función para renderizar el listado de chats
  function renderChatList(chatArray = null) {
    // Si no se proporciona un array, usar chats normales con ordenamiento de pines
    const chatsToRender = chatArray || [...chats];
    
    if (chatsToRender.length === 0) {
      chatList.innerHTML = '<div class="empty-list"><p>No hay chats disponibles</p></div>';
      return;
    }
    
    chatList.innerHTML = '';
    
    // Ordenar chats: primero los fijados y luego por fecha
    chatsToRender.sort((a, b) => {
      // Si ambos están fijados o ninguno está fijado, ordenar por fecha
      const aPinned = pinnedChats.includes(a.id);
      const bPinned = pinnedChats.includes(b.id);
      
      if (aPinned === bPinned) {
        const aTime = a.lastMessage ? a.lastMessage.timestamp : 0;
        const bTime = b.lastMessage ? b.lastMessage.timestamp : 0;
        return bTime - aTime; // Orden descendente por tiempo
      }
      
      // Si solo uno está fijado, ese va primero
      return aPinned ? -1 : 1;
    });
    
    chatsToRender.forEach(chat => {
      const lastMessageTime = chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000) : new Date();
      const timeString = lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isPinned = pinnedChats.includes(chat.id);
      
      const chatItem = document.createElement('div');
      chatItem.className = `chat-item ${isPinned ? 'pinned' : ''}`;
      chatItem.dataset.chatId = chat.id;
      
      // Usar imagen de perfil si está disponible
      const profilePic = chat.profilePicUrl ? chat.profilePicUrl : '/images/default-avatar.png';
      
      // Formatear el último mensaje según su tipo
      let lastMessageText = 'No messages yet';
      if (chat.lastMessage) {
        if (chat.lastMessage.hasMedia) {
          if (chat.lastMessage.type === 'audio') {
            lastMessageText = '🎵 Audio message';
          } else if (chat.lastMessage.type === 'image') {
            lastMessageText = '📷 Image';
          } else if (chat.lastMessage.type === 'video') {
            lastMessageText = '🎬 Video';
          } else if (chat.lastMessage.type === 'document') {
            lastMessageText = '📄 Document';
          } else {
            lastMessageText = '📎 Media message';
          }
        } else {
          lastMessageText = chat.lastMessage.body;
        }
      }
      
      // Obtener etiquetas para este chat
      const chatTagIds = chatTags[chat.id] || [];
      let tagElements = '';
      if (chatTagIds.length > 0) {
        tagElements = chatTagIds.map(tagId => {
          const tag = tags.find(t => t.id === tagId);
          if (tag) {
            return `<span class="chat-tag" style="background-color: ${tag.color}">${tag.name}</span>`;
          }
          return '';
        }).join('');
      }
      
      // Indicador de pin
      const pinIndicator = isPinned ? '<div class="pin-indicator">📌</div>' : '';
      
      chatItem.innerHTML = `
        ${pinIndicator}
        <div class="avatar">
          <img src="${profilePic}" alt="Contact" onerror="this.src='/images/default-avatar.png'">
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <div>
              ${tagElements}
              <span class="chat-name">${chat.name || 'Unknown Contact'}</span>
            </div>
            <span class="chat-time">${timeString}</span>
          </div>
          <div class="chat-message">
            ${lastMessageText}
          </div>
        </div>
      `;
      
      // Eventos de click
      chatItem.addEventListener('click', function(e) {
        openChat(chat.id);
      });
      
      // Evento de click derecho para menú contextual
      chatItem.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showContextMenu(e, chat);
      });
      
      chatList.appendChild(chatItem);
    });
  }
  
  // Mostrar el menú contextual
  function showContextMenu(e, chat) {
    // Remover menú contextual previo si existe
    if (contextMenu) {
      document.body.removeChild(contextMenu);
    }
    
    const isPinned = pinnedChats.includes(chat.id);
    
    // Crear nuevo menú contextual
    contextMenu = document.createElement('div');
    contextMenu.className = 'chat-context-menu';
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.left = `${e.pageX}px`;
    
    // Crear opciones del menú
    const pinUnpinItem = document.createElement('div');
    pinUnpinItem.className = 'context-menu-item';
    pinUnpinItem.innerHTML = `<span class="context-menu-icon">${isPinned ? '✖️' : '📌'}</span> ${isPinned ? 'Desfijar' : 'Fijar chat'}`;
    pinUnpinItem.addEventListener('click', () => {
      togglePinChat(chat.id);
      document.body.removeChild(contextMenu);
      contextMenu = null;
    });
    
    const tagItem = document.createElement('div');
    tagItem.className = 'context-menu-item';
    tagItem.innerHTML = '<span class="context-menu-icon">🏷️</span> Etiquetar chat';
    
    // Submenú para etiquetas
    const tagSelector = document.createElement('div');
    tagSelector.className = 'tag-selector';
    tagSelector.style.display = 'none';
    
    // Añadir etiquetas al selector
    if (tags.length > 0) {
      tags.forEach(tag => {
        const chatTagIds = chatTags[chat.id] || [];
        const isApplied = chatTagIds.includes(tag.id);
        
        const tagItem = document.createElement('div');
        tagItem.className = `tag-selector-item ${isApplied ? 'tag-applied' : ''}`;
        tagItem.innerHTML = `
          <span class="tag-selector-color" style="background-color: ${tag.color}"></span>
          <span>${tag.name}</span>
        `;
        
        tagItem.addEventListener('click', () => {
          toggleTagOnChat(chat.id, tag.id);
          document.body.removeChild(contextMenu);
          contextMenu = null;
        });
        
        tagSelector.appendChild(tagItem);
      });
    } else {
      const noTagsItem = document.createElement('div');
      noTagsItem.className = 'tag-selector-item';
      noTagsItem.textContent = 'No hay etiquetas creadas';
      tagSelector.appendChild(noTagsItem);
    }
    
    // Mostrar selector de etiquetas al hacer hover
    tagItem.addEventListener('mouseenter', () => {
      tagSelector.style.display = 'block';
    });
    
    tagItem.addEventListener('mouseleave', (e) => {
      // Solo ocultar si el ratón no entró al selector
      if (!e.relatedTarget || !tagSelector.contains(e.relatedTarget)) {
        tagSelector.style.display = 'none';
      }
    });
    
    tagSelector.addEventListener('mouseleave', () => {
      tagSelector.style.display = 'none';
    });
    
    // Agregar opciones al menú
    contextMenu.appendChild(pinUnpinItem);
    contextMenu.appendChild(tagItem);
    contextMenu.appendChild(tagSelector);
    
    // Agregar menú al DOM
    document.body.appendChild(contextMenu);
    
    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', function closeMenu(e) {
      if (!contextMenu.contains(e.target)) {
        if (contextMenu && contextMenu.parentNode) {
          document.body.removeChild(contextMenu);
          contextMenu = null;
        }
        document.removeEventListener('click', closeMenu);
      }
    });
  }
  
  // Función para fijar/desfijar un chat
  function togglePinChat(chatId) {
    const index = pinnedChats.indexOf(chatId);
    
    if (index === -1) {
      // Fijar el chat
      pinnedChats.push(chatId);
    } else {
      // Desfijar el chat
      pinnedChats.splice(index, 1);
    }
    
    // Guardar en localStorage
    localStorage.setItem('pinnedChats', JSON.stringify(pinnedChats));
    
    // Actualizar la UI
    renderChatList();
  }
  
  // Función para aplicar/quitar etiqueta de un chat
  function toggleTagOnChat(chatId, tagId) {
    // Inicializar el array de etiquetas para este chat si no existe
    if (!chatTags[chatId]) {
      chatTags[chatId] = [];
    }
    
    const index = chatTags[chatId].indexOf(tagId);
    
    if (index === -1) {
      // Aplicar etiqueta
      chatTags[chatId].push(tagId);
    } else {
      // Quitar etiqueta
      chatTags[chatId].splice(index, 1);
    }
    
    // Guardar en localStorage
    localStorage.setItem('chatTagAssignments', JSON.stringify(chatTags));
    
    // Actualizar la UI
    renderChatList();
  }
  
  // Open a chat
  function openChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    // Update chat window header
    chatContactName.textContent = chat.name || 'Unknown Contact';
    chatContactStatus.textContent = chat.isGroup ? 'Group Chat' : 'en línea';
    
    // Actualizar avatar si está disponible
    if (chat.profilePicUrl) {
      chatContactAvatar.src = chat.profilePicUrl;
    } else {
      chatContactAvatar.src = '/images/default-avatar.png';
    }
    
    // Show chat window
    welcomeScreen.classList.add('hidden');
    chatWindow.classList.remove('hidden');
    
    // En dispositivos móviles, ocultar la barra lateral
    if (window.innerWidth <= 768) {
      sidebar.classList.add('hidden');
    }
    
    // Get messages for this chat
    socket.emit('getChatMessages', { chatId, limit: 50 });
  }
  
  // Handle chat messages retrieved
  socket.on('chatMessages', function(data) {
    if (data.chatId !== currentChatId) return;
    
    const messages = data.messages || [];
    renderMessages(messages);
  });
  
  // Render messages
  function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
      messagesContainer.innerHTML = '<div class="empty-messages">No hay mensajes</div>';
      return;
    }
    
    messages.forEach(msg => {
      const isOutgoing = msg.from !== currentChatId;
      const messageTime = new Date(msg.timestamp * 1000);
      const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const messageElement = document.createElement('div');
      messageElement.className = `message ${isOutgoing ? 'message-out' : 'message-in'}`;
      
      // Contenido según el tipo de mensaje
      let messageContent = '';
      
      if (msg.hasMedia && msg.mediaUrl) {
        if (msg.mimetype && msg.mimetype.startsWith('audio')) {
          // Audio con compatibilidad mejorada
          messageContent = `
            <div class="audio-message">
              <audio controls preload="metadata">
                <source src="${msg.mediaUrl}" type="${msg.mimetype}">
                <source src="${msg.mediaUrl}" type="audio/webm">
                <source src="${msg.mediaUrl}" type="audio/mp3">
                <source src="${msg.mediaUrl}" type="audio/mpeg">
                <source src="${msg.mediaUrl}" type="audio/ogg">
                <source src="${msg.mediaUrl}" type="audio/aac">
                <source src="${msg.mediaUrl}" type="audio/wav">
              </audio>
              <a href="${msg.mediaUrl}" download="audio" class="file-download">
                🎵 Descargar audio
              </a>
              ${msg.body ? `<div class="media-caption">${msg.body}</div>` : ''}
            </div>
          `;
        } else if (msg.mimetype && msg.mimetype.startsWith('image')) {
          // Imagen
          messageContent = `
            <div class="image-message">
              <img src="${msg.mediaUrl}" alt="Image" class="message-image">
              ${msg.body ? `<div class="media-caption">${msg.body}</div>` : ''}
            </div>
          `;
        } else if (msg.mimetype && msg.mimetype.startsWith('video')) {
          // Video
          messageContent = `
            <div class="video-message">
              <video controls class="message-video">
                <source src="${msg.mediaUrl}" type="${msg.mimetype}">
                Tu navegador no soporta el elemento de video.
              </video>
              ${msg.body ? `<div class="media-caption">${msg.body}</div>` : ''}
            </div>
          `;
        } else {
          // Otro tipo de archivo
          messageContent = `
            <div class="file-message">
              <a href="${msg.mediaUrl}" download="file" class="file-download">
                📎 Descargar archivo
              </a>
              ${msg.body ? `<div class="media-caption">${msg.body}</div>` : ''}
            </div>
          `;
        }
      } else {
        // Mensaje de texto normal
        messageContent = `<div class="message-content">${msg.body || ''}</div>`;
      }
      
      messageElement.innerHTML = `
        ${messageContent}
        <div class="message-time">${timeString} ${isOutgoing ? '✓' : ''}</div>
      `;
      
      messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Variables para manejo de archivos
  let selectedFile = null;
  let fileBase64 = null;
  let fileType = null;
  
  // Variables para grabación de audio
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingSeconds = 0;
  
  // Referencia a los elementos del selector de archivos
  const fileSelectorBtn = document.getElementById('file-selector-btn');
  const fileSelector = document.getElementById('file-selector');
  const filePreview = document.getElementById('file-preview');
  const filePreviewName = document.getElementById('file-preview-name');
  const filePreviewContent = document.getElementById('file-preview-content');
  const cancelFileBtn = document.getElementById('cancel-file');
  
  // Botón para seleccionar archivo
  fileSelectorBtn.addEventListener('click', function() {
    fileSelector.click();
  });
  
  // Cuando se selecciona un archivo
  fileSelector.addEventListener('change', function(e) {
    if (fileSelector.files && fileSelector.files[0]) {
      selectedFile = fileSelector.files[0];
      filePreviewName.textContent = selectedFile.name;
      
      // Mostrar vista previa según el tipo de archivo
      const fileReader = new FileReader();
      
      fileReader.onload = function(event) {
        fileBase64 = event.target.result.split(',')[1]; // Obtener la parte base64
        fileType = selectedFile.type;
        
        if (selectedFile.type.startsWith('image/')) {
          filePreviewContent.innerHTML = `<img src="${event.target.result}" alt="Image preview">`;
        } else if (selectedFile.type.startsWith('audio/')) {
          filePreviewContent.innerHTML = `<audio controls><source src="${event.target.result}" type="${selectedFile.type}"></audio>`;
        } else if (selectedFile.type.startsWith('video/')) {
          filePreviewContent.innerHTML = `<video controls><source src="${event.target.result}" type="${selectedFile.type}"></video>`;
        } else {
          // Para otros tipos de archivos
          filePreviewContent.innerHTML = `
            <div class="file-info">
              <div class="file-info-icon">📄</div>
              <div class="file-info-details">
                <div>${selectedFile.name}</div>
                <div>${(selectedFile.size / 1024).toFixed(2)} KB</div>
              </div>
            </div>
          `;
        }
        
        // Mostrar panel de vista previa
        filePreview.classList.remove('hidden');
      };
      
      fileReader.readAsDataURL(selectedFile);
    }
  });
  
  // Cancelar la selección de archivo
  cancelFileBtn.addEventListener('click', function() {
    clearFileSelection();
  });
  
  // Función para limpiar selección de archivo
  function clearFileSelection() {
    selectedFile = null;
    fileBase64 = null;
    fileType = null;
    fileSelector.value = '';
    filePreview.classList.add('hidden');
  }
  
  // Elementos para grabación de audio
  const recordAudioBtn = document.getElementById('record-audio-btn');
  const audioRecordingPanel = document.getElementById('audio-recording');
  const recordingTimeDisplay = document.getElementById('recording-time');
  const cancelRecordingBtn = document.getElementById('cancel-recording');
  const stopRecordingBtn = document.getElementById('stop-recording');
  
  // Función para formatear el tiempo de grabación
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }
  
  // Iniciar grabación de audio
  recordAudioBtn.addEventListener('click', async function() {
    try {
      // Pedir permiso para acceder al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configurar el grabador con formato compatible
      // Probar diferentes formatos de acuerdo a lo que soporte el navegador
      let mimeType = 'audio/webm';
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        console.log('Usando formato de grabación: audio/webm;codecs=opus');
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        console.log('Usando formato de grabación: audio/ogg;codecs=opus');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        console.log('Usando formato de grabación: audio/mp4');
      } else {
        console.log('Usando formato de grabación predeterminado');
      }
      
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];
      
      // Recopilar datos de audio
      mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
      });
      
      // Cuando se complete la grabación
      mediaRecorder.addEventListener('stop', async () => {
        // Detener el temporizador
        clearInterval(recordingTimer);
        
        // Crear un blob con todos los fragmentos de audio
        const audioBlob = new Blob(audioChunks);
        
        try {
          // Reproducir el audio para verificar que se grabó correctamente
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();
          setTimeout(() => audio.pause(), 1000); // Reproducir solo un segundo para verificar
        } catch (err) {
          console.log('Error al reproducir vista previa:', err);
        }
        
        // Convertir a base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = function() {
          const base64data = reader.result;
          
          // Mantener el mismo tipo MIME que se usó para grabar
          const mimeType = mediaRecorder.mimeType;
          
          // Enviar el audio
          socket.emit('sendMessage', {
            to: currentChatId,
            message: '',
            options: {
              media: {
                mimetype: mimeType,
                data: base64data.split(',')[1]
              }
            }
          });
          
          // Cerrar la grabadora y ocultar panel
          audioRecordingPanel.classList.add('hidden');
          
          // Detener todas las pistas del stream
          stream.getTracks().forEach(track => track.stop());
        };
      });
      
      // Iniciar grabación
      mediaRecorder.start();
      audioRecordingPanel.classList.remove('hidden');
      
      // Iniciar el temporizador
      recordingSeconds = 0;
      recordingTimeDisplay.textContent = formatTime(recordingSeconds);
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        recordingTimeDisplay.textContent = formatTime(recordingSeconds);
        
        // Limitar a 2 minutos de grabación
        if (recordingSeconds >= 120) {
          stopRecordingBtn.click();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error al iniciar la grabación de audio:', error);
      alert('No se pudo acceder al micrófono. Asegúrate de dar permiso para grabar audio.');
    }
  });
  
  // Cancelar grabación
  cancelRecordingBtn.addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      // Detener el grabador sin procesar el audio
      mediaRecorder.stop();
      clearInterval(recordingTimer);
      
      // Ocultar panel de grabación
      audioRecordingPanel.classList.add('hidden');
      
      // Liberar recursos
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
  });
  
  // Detener y enviar grabación
  stopRecordingBtn.addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });
  
  // Send message (ahora con soporte para archivos)
  sendMessageButton.addEventListener('click', function() {
    const message = messageText.value.trim();
    
    if (!currentChatId) return;
    if (!message && !selectedFile) return;
    
    // Mostrar mensajes inmediatamente en la UI, incluso antes de que se envíen
    const messageElement = document.createElement('div');
    messageElement.className = 'message message-out';
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (selectedFile) {
      // Para mensajes con multimedia
      let previewContent = '';
      if (fileType && fileType.startsWith('image/')) {
        // Para imágenes
        const imgSrc = URL.createObjectURL(selectedFile);
        previewContent = `
          <div class="image-message">
            <img src="${imgSrc}" alt="Image" class="message-image">
            ${message ? `<div class="media-caption">${message}</div>` : ''}
          </div>
        `;
      } else if (fileType && fileType.startsWith('audio/')) {
        // Para audios
        previewContent = `
          <div class="audio-message">
            <div>🎵 Audio</div>
            ${message ? `<div class="media-caption">${message}</div>` : ''}
          </div>
        `;
      } else {
        // Para otros archivos
        previewContent = `
          <div class="file-message">
            <div>📎 ${selectedFile.name}</div>
            ${message ? `<div class="media-caption">${message}</div>` : ''}
          </div>
        `;
      }
      
      messageElement.innerHTML = `
        ${previewContent}
        <div class="message-time">${timeString} ⏳</div>
      `;
      
      // Enviar mensaje con archivo
      socket.emit('sendMessage', {
        to: currentChatId,
        message: message,
        options: {
          media: {
            mimetype: fileType,
            data: fileBase64
          }
        }
      });
      
      // Limpiar selección de archivo
      clearFileSelection();
    } else {
      // Para mensajes de texto normal
      messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${timeString} ⏳</div>
      `;
      
      // Enviar mensaje de texto normal
      socket.emit('sendMessage', {
        to: currentChatId,
        message: message
      });
    }
    
    // Agregar mensaje a la UI inmediatamente
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Limpiar input
    messageText.value = '';
  });
  
  // Allow sending with Enter key
  messageText.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessageButton.click();
    }
  });
  
  // Handle message sent
  socket.on('messageSent', function(data) {
    if (data.success) {
      console.log('Mensaje enviado correctamente:', data);
      
      // Actualizar el último mensaje enviado para mostrar el check
      const messages = messagesContainer.querySelectorAll('.message');
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage && lastMessage.classList.contains('message-out')) {
        const timeElement = lastMessage.querySelector('.message-time');
        if (timeElement) {
          // Cambiar el indicador de pendiente ⏳ por un check de enviado ✓
          timeElement.innerHTML = timeElement.innerHTML.replace('⏳', '✓');
        }
      }
      
      // También actualizamos la lista de chats para mostrar el último mensaje
      socket.emit('getChats');
    } else {
      console.error('Error al enviar mensaje:', data.error);
      alert('No se pudo enviar el mensaje: ' + (data.error || 'Error desconocido'));
      
      // Marcar el mensaje como fallido
      const messages = messagesContainer.querySelectorAll('.message');
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage && lastMessage.classList.contains('message-out')) {
        const timeElement = lastMessage.querySelector('.message-time');
        if (timeElement) {
          // Cambiar el indicador de pendiente ⏳ por un error ❌
          timeElement.innerHTML = timeElement.innerHTML.replace('⏳', '❌');
        }
      }
    }
  });
  
  // Handle new message
  socket.on('newMessage', function(data) {
    console.log('Nuevo mensaje recibido:', data);
    // Refresh chat list to show new message
    socket.emit('getChats');
    
    // If this message belongs to the currently open chat, add it to the UI
    if (currentChatId && (data.from === currentChatId || data.to === currentChatId)) {
      const isOutgoing = data.from !== currentChatId;
      const messageTime = new Date(data.timestamp * 1000);
      const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const messageElement = document.createElement('div');
      messageElement.className = `message ${isOutgoing ? 'message-out' : 'message-in'}`;
      
      // Contenido según el tipo de mensaje
      let messageContent = '';
      
      if (data.hasMedia && data.mediaUrl) {
        if (data.mimetype && data.mimetype.startsWith('audio')) {
          // Audio
          messageContent = `
            <div class="audio-message">
              <audio controls>
                <source src="${data.mediaUrl}" type="${data.mimetype}">
                <source src="${data.mediaUrl}" type="audio/webm">
                <source src="${data.mediaUrl}" type="audio/mp3">
                <source src="${data.mediaUrl}" type="audio/ogg">
                Tu navegador no soporta el elemento de audio.
              </audio>
              ${data.body ? `<div class="media-caption">${data.body}</div>` : ''}
            </div>
          `;
        } else if (data.mimetype && data.mimetype.startsWith('image')) {
          // Imagen
          messageContent = `
            <div class="image-message">
              <img src="${data.mediaUrl}" alt="Image" class="message-image">
              ${data.body ? `<div class="media-caption">${data.body}</div>` : ''}
            </div>
          `;
        } else if (data.mimetype && data.mimetype.startsWith('video')) {
          // Video
          messageContent = `
            <div class="video-message">
              <video controls class="message-video">
                <source src="${data.mediaUrl}" type="${data.mimetype}">
                Tu navegador no soporta el elemento de video.
              </video>
              ${data.body ? `<div class="media-caption">${data.body}</div>` : ''}
            </div>
          `;
        } else {
          // Otro tipo de archivo
          messageContent = `
            <div class="file-message">
              <a href="${data.mediaUrl}" download="file" class="file-download">
                📎 Descargar archivo
              </a>
              ${data.body ? `<div class="media-caption">${data.body}</div>` : ''}
            </div>
          `;
        }
      } else {
        // Mensaje de texto normal
        messageContent = `<div class="message-content">${data.body || ''}</div>`;
      }
      
      messageElement.innerHTML = `
        ${messageContent}
        <div class="message-time">${timeString} ${isOutgoing ? '✓' : ''}</div>
      `;
      
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
  
  // Settings modal
  openSettingsButton.addEventListener('click', function() {
    renderTagList(); // Actualizar lista de etiquetas al abrir
    settingsModal.classList.remove('hidden');
  });
  
  closeSettingsButton.addEventListener('click', function() {
    settingsModal.classList.add('hidden');
  });
  
  // Gestión de etiquetas
  function renderTagList() {
    if (!tagList) return;
    
    tagList.innerHTML = '';
    
    if (tags.length === 0) {
      tagList.innerHTML = '<p>No hay etiquetas creadas. Crea una nueva etiqueta para organizar tus chats.</p>';
      return;
    }
    
    tags.forEach(tag => {
      const tagItem = document.createElement('div');
      tagItem.className = 'tag-item';
      tagItem.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div class="tag-color" style="background-color: ${tag.color}"></div>
          <div class="tag-name">${tag.name}</div>
        </div>
        <button class="edit-tag-btn" data-tag-id="${tag.id}">✏️</button>
      `;
      
      // Evento para editar etiqueta
      const editBtn = tagItem.querySelector('.edit-tag-btn');
      editBtn.addEventListener('click', () => {
        openTagEditModal(tag);
      });
      
      tagList.appendChild(tagItem);
    });
  }
  
  // Nueva etiqueta
  addNewTagButton.addEventListener('click', function() {
    openTagEditModal(); // Sin argumento para nueva etiqueta
  });
  
  // Cerrar modal de edición de etiqueta
  closeTagModalButton.addEventListener('click', function() {
    tagEditModal.classList.add('hidden');
  });
  
  // Abrir modal para editar/crear etiqueta
  function openTagEditModal(tag = null) {
    const isNewTag = !tag;
    const modalTitle = document.getElementById('tag-modal-title');
    const tagNameInput = document.getElementById('tag-name');
    const tagColorInput = document.getElementById('tag-color');
    const tagIdInput = document.getElementById('tag-id');
    
    // Configurar el modal según si es nueva etiqueta o edición
    if (isNewTag) {
      modalTitle.textContent = 'Nueva Etiqueta';
      tagNameInput.value = '';
      tagColorInput.value = '#00a884'; // Color por defecto
      tagIdInput.value = '';
      deleteTagButton.style.display = 'none';
    } else {
      modalTitle.textContent = 'Editar Etiqueta';
      tagNameInput.value = tag.name;
      tagColorInput.value = tag.color;
      tagIdInput.value = tag.id;
      deleteTagButton.style.display = 'block';
    }
    
    tagEditModal.classList.remove('hidden');
  }
  
  // Guardar etiqueta
  saveTagButton.addEventListener('click', function() {
    const tagId = document.getElementById('tag-id').value;
    const tagName = document.getElementById('tag-name').value.trim();
    const tagColor = document.getElementById('tag-color').value;
    
    if (!tagName) {
      alert('Por favor, introduce un nombre para la etiqueta.');
      return;
    }
    
    if (tagId) {
      // Actualizar etiqueta existente
      const tagIndex = tags.findIndex(t => t.id === tagId);
      if (tagIndex !== -1) {
        tags[tagIndex].name = tagName;
        tags[tagIndex].color = tagColor;
      }
    } else {
      // Crear nueva etiqueta
      const newTag = {
        id: Date.now().toString(), // Usar timestamp como ID único
        name: tagName,
        color: tagColor
      };
      tags.push(newTag);
    }
    
    // Guardar en localStorage
    localStorage.setItem('chatTags', JSON.stringify(tags));
    
    // Actualizar UI
    renderTagList();
    tagEditModal.classList.add('hidden');
    
    // Actualizar la lista de chats para reflejar los cambios en las etiquetas
    renderChatList();
  });
  
  // Eliminar etiqueta
  deleteTagButton.addEventListener('click', function() {
    const tagId = document.getElementById('tag-id').value;
    
    if (!tagId) return;
    
    if (confirm('¿Estás seguro de que deseas eliminar esta etiqueta? Se quitará de todos los chats donde esté aplicada.')) {
      // Eliminar etiqueta del array
      const tagIndex = tags.findIndex(t => t.id === tagId);
      if (tagIndex !== -1) {
        tags.splice(tagIndex, 1);
      }
      
      // Quitar la etiqueta de todos los chats
      Object.keys(chatTags).forEach(chatId => {
        const index = chatTags[chatId].indexOf(tagId);
        if (index !== -1) {
          chatTags[chatId].splice(index, 1);
        }
      });
      
      // Guardar en localStorage
      localStorage.setItem('chatTags', JSON.stringify(tags));
      localStorage.setItem('chatTagAssignments', JSON.stringify(chatTags));
      
      // Actualizar UI
      renderTagList();
      tagEditModal.classList.add('hidden');
      
      // Actualizar la lista de chats
      renderChatList();
    }
  });
  
  // Botón para volver a la lista de chats (en móviles)
  backToChatsButton.addEventListener('click', function() {
    // Mostrar la barra lateral
    sidebar.classList.remove('hidden');
    
    // En dispositivos móviles, ocultar el chat actual
    if (window.innerWidth <= 768) {
      chatWindow.classList.add('hidden');
      welcomeScreen.classList.remove('hidden');
    }
  });
  
  // Menú de opciones del chat (los tres puntos)
  chatOptionsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Si ya hay un menú abierto, cerrarlo
    if (contextMenu) {
      document.body.removeChild(contextMenu);
      contextMenu = null;
      return;
    }
    
    // Crear menú de opciones
    contextMenu = document.createElement('div');
    contextMenu.className = 'chat-context-menu';
    
    // Posicionar el menú
    const rect = chatOptionsBtn.getBoundingClientRect();
    contextMenu.style.top = `${rect.bottom + 5}px`;
    contextMenu.style.right = '10px';
    
    // Crear opciones del menú
    const menuItems = [
      { icon: '📌', text: 'Fijar chat', action: () => togglePinChat(currentChatId) },
      { icon: '🏷️', text: 'Etiquetar chat', action: () => showTagSelector() },
      { icon: '📷', text: 'Subir estado', action: () => uploadStatus() },
      { icon: '🔍', text: 'Buscar mensajes', action: () => searchMessages() },
      { icon: '🗑️', text: 'Borrar chat', action: () => deleteChat() }
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.innerHTML = `<span class="context-menu-icon">${item.icon}</span> ${item.text}`;
      menuItem.addEventListener('click', () => {
        item.action();
        document.body.removeChild(contextMenu);
        contextMenu = null;
      });
      contextMenu.appendChild(menuItem);
    });
    
    // Agregar al DOM
    document.body.appendChild(contextMenu);
    
    // Cerrar al hacer clic fuera
    document.addEventListener('click', function closeContextMenu(e) {
      if (!contextMenu.contains(e.target) && e.target !== chatOptionsBtn) {
        if (contextMenu && contextMenu.parentNode) {
          document.body.removeChild(contextMenu);
          contextMenu = null;
        }
        document.removeEventListener('click', closeContextMenu);
      }
    });
  });
  
  // Función para subir un estado
  function uploadStatus() {
    // Crear un modal para subir estado
    const statusModal = document.createElement('div');
    statusModal.className = 'modal';
    statusModal.style.display = 'flex';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
      <h2>Subir estado</h2>
      <button class="close-btn">&times;</button>
    `;
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.innerHTML = `
      <div class="form-group">
        <label for="status-type">Tipo de estado:</label>
        <select id="status-type" class="status-select">
          <option value="text">Texto</option>
          <option value="image">Imagen</option>
          <option value="video">Video</option>
        </select>
      </div>
      
      <div class="form-group status-text-group">
        <label for="status-text">Texto del estado:</label>
        <textarea id="status-text" placeholder="¿Qué estás pensando?" rows="3"></textarea>
      </div>
      
      <div class="form-group status-media-group" style="display: none;">
        <label>Selecciona un archivo:</label>
        <input type="file" id="status-file" accept="image/*,video/*">
        <div id="status-preview" style="margin-top: 10px;"></div>
      </div>
      
      <button class="btn save-btn" id="upload-status-btn">Publicar estado</button>
    `;
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    statusModal.appendChild(modalContent);
    document.body.appendChild(statusModal);
    
    // Manejar cambio de tipo de estado
    const statusType = document.getElementById('status-type');
    const textGroup = document.querySelector('.status-text-group');
    const mediaGroup = document.querySelector('.status-media-group');
    
    statusType.addEventListener('change', function() {
      if (this.value === 'text') {
        textGroup.style.display = 'block';
        mediaGroup.style.display = 'none';
      } else {
        textGroup.style.display = 'block';
        mediaGroup.style.display = 'block';
        
        // Actualizar el tipo de archivo aceptado
        const fileInput = document.getElementById('status-file');
        if (this.value === 'image') {
          fileInput.accept = 'image/*';
        } else if (this.value === 'video') {
          fileInput.accept = 'video/*';
        }
      }
    });
    
    // Vista previa del archivo
    const statusFile = document.getElementById('status-file');
    const statusPreview = document.getElementById('status-preview');
    
    statusFile.addEventListener('change', function(e) {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
          statusPreview.innerHTML = '';
          
          if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            statusPreview.appendChild(img);
          } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = e.target.result;
            video.controls = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '200px';
            statusPreview.appendChild(video);
          }
        };
        
        reader.readAsDataURL(file);
      }
    });
    
    // Enviar estado
    const uploadStatusBtn = document.getElementById('upload-status-btn');
    uploadStatusBtn.addEventListener('click', function() {
      const type = statusType.value;
      const text = document.getElementById('status-text').value.trim();
      
      if (type === 'text' && !text) {
        alert('Por favor, escribe algún texto para tu estado.');
        return;
      }
      
      if ((type === 'image' || type === 'video') && (!statusFile.files || !statusFile.files[0])) {
        alert('Por favor, selecciona un archivo para tu estado.');
        return;
      }
      
      // Preparar datos para enviar
      if (type === 'text') {
        // Enviar estado de texto
        socket.emit('sendStatus', { text });
        document.body.removeChild(statusModal);
      } else {
        // Enviar estado con multimedia
        const file = statusFile.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const base64Data = e.target.result.split(',')[1];
          socket.emit('sendStatus', {
            text,
            media: {
              data: base64Data,
              mimetype: file.type
            }
          });
          document.body.removeChild(statusModal);
        };
        
        reader.readAsDataURL(file);
      }
    });
    
    // Cerrar modal
    const closeBtn = modalHeader.querySelector('.close-btn');
    closeBtn.addEventListener('click', function() {
      document.body.removeChild(statusModal);
    });
    
    statusModal.addEventListener('click', function(e) {
      if (e.target === statusModal) {
        document.body.removeChild(statusModal);
      }
    });
  }
  
  // Manejar respuesta al enviar estado
  socket.on('statusSent', function(data) {
    if (data.success) {
      alert('Estado publicado correctamente');
    } else {
      alert('Error al publicar estado: ' + (data.error || 'Error desconocido'));
    }
  });
  
  // Función para buscar mensajes
  function searchMessages() {
    alert('Funcionalidad en desarrollo: Búsqueda de mensajes');
  }
  
  // Función para eliminar chat
  function deleteChat() {
    if (confirm('¿Estás seguro de que deseas borrar este chat? Esta acción no se puede deshacer.')) {
      alert('Funcionalidad en desarrollo: Eliminar chat');
    }
  }
  
  // Mostrar selector de etiquetas
  function showTagSelector() {
    // Implementación similar a la que ya existe para etiquetar chats
    if (tags.length === 0) {
      alert('No hay etiquetas disponibles. Crea nuevas etiquetas en la configuración.');
      return;
    }
    
    const tagSelector = document.createElement('div');
    tagSelector.className = 'modal';
    tagSelector.style.display = 'flex';
    
    const selectorContent = document.createElement('div');
    selectorContent.className = 'modal-content';
    
    const selectorHeader = document.createElement('div');
    selectorHeader.className = 'modal-header';
    selectorHeader.innerHTML = `
      <h2>Etiquetar chat</h2>
      <button class="close-btn">&times;</button>
    `;
    
    const selectorBody = document.createElement('div');
    selectorBody.className = 'modal-body';
    
    // Agregar etiquetas al selector
    const chatTagIds = chatTags[currentChatId] || [];
    
    tags.forEach(tag => {
      const isApplied = chatTagIds.includes(tag.id);
      
      const tagItem = document.createElement('div');
      tagItem.className = `tag-selector-item ${isApplied ? 'tag-applied' : ''}`;
      tagItem.innerHTML = `
        <span class="tag-selector-color" style="background-color: ${tag.color}"></span>
        <span>${tag.name}</span>
      `;
      
      tagItem.addEventListener('click', () => {
        toggleTagOnChat(currentChatId, tag.id);
        document.body.removeChild(tagSelector);
      });
      
      selectorBody.appendChild(tagItem);
    });
    
    selectorContent.appendChild(selectorHeader);
    selectorContent.appendChild(selectorBody);
    tagSelector.appendChild(selectorContent);
    document.body.appendChild(tagSelector);
    
    // Cerrar selector
    const closeBtn = selectorHeader.querySelector('.close-btn');
    closeBtn.addEventListener('click', function() {
      document.body.removeChild(tagSelector);
    });
    
    tagSelector.addEventListener('click', function(e) {
      if (e.target === tagSelector) {
        document.body.removeChild(tagSelector);
      }
    });
  }
  
  // Botón de fijar chats del header
  statusButton.addEventListener('click', function() {
    const pinnedChatIds = pinnedChats.length > 0 ? 
      pinnedChats.map(id => {
        const chat = chats.find(c => c.id === id);
        return chat ? chat.name : id;
      }).join(', ') : 
      'No hay chats fijados';
    
    alert(`Chats fijados: ${pinnedChatIds}\n\nPara fijar o desfijar un chat, haz clic derecho sobre él y selecciona la opción correspondiente.`);
  });
  
  // Botón de etiquetas
  tagButton.addEventListener('click', function() {
    openTagEditModal(); // Abrir modal para nueva etiqueta
  });
  
  // Botón de nuevo chat
  newChatButton.addEventListener('click', function() {
    // Mostrar la lista de chats como opciones
    if (chats.length === 0) {
      alert("No hay contactos disponibles.");
      return;
    }
    
    // Crear un modal simple para seleccionar un chat
    const contactSelectorModal = document.createElement('div');
    contactSelectorModal.className = 'modal';
    contactSelectorModal.style.display = 'flex';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '600px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflow = 'auto';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
      <h2>Seleccionar contacto</h2>
      <button class="close-btn">&times;</button>
    `;
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.padding = '0';
    
    // Agregar un campo de búsqueda
    const searchBar = document.createElement('div');
    searchBar.style.padding = '10px';
    searchBar.style.borderBottom = '1px solid #eee';
    searchBar.innerHTML = `
      <input type="text" id="contact-search" placeholder="Buscar contacto..." style="width: 100%; padding: 8px; border-radius: 20px; border: 1px solid #ccc;">
    `;
    
    // Crear lista de contactos
    const contactsList = document.createElement('div');
    contactsList.style.maxHeight = '60vh';
    contactsList.style.overflow = 'auto';
    
    // Número personalizado
    const customNumberOption = document.createElement('div');
    customNumberOption.className = 'chat-item';
    customNumberOption.style.padding = '12px 16px';
    customNumberOption.style.cursor = 'pointer';
    customNumberOption.style.borderBottom = '1px solid #eee';
    customNumberOption.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div class="avatar" style="background-color: #ddd; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 20px;">+</span>
        </div>
        <div style="margin-left: 12px;">
          <strong>Número personalizado</strong>
          <div style="font-size: 12px; color: #666;">Ingresa un número de teléfono nuevo</div>
        </div>
      </div>
    `;
    
    customNumberOption.addEventListener('click', function() {
      const phoneNumber = prompt("Ingresa un número de teléfono para iniciar un chat (incluir código de país):", "");
      
      if (phoneNumber && phoneNumber.trim() !== '') {
        // Formatear el número: eliminar caracteres no numéricos
        let formattedNumber = phoneNumber.replace(/\D/g, '');
        
        // Asegurarse de que tenga formato de ID de chat
        if (!formattedNumber.includes('@')) {
          formattedNumber = `${formattedNumber}@c.us`;
        }
        
        // Cerrar el modal
        document.body.removeChild(contactSelectorModal);
        
        // Abrir el chat
        openChat(formattedNumber);
      }
    });
    
    contactsList.appendChild(customNumberOption);
    
    // Filtrar solo contactos (no grupos)
    const contacts = chats.filter(chat => !chat.isGroup);
    
    // Ordenar por nombre
    contacts.sort((a, b) => {
      if (a.name && b.name) {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
    
    // Agregar contactos a la lista
    contacts.forEach(contact => {
      const contactItem = document.createElement('div');
      contactItem.className = 'chat-item';
      contactItem.style.padding = '12px 16px';
      contactItem.style.cursor = 'pointer';
      contactItem.style.borderBottom = '1px solid #eee';
      
      // Usar imagen de perfil si está disponible
      const profilePic = contact.profilePicUrl ? contact.profilePicUrl : '/images/default-avatar.png';
      
      contactItem.innerHTML = `
        <div style="display: flex; align-items: center;">
          <div class="avatar">
            <img src="${profilePic}" alt="Contact" onerror="this.src='/images/default-avatar.png'">
          </div>
          <div style="margin-left: 12px;">
            <strong>${contact.name || 'Desconocido'}</strong>
          </div>
        </div>
      `;
      
      contactItem.addEventListener('click', function() {
        // Cerrar el modal
        document.body.removeChild(contactSelectorModal);
        
        // Abrir el chat
        openChat(contact.id);
      });
      
      contactsList.appendChild(contactItem);
    });
    
    // Función de búsqueda
    const setupSearch = () => {
      const searchInput = document.getElementById('contact-search');
      if (!searchInput) return;
      
      searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        
        // Filtrar contactos
        Array.from(contactsList.children).forEach(item => {
          if (item === customNumberOption) return; // Siempre mostrar la opción personalizada
          
          const name = item.textContent.toLowerCase();
          
          if (name.includes(query)) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    };
    
    // Agregar elementos al modal
    modalBody.appendChild(searchBar);
    modalBody.appendChild(contactsList);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    
    contactSelectorModal.appendChild(modalContent);
    
    // Cerrar modal al hacer clic en X o fuera
    modalHeader.querySelector('.close-btn').addEventListener('click', function() {
      document.body.removeChild(contactSelectorModal);
    });
    
    contactSelectorModal.addEventListener('click', function(e) {
      if (e.target === contactSelectorModal) {
        document.body.removeChild(contactSelectorModal);
      }
    });
    
    // Agregar al DOM
    document.body.appendChild(contactSelectorModal);
    
    // Configurar búsqueda
    setTimeout(setupSearch, 100);
  });
  
  // Referencias a los elementos de método HTTP
  const webhookMethodSelect = document.getElementById('webhook-method');
  const n8nWebhookMethodSelect = document.getElementById('n8n-webhook-method');

  // Save webhook URL with method
  saveWebhookButton.addEventListener('click', function() {
    const url = webhookUrlInput.value.trim();
    const method = webhookMethodSelect.value;
    
    if (url) {
      socket.emit('setWebhook', { url, method });
    }
  });
  
  // Elementos para la API
  const apiKeyInput = document.getElementById('api-key');
  const saveApiSettingsBtn = document.getElementById('save-api-settings');
  const copyApiEndpointBtn = document.getElementById('copy-api-endpoint');
  
  // Guardar configuración de API
  saveApiSettingsBtn.addEventListener('click', function() {
    const key = apiKeyInput.value.trim();
    socket.emit('setApiKey', { key });
  });
  
  // Actualizar API endpoint con la URL actual
  document.getElementById('api-endpoint').textContent = window.location.origin + '/api/messages';
  
  // Copiar endpoint de API al portapapeles
  copyApiEndpointBtn.addEventListener('click', function() {
    const apiEndpoint = document.getElementById('api-endpoint').textContent;
    navigator.clipboard.writeText(apiEndpoint)
      .then(() => {
        copyApiEndpointBtn.textContent = '¡Copiado!';
        setTimeout(() => {
          copyApiEndpointBtn.textContent = 'Copiar';
        }, 2000);
      })
      .catch(err => {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar el texto. Por favor, cópielo manualmente.');
      });
  });
  
  // Handle webhook set
  socket.on('webhookSet', function(data) {
    if (data.success) {
      alert(`Webhook configurado correctamente: ${data.method} ${data.url}`);
      console.log('Webhook configurado:', data);
    }
  });
  
  // Manejar respuesta de configuración de API
  socket.on('apiKeySet', function(data) {
    if (data.success) {
      alert(data.enabled 
        ? 'API Key configurada correctamente. Recuerde usar este valor en sus solicitudes.' 
        : 'Autenticación de API desactivada.');
    }
  });
  
  // Handle errors
  socket.on('error', function(data) {
    alert('Error: ' + data.message);
  });
  
  // Handle disconnection
  socket.on('disconnected', function(data) {
    connectionStatus.textContent = 'Desconectado';
    connectionStatus.style.color = 'red';
    alert('Desconectado de WhatsApp: ' + data.reason);
  });
  
  // Logout
  logoutButton.addEventListener('click', function() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión? Esto cerrará tu sesión actual de WhatsApp Web.')) {
      // Emitir evento para desconectar el cliente de WhatsApp
      socket.emit('disconnectWhatsApp');
      // Redireccionar después de un breve retraso
      setTimeout(function() {
        window.location.href = '/';
      }, 1000);
    }
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });
});