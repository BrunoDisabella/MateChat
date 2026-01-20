/**
 * wpp-bridge.js
 * * Este script se inyecta en el contexto principal ("Main World") de WhatsApp Web.
 * Su función es servir de puente entre:
 * 1. Tu lógica de negocio (crm_logic.js) que usa WPPConnect.
 * 2. La extensión de Chrome (Content Script -> Background -> Supabase).
 */

console.log("💉 CRM Bridge: Puente de comunicación inyectado y listo.");

// 1. Exponer la API global 'CRM_Supabase'
// Tu archivo crm_logic.js llamará a estas funciones (ej: window.CRM_Supabase.login())
window.CRM_Supabase = {

    // Función A: Guardar mensaje programado en Supabase
    saveScheduledMessage: (messageObj) => {
        console.log("🌉 Bridge: Enviando mensaje programado a la nube...", messageObj);
        window.postMessage({
            source: 'CRM_FUSION_UI',       // Identificador de origen
            action: 'SAVE_SCHEDULED_MSG',  // Acción solicitada
            payload: messageObj            // Datos (texto, hora, chat, etc.)
        }, '*');
    },

    // Función B: Sincronizar un contacto/lead
    syncContact: (contactObj) => {
        console.log("🌉 Bridge: Sincronizando contacto...", contactObj);
        window.postMessage({
            source: 'CRM_FUSION_UI',
            action: 'SYNC_CONTACT',
            payload: contactObj
        }, '*');
    },

    // Función C: Iniciar sesión con Google (Legacy)
    // Función C: Iniciar sesión con Google (Deprecado)
    login: () => {
        console.warn("🌉 Bridge: El login con Google/Supabase ha sido eliminado. Usa 'Configurar MateChat'.");
        alert("Esta función antigua ya no existe. Usa el botón 'Configurar MateChat'.");
    },

    // Función D: Guardar Configuración de MateChat
    saveMateChatConfig: (config) => {
        console.log("🌉 Bridge: Guardando configuración de MateChat...", config);
        window.postMessage({
            source: 'CRM_FUSION_UI',
            action: 'SAVE_MATECHAT_CONFIG', // Background lo escucha
            payload: config
        }, '*');
    },

    // Función E: Obtener Configuración Actual
    getMateChatConfig: () => {
        window.postMessage({
            source: 'CRM_FUSION_UI',
            action: 'GET_MATECHAT_CONFIG',
            payload: {}
        }, '*');
    },

    // Función F: Probar Conexión
    testMateChatConnection: () => {
        window.postMessage({
            source: 'CRM_FUSION_UI',
            action: 'TEST_MATECHAT_CONNECTION',
            payload: {}
        }, '*');
    }
};

// 2. Escuchar respuestas desde la Extensión hacia la UI
// Cuando el Background termina una tarea (ej: Login exitoso), avisa por aquí.
window.addEventListener('message', (event) => {
    // Importante: Solo escuchamos mensajes que vengan de nuestra propia extensión (Content Script)
    if (event.data && event.data.source === 'CRM_FUSION_EXTENSION') {
        const { action, payload } = event.data;

        console.log(`📥 Bridge recibió respuesta del sistema: ${action}`, payload);

        // Aquí podrías agregar lógica extra si necesitas disparar eventos del DOM,
        // pero crm_logic.js ya tiene su propio listener para manejar esto.
    }
});