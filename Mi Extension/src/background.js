import { supabase } from './lib/supabase-client.js';

console.log('🤖 FUSION CRM: Service Worker (v5.0 - MateChat Integration)');

// ============================================
// CONFIGURACIÓN DE MATECHAT
// ============================================
let MATECHAT_CONFIG = {
  serverUrl: '',
  apiKey: '',
  useMateChat: false // true = usa API de MateChat, false = usa Supabase directo
};

// Cargar configuración al iniciar
chrome.storage.sync.get(['matechat_url', 'matechat_apikey', 'matechat_enabled'], (result) => {
  MATECHAT_CONFIG.serverUrl = result.matechat_url || 'http://localhost:3001';
  MATECHAT_CONFIG.apiKey = result.matechat_apikey || '';
  MATECHAT_CONFIG.useMateChat = result.matechat_enabled === true;
  console.log('[Config] MateChat:', MATECHAT_CONFIG.useMateChat ? 'Enabled' : 'Disabled');
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

  if (request.type === 'LOGIN_GOOGLE') {
    handleLogin().then(sendResponse);
    return true;
  }

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
        useMateChat: MATECHAT_CONFIG.useMateChat,
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
// LÓGICA DE LOGIN
// ============================================
async function handleLogin() {
  try {
    const redirectURL = chrome.identity.getRedirectURL();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectURL,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) throw error;
    return { success: true, user: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

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
  // Si MateChat está habilitado, usar su API
  if (MATECHAT_CONFIG.useMateChat && MATECHAT_CONFIG.apiKey) {
    return await saveScheduledMessageViaAPI(msgData);
  }

  // Fallback: usar Supabase directo
  return await saveScheduledMessageViaSupabase(msgData);
}

async function saveScheduledMessageViaAPI(msgData) {
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

async function saveScheduledMessageViaSupabase(msgData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Debes iniciar sesión.' };

  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      user_id: user.id,
      chat_id: msgData.chatId,
      body: msgData.text || msgData.content,
      scheduled_time: new Date(msgData.time).toISOString(),
      status: 'pending',
      is_active: true
    });

  if (error) return { success: false, error: error.message };
  return { success: true, data, source: 'supabase' };
}

// ============================================
// ESTADOS PROGRAMADOS
// ============================================
async function saveScheduledStatus(statusData) {
  if (MATECHAT_CONFIG.useMateChat && MATECHAT_CONFIG.apiKey) {
    return await saveScheduledStatusViaAPI(statusData);
  }

  return await saveScheduledStatusViaSupabase(statusData);
}

async function saveScheduledStatusViaAPI(statusData) {
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

async function saveScheduledStatusViaSupabase(statusData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Debes iniciar sesión.' };

  const { data, error } = await supabase
    .from('scheduled_statuses')
    .insert({
      user_id: user.id,
      content: statusData.content || statusData.text,
      media_url: statusData.mediaUrl,
      scheduled_time: new Date(statusData.time).toISOString(),
      status: 'pending'
    });

  if (error) return { success: false, error: error.message };
  return { success: true, data, source: 'supabase' };
}

// ============================================
// LISTAR Y ELIMINAR
// ============================================
async function getScheduledMessages() {
  if (MATECHAT_CONFIG.useMateChat && MATECHAT_CONFIG.apiKey) {
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

  // Fallback Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_time', { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [], source: 'supabase' };
}

async function deleteScheduledMessage(id) {
  if (MATECHAT_CONFIG.useMateChat && MATECHAT_CONFIG.apiKey) {
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

  // Fallback Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('scheduled_messages')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}