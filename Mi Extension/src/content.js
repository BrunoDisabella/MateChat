console.log("🌉 CRM Content Script: Iniciando inyección...");

function injectScript(filePath) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(filePath);
    script.onload = function() {
        console.log(`✅ Inyectado: ${filePath}`);
        this.remove(); 
    };
    script.onerror = function() {
        console.error(`❌ Error inyectando: ${filePath}`);
    };
    (document.head || document.documentElement).appendChild(script);
}

// Inyección secuencial
injectScript('wppconnect-wa.js');
injectScript('src/inject/wpp-bridge.js');
setTimeout(() => { injectScript('crm_logic.js'); }, 500);

// Escucha de mensajes
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  
  if (event.data && event.data.source === 'CRM_FUSION_UI') {
    const { action, payload } = event.data;
    console.log(`📡 Content Script: Reenviando ${action} al Background...`);

    try {
        const response = await chrome.runtime.sendMessage({
            type: action,
            payload: payload
        });
        
        console.log(`📡 Respuesta recibida del Background para ${action}:`, response);

        window.postMessage({
            source: 'CRM_FUSION_EXTENSION',
            action: `${action}_RESPONSE`,
            payload: response
        }, '*');
        
    } catch (err) {
        console.error("❌ ERROR CRÍTICO DE COMUNICACIÓN CON BACKGROUND:", err);
        // Avisar a la UI que falló
        window.postMessage({
            source: 'CRM_FUSION_EXTENSION',
            action: `${action}_RESPONSE`,
            payload: { success: false, error: "La extensión no responde (Background desconectado)." }
        }, '*');
    }
  }
});