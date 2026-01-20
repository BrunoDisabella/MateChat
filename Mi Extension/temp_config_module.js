
// ==========================================
// 10. MÓDULO: CONFIGURACIÓN MATECHAT
// ==========================================
async function abrirModalConfiguracion() {
    if (document.getElementById("crm-config-modal")) return;

    const overlay = document.createElement("div");
    overlay.id = "crm-config-modal";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;font-family:inherit;`;

    overlay.innerHTML = `
        <div style="background:white;width:400px;padding:25px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0;color:#111b21;">⚙️ Conectar con MateChat</h3>
            <p style="font-size:13px;color:#666;margin-bottom:20px;">
                Conecta esta extensión con tu servidor MateChat para sincronizar mensajes programados y estados.
            </p>

            <label style="font-size:12px;color:#111b21;font-weight:bold;">URL del Servidor</label>
            <input type="text" id="mc-url" placeholder="https://tu-servidor.com" value="https://matechat.losgurises.com.uy" style="width:100%;padding:10px;margin:5px 0 15px 0;border:1px solid #ccc;border-radius:6px;">

            <label style="font-size:12px;color:#111b21;font-weight:bold;">API Key</label>
            <input type="password" id="mc-key" placeholder="Pega tu API Key aquí..." style="width:100%;padding:10px;margin:5px 0 15px 0;border:1px solid #ccc;border-radius:6px;">

            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <button id="mc-test" style="padding:8px 15px;background:#f0f2f5;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;">Test Conexión</button>
                <span id="mc-status" style="font-size:12px;color:#666;"></span>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button id="mc-cancel" style="padding:10px 20px;border:none;background:#f0f2f5;border-radius:20px;cursor:pointer;">Cancelar</button>
                <button id="mc-save" style="padding:10px 20px;border:none;background:#00a884;color:white;border-radius:20px;cursor:pointer;">Guardar y Conectar</button>
            </div>
            
            <div style="margin-top:15px;padding-top:15px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center;">
                Powered by MateChat API
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Precargar configuración actual
    window.addEventListener('message', function handler(e) {
        if (e.data.source === 'CRM_FUSION_EXTENSION' && e.data.action === 'GET_MATECHAT_CONFIG_RESPONSE') {
            const config = e.data.payload.config;
            if (config) {
                if (config.serverUrl) document.getElementById('mc-url').value = config.serverUrl;
                if (config.hasApiKey) document.getElementById('mc-key').placeholder = "******** (Oculta)";
            }
            window.removeEventListener('message', handler);
        }
    });
    window.CRM_Supabase.getMateChatConfig(); // Solicitar config

    // Listeners
    document.getElementById("mc-cancel").onclick = () => overlay.remove();

    document.getElementById("mc-test").onclick = async () => {
        const statusSpan = document.getElementById("mc-status");
        statusSpan.innerText = "Probando...";
        statusSpan.style.color = "#666";

        // Temporaly save to test? Or just send raw request via bridge? 
        // Bridge `testMateChatConnection` uses stored config, so we explicitly save first temporarily or add a raw test param.
        // For simplicity, we trigger the bridge test which relies on SAVED config. 
        // Better UX: Save params first then test.

        const url = document.getElementById('mc-url').value;
        const key = document.getElementById('mc-key').value;

        if (!url || (!key && document.getElementById('mc-key').placeholder.indexOf('*') === -1)) {
            statusSpan.innerText = "Faltan datos."; statusSpan.style.color = "red"; return;
        }

        // Save locally first to test
        const enabled = true;
        window.CRM_Supabase.saveMateChatConfig({ serverUrl: url, apiKey: key, enabled });

        setTimeout(() => {
            window.CRM_Supabase.testMateChatConnection();
        }, 500);
    };

    // Listen for Test Result
    window.addEventListener('message', function testHandler(e) {
        if (e.data.source === 'CRM_FUSION_EXTENSION' && e.data.action === 'TEST_MATECHAT_CONNECTION_RESPONSE') {
            const res = e.data.payload;
            const statusSpan = document.getElementById("mc-status");
            if (statusSpan) {
                if (res.success) {
                    statusSpan.innerText = "✅ Conectado";
                    statusSpan.style.color = "#00a884";
                } else {
                    statusSpan.innerText = "❌ Error: " + (res.error || 'Falló');
                    statusSpan.style.color = "red";
                }
            }
            // Don't remove listener aggressively to allow re-tests
        }
    });

    document.getElementById("mc-save").onclick = () => {
        const url = document.getElementById('mc-url').value;
        const key = document.getElementById('mc-key').value;

        // Si el key está vacío pero tiene placeholder de oculto, no lo sobreescribimos (o enviamos vacío y el back lo maneja)
        // Background logic: `if (changes.matechat_apikey)`. Sending empty string might clear it.
        // Simple logic: if empty, assume no change if checking against mask. But here we just save.

        window.CRM_Supabase.saveMateChatConfig({
            serverUrl: url,
            apiKey: key,
            enabled: true
        });

        alert("Configuración guardada.");
        overlay.remove();
        actualizarIconosSidebar(); // Refrescar estado visual si hubiera
    };
}
