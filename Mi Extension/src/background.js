
console.log('🤖 FUSION CRM: Service Worker (v6.0 - API Only Edition)');

// ============================================
// CONFIGURACIÓN DE MATECHAT
// ============================================
let MATECHAT_CONFIG = {
  serverUrl: '',
  apiKey: '',
  useMateChat: false // Se activará al tener API Key
};

// Cargar configuración al iniciar
chrome.storage.sync.get(['matechat_url', 'matechat_apikey', 'matechat_enabled'], (result) => {
  MATECHAT_CONFIG.serverUrl = result.matechat_url || 'http://localhost:3001';
  MATECHAT_CONFIG.apiKey = result.matechat_apikey || '';
  MATECHAT_CONFIG.useMateChat = result.matechat_enabled === true;
  console.log('[Config] MateChat API:', MATECHAT_CONFIG.apiKey ? 'Configured' : 'Missing Key');
});

// Escuchar cambios en la configuración
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.matechat_url) MATECHAT_CONFIG.serverUrl = changes.matechat_url.newValue;
    if (changes.matechat_apikey) MATECHAT_CONFIG.apiKey = changes.matechat_apikey.newValue;
    if (changes.matechat_enabled) MATECHAT_CONFIG.useMateChat = changes.matechat_enabled.newValue === true;
  }
});

// ============================================
// MESSAGE HANDLERS
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Background recibió:", request.type);

  // Mensajes programados
  if (request.type === 'SAVE_SCHEDULED_MSG') {
    saveScheduledMessage(request.payload).then(sendResponse);
    return true;
  }

  // Estados programados
  if (request.type === 'SAVE_SCHEDULED_STATUS') {
    saveScheduledStatus(request.payload).then(sendResponse);
    return true;
  }

  // Configurar MateChat
  if (request.type === 'SAVE_MATECHAT_CONFIG') {
    saveMateChatConfig(request.payload).then(sendResponse);
    return true;
  }

  // Obtener configuración
  if (request.type === 'GET_MATECHAT_CONFIG') {
    sendResponse({
      success: true,
      config: {
        serverUrl: MATECHAT_CONFIG.serverUrl,
        apiKey: MATECHAT_CONFIG.apiKey ? '********' : '',
        useMateChat: !!MATECHAT_CONFIG.apiKey,
        hasApiKey: !!MATECHAT_CONFIG.apiKey
      }
    });
    return true;
  }

  // Test conexión MateChat
  if (request.type === 'TEST_MATECHAT_CONNECTION') {
    testMateChatConnection().then(sendResponse);
    return true;
  }

  // Listar mensajes programados
  if (request.type === 'GET_SCHEDULED_MESSAGES') {
    getScheduledMessages().then(sendResponse);
    return true;
  }

  // Eliminar mensaje programado
  if (request.type === 'DELETE_SCHEDULED_MSG') {
    deleteScheduledMessage(request.payload.id).then(sendResponse);
    return true;
  }
});

// ============================================
// CONFIGURACIÓN MATECHAT
// ============================================
async function saveMateChatConfig({ serverUrl, apiKey, enabled }) {
  try {
    await chrome.storage.sync.set({
      matechat_url: serverUrl,
      matechat_apikey: apiKey,
      matechat_enabled: enabled
    });

    // Actualizar config local
    MATECHAT_CONFIG.serverUrl = serverUrl;
    MATECHAT_CONFIG.apiKey = apiKey;
    MATECHAT_CONFIG.useMateChat = enabled;

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function testMateChatConnection() {
  if (!MATECHAT_CONFIG.serverUrl || !MATECHAT_CONFIG.apiKey) {
    return { success: false, error: 'URL o API Key no configurados' };
  }

  try {
    const response = await fetch(`${MATECHAT_CONFIG.serverUrl}/api/labels`, {
      method: 'GET',
      headers: {
        'x-api-key': MATECHAT_CONFIG.apiKey
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Error ${response.status}: ${errText}` };
    }

    const data = await response.json();
    return { success: true, message: 'Conexión exitosa', labels: data.labels?.length || 0 };
  } catch (err) {
    return { success: false, error: `Error de conexión: ${err.message}` };
  }
}

// ============================================
// MENSAJES PROGRAMADOS
// ============================================
async function saveScheduledMessage(msgData) {
  if (!MATECHAT_CONFIG.apiKey) {
    return { success: false, error: 'Extension no configurada. Configure API Key.' };
  }

  try {
    const response = await fetch(`${MATECHAT_CONFIG.serverUrl}/api/schedule/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MATECHAT_CONFIG.apiKey
      },
      body: JSON.stringify({
        chatId: msgData.chatId,
        phone: msgData.phone,
        body: msgData.text || msgData.content,
        scheduledTime: new Date(msgData.time).toISOString()
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Error desconocido' };
    }

    return { success: true, data: result.data, source: 'matechat' };
  } catch (err) {
    console.error('[MateChat API] Error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// ESTADOS PROGRAMADOS
// ============================================
async function saveScheduledStatus(statusData) {
  if (!MATECHAT_CONFIG.apiKey) {
    return { success: false, error: 'Extension no configurada. Configure API Key.' };
  }

  try {
    const response = await fetch(`${MATECHAT_CONFIG.serverUrl}/api/schedule/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MATECHAT_CONFIG.apiKey
      },
      body: JSON.stringify({
        content: statusData.content || statusData.text,
        mediaUrl: statusData.mediaUrl,
        mediaType: statusData.mediaType,
        scheduledTime: new Date(statusData.time).toISOString()
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Error desconocido' };
    }

    return { success: true, data: result.data, source: 'matechat' };
  } catch (err) {
    console.error('[MateChat API] Error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// LISTAR Y ELIMINAR
// ============================================
async function getScheduledMessages() {
  if (!MATECHAT_CONFIG.apiKey) {
    return { success: false, error: 'Extension no configurada.' };
  }

  try {
    const response = await fetch(`${MATECHAT_CONFIG.serverUrl}/api/schedule/messages`, {
      method: 'GET',
      headers: { 'x-api-key': MATECHAT_CONFIG.apiKey }
    });
    const result = await response.json();
    return { success: true, data: result.data || [], source: 'matechat' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteScheduledMessage(id) {
  if (!MATECHAT_CONFIG.apiKey) {
    return { success: false, error: 'Extension no configurada.' };
  }

  try {
    const response = await fetch(`${MATECHAT_CONFIG.serverUrl}/api/schedule/message/${id}`, {
      method: 'DELETE',
      headers: { 'x-api-key': MATECHAT_CONFIG.apiKey }
    });
    const result = await response.json();
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}