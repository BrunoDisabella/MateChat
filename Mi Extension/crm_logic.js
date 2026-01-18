/**
 * crm_logic.js - Versión: FUSION 3.4 (COMPLETE & ROBUST)
 * ---------------------------------------------------------
 * 1. Mensajes Rápidos: Activador '#' (foco robusto + imágenes Base64).
 * 2. Difusión: Sistema Anti-Spam (Lotes + Intervalos configurables).
 * 3. Etiquetas: Lógica corregida (WPP.labels / Store nativo).
 * 4. Estados: Subida de multimedia y texto.
 * 5. Programador: Filtros y persistencia local.
 * ---------------------------------------------------------
 */
console.log("🚀 CRM LOGIC: Sistema Completo Iniciado (v3.4 Final)...");

// ==========================================
// 1. CONSTANTES & ICONOS
// ==========================================
const ICONS = {
    clock: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    clip: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#d32f2f"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#54656f"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    clockYellow: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#FFD700" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    filter: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>`,
    status: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 20.428c-4.649 0-8.429-3.779-8.429-8.428 0-4.649 3.78-8.429 8.429-8.429 4.648 0 8.428 3.78 8.428 8.429 0 4.648-3.78 8.428-8.428 8.428zm0-19.143C6.089 1.285 1.285 6.089 1.285 12s4.804 10.715 10.715 10.715 10.715-4.804 10.715-10.715S17.911 1.285 12 1.285z"/></svg>`,
    broadcast: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 11c0-.959-.68-1.761-1.581-1.954C16.78 7.359 15.56 6.26 14 6.05V4h-3v2.05C9.44 6.26 8.22 7.359 7.581 9.046 6.68 9.239 6 10.041 6 11v3c0 .552.448 1 1 1h10c.552 0 1-.448 1-1v-3zm-6-4c1.654 0 3 1.346 3 3h-6c0-1.654 1.346-3 3-3zM5 11c0-1.654 1.346-3 3-3h.104C8.749 6.223 10.231 5 12 5s3.251 1.223 3.896 3H16c1.654 0 3 1.346 3 3v3c0 1.654-1.346 3-3 3H8c-1.654 0-3-1.346-3-3v-3zm3 8h8v2H8v-2z"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/></svg>`,
    lightning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`
};

// ==========================================
// 2. ESTADO GLOBAL & PERSISTENCIA
// ==========================================
let scheduledMessages = JSON.parse(localStorage.getItem('crm_scheduled_msgs') || '[]');
let scheduledStatuses = JSON.parse(localStorage.getItem('crm_scheduled_statuses') || '[]');
let scheduledBroadcasts = JSON.parse(localStorage.getItem('crm_scheduled_broadcasts') || '[]');
let currentFilter = null; 

function saveMessages() {
    const toSave = scheduledMessages.map(m => {
        const { file, ...rest } = m; 
        return { ...rest, hasFile: !!file, fileName: file ? file.name : m.fileName };
    });
    localStorage.setItem('crm_scheduled_msgs', JSON.stringify(toSave));
}
function saveStatuses() {
    const toSave = scheduledStatuses.map(s => {
        const { file, ...rest } = s;
        return { ...rest, hasFile: !!file, fileName: file ? file.name : s.fileName };
    });
    localStorage.setItem('crm_scheduled_statuses', JSON.stringify(toSave));
}
function saveBroadcasts() {
    const toSave = scheduledBroadcasts.map(b => {
        const { file, ...rest } = b;
        return { ...rest, hasFile: !!file, fileName: file ? file.name : b.fileName };
    });
    localStorage.setItem('crm_scheduled_broadcasts', JSON.stringify(toSave));
}

// ==========================================
// 3. SISTEMA DE MENSAJES RÁPIDOS (#)
// ==========================================
class QuickReplySystem {
    constructor() {
        this.replies = [];
        this.STORAGE_KEY = 'crm_quick_replies_local';
        this.init();
    }
    
    init() { 
        this.loadReplies(); 
        this.injectStyles(); 
        // Usamos delegación de eventos en el documento para robustez
        document.addEventListener('keyup', (e) => this.globalKeyHandler(e));
        document.addEventListener('click', (e) => this.globalClickHandler(e));
    }
    
    injectStyles() {
        if(document.getElementById('crm-qr-styles')) return;
        const style = document.createElement('style');
        style.id = 'crm-qr-styles';
        style.textContent = `
            .qr-popup { 
                position: fixed; bottom: 80px; left: 20px; width: 300px; max-height: 300px; 
                background: #fff; border-radius: 8px; box-shadow: 0 -4px 12px rgba(0,0,0,0.15); 
                z-index: 999999; overflow-y: auto; display: none; font-family: 'Segoe UI', sans-serif; 
                border: 1px solid #e0e0e0; 
            }
            .qr-item { padding: 10px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; flex-direction: column; }
            .qr-item:hover { background: #f5f6f6; }
            .qr-shortcut { font-weight: bold; color: #00a884; font-size: 14px; }
            .qr-msg { font-size: 13px; color: #54656f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .qr-badge { font-size: 10px; background: #e9edef; padding: 2px 5px; border-radius: 4px; margin-left: 5px; }
        `;
        document.head.appendChild(style);
        
        // Crear contenedor único para el popup
        if (!document.getElementById('qr-popup-menu')) {
            const popup = document.createElement('div');
            popup.id = 'qr-popup-menu'; 
            popup.className = 'qr-popup';
            document.body.appendChild(popup); 
        }
    }
    
    loadReplies() { const saved = localStorage.getItem(this.STORAGE_KEY); this.replies = saved ? JSON.parse(saved) : []; }
    saveReplies() { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.replies)); }
    
    addReply(shortcut, message, imageData) {
        // Limpiamos # y / para guardar solo el comando puro
        const cleanShortcut = shortcut.replace('#', '').replace('/', '').toLowerCase();
        this.replies.push({ id: Date.now().toString(), shortcut: cleanShortcut, message, imageData });
        this.saveReplies();
    }
    deleteReply(id) { this.replies = this.replies.filter(r => r.id !== id); this.saveReplies(); }
    
    // Detecta la escritura globalmente en el input de WhatsApp
    globalKeyHandler(e) {
        const target = e.target;
        // Identificar el input de WhatsApp (contenteditable en el footer)
        const isChatInput = target.getAttribute('contenteditable') === 'true' && target.closest('#main footer');
        
        if (!isChatInput) {
            this.hideMenu();
            return;
        }

        const text = target.innerText;
        // Regex para detectar #palabra
        const match = text.match(/#([a-zA-Z0-9]*)$/); 
        
        if (match) {
            const query = match[1].toLowerCase();
            this.showMenu(query, target);
        } else {
            this.hideMenu();
        }
    }

    globalClickHandler(e) {
        const popup = document.getElementById('qr-popup-menu');
        if (popup && popup.style.display === 'block' && !popup.contains(e.target) && !e.target.closest('#main footer')) {
            this.hideMenu();
        }
    }

    showMenu(query, inputElement) {
        const popup = document.getElementById('qr-popup-menu');
        const filtered = this.replies.filter(r => r.shortcut.startsWith(query));
        
        if (!popup || filtered.length === 0) { this.hideMenu(); return; }

        popup.innerHTML = '';
        filtered.forEach(r => {
            const div = document.createElement('div');
            div.className = 'qr-item';
            div.innerHTML = `
                <div><span class="qr-shortcut">#${r.shortcut}</span> ${r.imageData ? '<span class="qr-badge">📷 IMG</span>' : ''}</div>
                <div class="qr-msg">${r.message}</div>
            `;
            // Mousedown previene que el input pierda foco antes de ejecutar la acción
            div.onmousedown = (e) => {
                e.preventDefault(); 
                this.selectReply(r, inputElement, query);
            };
            popup.appendChild(div);
        });
        
        const rect = inputElement.getBoundingClientRect();
        popup.style.display = 'block';
        popup.style.left = `${rect.left}px`;
        popup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    }
    
    hideMenu() { const popup = document.getElementById('qr-popup-menu'); if (popup) popup.style.display = 'none'; }
    
    async selectReply(reply, inputElement, queryStr) {
        this.hideMenu();
        
        // Recuperar referencia segura al input
        let targetInput = inputElement;
        if (!targetInput.isConnected) targetInput = document.querySelector('div[contenteditable="true"][role="textbox"]');
        if (!targetInput) return; 

        targetInput.focus(); // Forzar foco

        if (reply.imageData) {
            // Si hay imagen, borramos el comando y enviamos archivo
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            
            const chatId = await obtenerChatId();
            if(chatId) {
                await WPP.chat.sendFileMessage(chatId, reply.imageData, {
                    caption: reply.message,
                    filename: 'quick_reply.jpg'
                });
            }
        } else {
            // Si es texto, reemplazamos el comando
            const currentText = targetInput.innerText;
            const newText = currentText.replace(new RegExp(`#${queryStr}$`, 'i'), reply.message);
            
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, newText);
        }
    }
    
    openManager() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;font-family:inherit;`;
        
        overlay.innerHTML = `
            <div style="background:white;width:400px;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0;">⚡ Mensajes Rápidos (#)</h3>
                <div style="max-height:200px;overflow-y:auto;border:1px solid #eee;margin-bottom:15px;">
                    ${this.replies.map(r => `
                        <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
                            <div><b>#${r.shortcut}</b>: ${r.message.substring(0,20)}...</div>
                            <span style="color:red;cursor:pointer;" id="del-qr-${r.id}">${ICONS.trash}</span>
                        </div>
                    `).join('')}
                    ${this.replies.length===0 ? '<div style="padding:10px;text-align:center;color:#999">Sin mensajes.</div>' : ''}
                </div>
                
                <label style="font-size:12px;color:#666;">Atajo (sin #):</label>
                <input id="qr-input-sc" placeholder="ej: precio" style="width:100%;padding:8px;margin-bottom:5px;border:1px solid #ccc;border-radius:4px;">
                
                <label style="font-size:12px;color:#666;">Mensaje:</label>
                <textarea id="qr-input-msg" placeholder="Texto..." rows="2" style="width:100%;padding:8px;margin-bottom:5px;border:1px solid #ccc;border-radius:4px;resize:none;"></textarea>
                
                <label style="font-size:12px;color:#666;">Adjuntar Imagen (Opcional):</label>
                <input type="file" id="qr-input-file" accept="image/*" style="width:100%;padding:8px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;">
                
                <div style="text-align:right;">
                    <button id="qr-close" style="padding:8px;margin-right:5px;cursor:pointer;">Cerrar</button>
                    <button id="qr-save" style="padding:8px;background:#00a884;color:white;border:none;cursor:pointer;">Guardar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('qr-close').onclick = () => overlay.remove();
        
        this.replies.forEach(r => {
            document.getElementById(`del-qr-${r.id}`).onclick = () => {
                if(confirm('¿Borrar?')) { this.deleteReply(r.id); overlay.remove(); this.openManager(); }
            };
        });

        document.getElementById('qr-save').onclick = () => {
            const sc = document.getElementById('qr-input-sc').value;
            const msg = document.getElementById('qr-input-msg').value;
            const fileInput = document.getElementById('qr-input-file');
            const file = fileInput.files[0];

            if(sc && msg) {
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.addReply(sc, msg, e.target.result); // Guardar imagen como Base64
                        overlay.remove(); this.openManager();
                    };
                    reader.readAsDataURL(file);
                } else {
                    this.addReply(sc, msg, null);
                    overlay.remove(); this.openManager();
                }
            } else { alert("Atajo y mensaje requeridos"); }
        }
    }
}
const quickReplySystem = new QuickReplySystem();

// ==========================================
// 4. VIGILANTE DE UI (TOOLBAR & BOTONES)
// ==========================================
function iniciarVigilante() {
    initSupabaseConnection();

    setInterval(async () => {
        injectTopToolbar();
        const chatHeader = document.querySelector("#main header");
        if (chatHeader && !document.getElementById("crm-btn-container")) {
            const rightIcons = chatHeader.lastElementChild;
            if (rightIcons) {
                const container = document.createElement("div");
                container.id = "crm-btn-container";
                container.style.cssText = "display:flex; align-items:center; gap:8px; margin-right: 12px;";

                const btnEtiquetas = createButton(ICONS.tag, "Etiquetas");
                btnEtiquetas.onclick = (e) => { e.stopPropagation(); e.preventDefault(); toggleLabelMenu(e.currentTarget); };

                const btnProgramar = createButton(ICONS.clock, "Programar");
                btnProgramar.onclick = (e) => { e.stopPropagation(); abrirModalProgramacion(); };

                container.appendChild(btnEtiquetas);
                container.appendChild(btnProgramar);
                rightIcons.prepend(container);
                rightIcons.style.display = "flex";
                rightIcons.style.alignItems = "center";
            }
        }
        const chatId = await obtenerChatId();
        if(chatId) renderScheduledMessageBubble(chatId);
    }, 800);

    iniciarVigilanteSidebar();
    setInterval(checkScheduledTasks, 15000); 
    setInterval(checkScheduledStatuses, 15000); 
    setInterval(checkBroadcasts, 2000); 
}

// ==========================================
// 5. MÓDULO ETIQUETAS
// ==========================================
async function toggleLabelMenu(btnElement) {
    const originalContent = btnElement.innerHTML;
    try {
        const existingMenu = document.getElementById("crm-label-dropdown");
        if (existingMenu) { existingMenu.remove(); return; }

        btnElement.innerHTML = `<span style="font-size:12px">⏳</span>`;
        const chatId = await obtenerChatId();
        if (!chatId) throw new Error("Abre un chat primero.");

        const labelModule = getLabelModule();
        if (!labelModule) throw new Error("Módulo de etiquetas no encontrado.");

        const getAllFn = labelModule.getAllLabels || labelModule.getAll;
        const allLabels = await getAllFn.call(labelModule);
        
        let chatLabelIds = [];
        try {
            if (labelModule.getLabels) {
                const l = await labelModule.getLabels(chatId);
                chatLabelIds = l.map(x => x.id); 
            } else {
                const chat = WPP.chat.get(chatId);
                if (chat && chat.labels) chatLabelIds = chat.labels;
            }
        } catch(e) {}
        btnElement.innerHTML = originalContent;

        const menu = document.createElement("div");
        menu.id = "crm-label-dropdown";
        const rect = btnElement.getBoundingClientRect();
        menu.style.cssText = `position: fixed; top: ${rect.bottom + 10}px; left: ${rect.left - 150}px; width: 280px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 99999; padding: 10px 0; font-family: inherit; max-height: 400px; overflow-y: auto; border: 1px solid #e9edef; color: #111b21;`;

        menu.innerHTML = `<div style="padding: 8px 15px; font-size: 11px; font-weight: bold; color: #8696a0; border-bottom: 1px solid #f0f2f5; margin-bottom: 5px;">GESTIONAR ETIQUETAS</div>`;
        if(!allLabels.length) menu.innerHTML += `<div style="padding:15px;text-align:center;">Sin etiquetas.</div>`;

        allLabels.forEach(label => {
            const isChecked = chatLabelIds.includes(label.id);
            const row = document.createElement("div");
            row.style.cssText = "display:flex; align-items:center; padding:8px 15px; cursor:pointer; gap:10px;";
            row.onmouseenter = () => row.style.background = "#f5f6f6";
            row.onmouseleave = () => row.style.background = "transparent";

            row.innerHTML = `
                <div style="width:18px; height:18px; border-radius:3px; border: 2px solid ${isChecked ? '#00a884' : '#d1d7db'}; background: ${isChecked ? '#00a884' : 'white'}; display:flex; align-items:center; justify-content:center;">${isChecked ? ICONS.check : ''}</div>
                <div style="width:10px; height:10px; border-radius:50%; background:${label.hexColor}; flex-shrink:0;"></div>
                <div style="flex:1;">${label.name}</div>
                <div style="font-size: 11px; color: #8696a0; background: #f0f2f5; padding: 2px 6px; border-radius: 10px;">${label.count||0}</div>
            `;
            
            row.onclick = async (e) => {
                e.stopPropagation();
                try {
                    const type = !isChecked ? 'add' : 'remove';
                    const fn = labelModule.addOrRemoveLabels;
                    if (fn) await fn.call(labelModule, [chatId], [{ labelId: label.id, type: type }]);
                    else {
                        if (!isChecked && labelModule.addLabels) await labelModule.addLabels([label.id], [chatId]);
                        else if (isChecked && labelModule.removeLabels) await labelModule.removeLabels([label.id], [chatId]);
                    }
                    setTimeout(() => menu.remove(), 200);
                } catch(err) {
                    try {
                        const Store = WPP.whatsapp.Store;
                        const labelModel = Store.Label.get(label.id);
                        const chatModel = Store.Chat.get(chatId);
                        await Store.Label.addOrRemoveLabels([labelModel], [chatModel]);
                        setTimeout(() => menu.remove(), 200);
                    } catch(e2) { alert("Error asignando etiqueta."); }
                }
            };
            menu.appendChild(row);
        });
        document.body.appendChild(menu);
        setTimeout(() => { document.addEventListener('click', function close(e) { if (!menu.contains(e.target) && !btnElement.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }}); }, 100);
    } catch (err) { alert("Error: " + err.message); btnElement.innerHTML = originalContent; }
}

// ==========================================
// 6. MÓDULO: ESTADOS
// ==========================================
async function abrirModalEstados() {
    if (document.getElementById("crm-status-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "crm-status-modal";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;font-family:inherit;`;
    
    overlay.innerHTML = `
        <div style="background:white;width:500px;height:600px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;flex-direction:column;">
            <div style="padding:15px;background:#f0f2f5;display:flex;justify-content:space-between;"><h3>${ICONS.status} Estados</h3><div id="st-close" style="cursor:pointer;">✕</div></div>
            <div style="display:flex;border-bottom:1px solid #ddd;"><div id="tab-p" style="flex:1;padding:10px;text-align:center;cursor:pointer;border-bottom:3px solid #00a884;">Pendientes</div><div id="tab-c" style="flex:1;padding:10px;text-align:center;cursor:pointer;">+ Crear</div></div>
            <div id="st-content" style="flex:1;padding:15px;overflow-y:auto;"></div>
        </div>`;
    document.body.appendChild(overlay);

    const renderPending = () => {
        const div = document.getElementById('st-content');
        div.innerHTML = '';
        scheduledStatuses.filter(s => s.status==='pending').forEach(st => {
            const item = document.createElement('div');
            item.innerHTML = `<div style="border:1px solid #eee;padding:10px;margin-bottom:5px;display:flex;justify-content:space-between;"><div><b>${st.type}</b>: ${new Date(st.time).toLocaleString()}</div><div style="cursor:pointer;color:red;" onclick="deleteStatus(${st.id})">${ICONS.trash}</div></div>`;
            div.appendChild(item);
        });
    };

    const renderCreate = () => {
        const div = document.getElementById('st-content');
        div.innerHTML = `
            <input type="datetime-local" id="st-date" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;">
            <div style="margin-bottom:10px;">
                <label><input type="radio" name="st-type" value="text" checked> Texto</label>
                <label><input type="radio" name="st-type" value="media"> Foto/Video</label>
            </div>
            <div id="st-text-area">
                <textarea id="st-txt" placeholder="Texto..." style="width:100%;padding:10px;margin-bottom:10px;"></textarea>
                <input type="color" id="st-color" value="#00a884" style="width:100%;height:40px;margin-bottom:10px;">
            </div>
            <div id="st-media-area" style="display:none;">
                <input type="file" id="st-file" style="margin-bottom:10px;">
                <input type="text" id="st-caption" placeholder="Comentario..." style="width:100%;padding:10px;margin-bottom:10px;">
            </div>
            <button id="st-save" style="width:100%;padding:10px;background:#00a884;color:white;border:none;">Guardar</button>
        `;
        
        const radios = document.getElementsByName('st-type');
        radios.forEach(r => r.onchange = () => {
            document.getElementById('st-text-area').style.display = r.value === 'text' ? 'block' : 'none';
            document.getElementById('st-media-area').style.display = r.value === 'media' ? 'block' : 'none';
        });

        document.getElementById('st-save').onclick = () => {
            const time = new Date(document.getElementById('st-date').value).getTime();
            const type = document.querySelector('input[name="st-type"]:checked').value;
            const statusObj = { id: Date.now(), time, status: 'pending', type };

            if(time <= Date.now()) return alert("Fecha futura requerida.");

            if(type === 'text') {
                statusObj.content = document.getElementById('st-txt').value;
                statusObj.backgroundColor = document.getElementById('st-color').value;
                if(!statusObj.content) return alert("Escribe texto.");
            } else {
                const fileIn = document.getElementById('st-file');
                if(!fileIn.files.length) return alert("Sube un archivo.");
                statusObj.file = fileIn.files[0]; 
                statusObj.fileName = fileIn.files[0].name;
                statusObj.caption = document.getElementById('st-caption').value;
            }

            scheduledStatuses.push(statusObj);
            saveStatuses(); 
            renderPending();
            document.getElementById('tab-p').click();
        };
    };

    document.getElementById('st-close').onclick = () => overlay.remove();
    document.getElementById('tab-p').onclick = () => { document.getElementById('tab-p').style.borderBottom='3px solid #00a884'; document.getElementById('tab-c').style.borderBottom='none'; renderPending(); };
    document.getElementById('tab-c').onclick = () => { document.getElementById('tab-c').style.borderBottom='3px solid #00a884'; document.getElementById('tab-p').style.borderBottom='none'; renderCreate(); };
    renderPending();
    window.deleteStatus = (id) => { scheduledStatuses = scheduledStatuses.filter(s => s.id!==id); saveStatuses(); renderPending(); };
}

function checkScheduledStatuses() {
    const now = Date.now();
    scheduledStatuses.forEach(async st => {
        if(st.status === 'pending' && st.time <= now) {
            st.status = 'sent'; 
            saveStatuses();
            
            try { 
                if(st.type === 'text') {
                    await WPP.status.sendTextStatus(st.content, { backgroundColor: st.backgroundColor, font: 1 }); 
                } else if(st.file) {
                    const reader = new FileReader();
                    reader.readAsDataURL(st.file);
                    reader.onloadend = async () => {
                        await WPP.chat.sendFileMessage('status@broadcast', reader.result, {
                            caption: st.caption
                        });
                    }
                }
            } catch(e){ console.error("Error Status:", e); }
        }
    });
}

// ==========================================
// 7. MÓDULO: DIFUSIÓN + ANTI-SPAM
// ==========================================
async function abrirModalDifusion() {
    if (document.getElementById("crm-broadcast-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "crm-broadcast-modal";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;font-family:inherit;`;
    
    let options = `<option value="">Selecciona Etiqueta...</option>`;
    try {
        const lm = getLabelModule();
        const all = await (lm.getAllLabels || lm.getAll).call(lm);
        all.forEach(l => options += `<option value="${l.id}">${l.name} (${l.count||0})</option>`);
    } catch(e) {}

    overlay.innerHTML = `
        <div style="background:white;width:450px;padding:20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0;">📢 Nueva Difusión</h3>
            
            <label style="font-size:12px;color:#666;">Destinatarios (Etiqueta):</label>
            <select id="bc-label" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #ccc;">${options}</select>
            
            <div style="background:#f8f9fa;padding:10px;border-radius:8px;border:1px solid #eee;margin-bottom:15px;">
                <h4 style="margin:0 0 10px 0;font-size:13px;color:#54656f;">🛡️ Sistema Anti-Spam</h4>
                <div style="display:flex;align-items:center;gap:10px;">
                    <label style="font-size:12px;">Enviar Lote de</label>
                    <input type="number" id="bc-batch" value="5" min="1" style="width:50px;padding:5px;border:1px solid #ccc;">
                    <label style="font-size:12px;">msgs cada</label>
                    <input type="number" id="bc-interval" value="60" min="5" style="width:50px;padding:5px;border:1px solid #ccc;">
                    <label style="font-size:12px;">segundos</label>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                 <label><input type="radio" name="bc-type" value="text" checked> Mensaje Texto</label>
                 <label style="margin-left:10px;"><input type="radio" name="bc-type" value="media"> Imagen/Archivo</label>
            </div>

            <div id="bc-text-container">
                <textarea id="bc-msg" placeholder="Escribe tu mensaje..." rows="4" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;"></textarea>
            </div>

            <div id="bc-media-container" style="display:none;">
                <input type="file" id="bc-file" style="margin-bottom:10px;">
                <input type="text" id="bc-caption" placeholder="Comentario para la imagen..." style="width:100%;padding:10px;border:1px solid #ccc;">
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:15px;">
                <button id="bc-cancel-btn" style="padding:10px 20px;background:#eee;border:none;border-radius:20px;cursor:pointer;">Cancelar</button>
                <button id="bc-send" style="padding:10px 20px;background:#00a884;color:white;border:none;border-radius:20px;cursor:pointer;">Iniciar Campaña</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const radios = document.getElementsByName('bc-type');
    radios.forEach(r => r.onchange = () => {
        document.getElementById('bc-text-container').style.display = r.value === 'text' ? 'block' : 'none';
        document.getElementById('bc-media-container').style.display = r.value === 'media' ? 'block' : 'none';
    });

    document.getElementById('bc-cancel-btn').onclick = () => overlay.remove();

    document.getElementById('bc-send').onclick = async () => {
        const labelId = document.getElementById('bc-label').value;
        const type = document.querySelector('input[name="bc-type"]:checked').value;
        const batchSize = parseInt(document.getElementById('bc-batch').value) || 5;
        const interval = parseInt(document.getElementById('bc-interval').value) || 60;
        
        if(!labelId) return alert("Selecciona una etiqueta.");

        const chats = await WPP.chat.list();
        const targets = chats.filter(c => c.labels && c.labels.includes(labelId)).map(c => c.id._serialized);
        
        if(!targets.length) return alert("La etiqueta seleccionada no tiene contactos.");

        const broadcastObj = {
            id: Date.now(),
            recipients: targets,
            sentCount: 0,
            status: 'processing',
            nextBatchTime: Date.now(),
            type: type,
            batchSize: batchSize,
            interval: interval * 1000 // Convertir a ms
        };

        if(type === 'text') {
            const msg = document.getElementById('bc-msg').value;
            if(!msg) return alert("Escribe un mensaje.");
            broadcastObj.message = msg;
        } else {
            const fileIn = document.getElementById('bc-file');
            if(!fileIn.files.length) return alert("Selecciona un archivo.");
            broadcastObj.file = fileIn.files[0];
            broadcastObj.fileName = fileIn.files[0].name;
            broadcastObj.caption = document.getElementById('bc-caption').value;
        }

        scheduledBroadcasts.push(broadcastObj);
        saveBroadcasts();
        alert(`Iniciando campaña para ${targets.length} contactos.`);
        overlay.remove();
    };
}

async function checkBroadcasts() {
    const now = Date.now();
    for (let i = 0; i < scheduledBroadcasts.length; i++) {
        const b = scheduledBroadcasts[i];
        
        if (b.status === 'processing' && now >= b.nextBatchTime) {
            
            // Check completion
            if (b.sentCount >= b.recipients.length) { 
                b.status = 'completed'; 
                saveBroadcasts(); 
                continue; 
            }
            
            // Lógica Anti-Spam: Enviar Lote
            const limit = b.batchSize || 5;
            const batch = b.recipients.slice(b.sentCount, b.sentCount + limit);
            
            console.log(`📢 Enviando lote de ${batch.length} mensajes. Progreso: ${b.sentCount}/${b.recipients.length}`);

            for(const chatId of batch) {
                try { 
                    if(b.type === 'text') {
                        await WPP.chat.sendTextMessage(chatId, b.message); 
                    } else if(b.file) {
                        const reader = new FileReader();
                        reader.readAsDataURL(b.file);
                        await new Promise(resolve => {
                            reader.onloadend = async () => {
                                await WPP.chat.sendFileMessage(chatId, reader.result, {
                                    filename: b.fileName,
                                    caption: b.caption
                                });
                                resolve();
                            }
                        });
                    }
                    // Pequeña pausa humana entre mensajes del mismo lote
                    await new Promise(r => setTimeout(r, Math.random() * 1500 + 500)); 
                } catch(e){ console.error("Error Broadcast:", e); }
            }
            
            b.sentCount += batch.length;
            b.nextBatchTime = now + (b.interval || 60000); // Esperar intervalo configurado
            saveBroadcasts();
        }
    }
}

// ==========================================
// 8. MÓDULO: PROGRAMADOR & FILTRO
// ==========================================
async function abrirModalProgramacion(taskToEdit = null) {
    if (document.getElementById("crm-schedule-modal")) return;
    const chatId = await obtenerChatId();
    if (!chatId) return alert("Abre un chat primero.");

    let defaultText = taskToEdit ? (taskToEdit.text || "") : "";
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const defaultDate = d.toISOString().slice(0, 16);

    const overlay = document.createElement("div");
    overlay.id = "crm-schedule-modal";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;font-family:inherit;`;
    
    overlay.innerHTML = `
        <div style="background:white;width:350px;padding:20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0;color:#111b21;">📅 Programar Mensaje</h3>
            <input type="datetime-local" id="crm-date" value="${defaultDate}" style="width:100%;padding:8px;margin-bottom:15px;border:1px solid #ccc;border-radius:5px;">
            <textarea id="crm-msg" rows="4" placeholder="Mensaje..." style="width:100%;padding:8px;margin-bottom:10px;border:1px solid #ccc;border-radius:5px;resize:none;">${defaultText}</textarea>
            <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button id="crm-cancel" style="padding:8px 16px;border:none;background:#f0f2f5;border-radius:20px;cursor:pointer;">Cancelar</button>
                <button id="crm-save" style="padding:8px 16px;border:none;background:#00a884;color:white;border-radius:20px;cursor:pointer;">Guardar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.getElementById("crm-cancel").onclick = () => overlay.remove();
    document.getElementById("crm-save").onclick = () => {
        const dateVal = document.getElementById("crm-date").value;
        const msgVal = document.getElementById("crm-msg").value;
        if (!dateVal || !msgVal) return alert("Completa los campos.");
        
        const time = new Date(dateVal).getTime();
        if (time <= Date.now()) return alert("Fecha futura requerida.");

        if (taskToEdit) scheduledMessages = scheduledMessages.filter(t => t.id !== taskToEdit.id);
        
        const newTask = { id: taskToEdit ? taskToEdit.id : Date.now(), chatId, text: msgVal, time, status: 'pending', file: null };
        scheduledMessages.push(newTask);
        saveMessages();
        
        if(window.CRM_Supabase) window.CRM_Supabase.saveScheduledMessage(newTask);

        overlay.remove();
        renderScheduledMessageBubble(chatId);
        actualizarIconosSidebar();
    };
}

function checkScheduledTasks() {
    const now = Date.now();
    scheduledMessages.forEach(task => {
        if (task.status === 'pending' && task.time <= now) { executeTask(task); }
    });
}
async function executeTask(task) {
    scheduledMessages = scheduledMessages.filter(t => t.id !== task.id);
    saveMessages();
    try {
        await WPP.chat.sendTextMessage(task.chatId, task.text);
        renderScheduledMessageBubble(task.chatId);
        actualizarIconosSidebar();
    } catch(e) { console.error(e); }
}

function renderScheduledMessageBubble(chatId) {
    const bubbleId = 'crm-scheduled-message-bubble';
    const existingBubble = document.getElementById(bubbleId);
    if (existingBubble) existingBubble.remove();
    
    const nextMessage = scheduledMessages.filter(m => m.chatId === chatId && m.status === 'pending').sort((a, b) => a.time - b.time)[0];
    if (!nextMessage) return;

    const header = document.querySelector("#main header");
    if (!header) return;

    const bubble = document.createElement('div');
    bubble.id = bubbleId;
    bubble.style.cssText = `background-color: #fff3cd; border-bottom: 1px solid #ffeeba; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; color: #111b21; z-index: 99;`;
    const timeStr = new Date(nextMessage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `
        <div style="display:flex;align-items:center;">
            <span style="margin-right:8px;">${ICONS.clockYellow}</span>
            <div><div style="font-weight:bold;font-size:13px;">Mensaje Programado</div><div style="font-size:12px;color:#54656f;">Para las ${timeStr}</div></div>
        </div>
        <div style="cursor:pointer; color:#d32f2f;" onclick="if(confirm('¿Borrar?')) { deleteScheduled(${nextMessage.id}); }">${ICONS.trash}</div>
    `;
    header.insertAdjacentElement('afterend', bubble);
}
window.deleteScheduled = (id) => { scheduledMessages = scheduledMessages.filter(m => m.id !== id); saveMessages(); const b = document.getElementById('crm-scheduled-message-bubble'); if(b) b.remove(); actualizarIconosSidebar(); }

// ==========================================
// 9. LOGICA DE FILTROS (PROGRAMADOS & ETIQUETAS)
// ==========================================
async function toggleGlobalFilter(type, btnElement, extraData = null) {
    const paneSide = document.getElementById("pane-side");
    if (!paneSide) return;

    const buttons = document.querySelectorAll('[id^="crm-btn-filter-"]');
    buttons.forEach(b => { b.style.backgroundColor = "#e9edef"; b.style.color = "#54656f"; b.style.border = "1px solid #d1d7db"; });

    if (currentFilter === type) {
        currentFilter = null;
        const o = document.getElementById("crm-filter-overlay");
        if(o) o.remove();
        return;
    }

    currentFilter = type;
    if (btnElement) {
        btnElement.style.backgroundColor = "#f0f2f5";
        btnElement.style.color = "#00a884";
        btnElement.style.border = "1px solid #00a884";
    }

    let chatsToShow = [];
    let emptyMessage = "No se encontraron chats.";

    if (type === 'scheduled') {
        const ids = [...new Set(scheduledMessages.filter(m => m.status === 'pending').map(m => m.chatId))];
        chatsToShow = ids.map(id => ({ id, type: 'sched' }));
        emptyMessage = "No hay mensajes programados pendientes.";
    } else if (type.startsWith('label:')) {
        const labelId = type.split(':')[1];
        try {
            const allChats = await WPP.chat.list();
            chatsToShow = allChats
                .filter(c => c.labels && c.labels.includes(labelId))
                .map(c => ({ id: c.id._serialized, type: 'label', chatObj: c }));
            emptyMessage = `No hay chats con la etiqueta "${extraData ? extraData.name : 'seleccionada'}".`;
        } catch (e) { console.error(e); }
    }

    renderOverlay(paneSide, chatsToShow, emptyMessage);
}

async function renderOverlay(paneSide, chatList, emptyMsg) {
    const existing = document.getElementById("crm-filter-overlay");
    if(existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "crm-filter-overlay";
    overlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 999; overflow-y: auto;`;

    if (chatList.length === 0) {
        overlay.innerHTML = `<div style="text-align:center; padding:40px; color:#8696a0; font-size:14px;">${emptyMsg}</div>`;
    } else {
        const listContainer = document.createElement("div");
        for (const item of chatList) {
            const chatId = item.id;
            let chatName = chatId;
            try {
                let contact = await WPP.contact.get(chatId);
                if (contact) chatName = contact.name || contact.formattedName || contact.pushname || chatName;
            } catch(e) {}

            const row = document.createElement("div");
            row.style.cssText = `display: flex; align-items: center; padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f2f5;`;
            row.innerHTML = `
                <div style="width:40px;height:40px;border-radius:50%;background:#ddd;margin-right:10px;"></div>
                <div><div style="font-weight:bold;">${chatName}</div><div style="font-size:12px;color:#666;">${item.type === 'sched' ? '🕒 Programado' : '🏷️ Etiqueta'}</div></div>
            `;
            row.onclick = () => { if (WPP.chat.openChatBottom) WPP.chat.openChatBottom(chatId); };
            listContainer.appendChild(row);
        }
        overlay.appendChild(listContainer);
    }
    paneSide.parentElement.style.position = "relative";
    paneSide.parentElement.appendChild(overlay);
}

async function showGlobalLabelDropdown(btnElement) {
    const existingMenu = document.getElementById("crm-global-label-menu");
    if (existingMenu) { existingMenu.remove(); return; }

    const lm = getLabelModule();
    if (!lm) return alert("Cargando etiquetas...");
    const allLabels = await (lm.getAllLabels || lm.getAll).call(lm);

    const menu = document.createElement("div");
    menu.id = "crm-global-label-menu";
    const rect = btnElement.getBoundingClientRect();
    menu.style.cssText = `position: fixed; top: ${rect.bottom + 5}px; left: ${rect.left - 50}px; width: 220px; background: white; padding: 8px 0; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); z-index: 999999; max-height: 400px; overflow-y: auto; color:#111b21; font-family: inherit;`;
    
    allLabels.forEach(l => {
        const div = document.createElement("div");
        div.style.cssText = "display:flex;align-items:center;padding:10px 20px;cursor:pointer;gap:10px;";
        div.onmouseenter = () => div.style.background = "#f5f6f6";
        div.onmouseleave = () => div.style.background = "transparent";
        div.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:${l.hexColor};"></div><span>${l.name} (${l.count||0})</span>`;
        div.onclick = () => { menu.remove(); toggleGlobalFilter(`label:${l.id}`, btnElement, l); };
        menu.appendChild(div);
    });

    document.body.appendChild(menu);
    setTimeout(() => { document.addEventListener('click', function c(e) { if(!menu.contains(e.target) && !btnElement.contains(e.target)) { menu.remove(); document.removeEventListener('click', c); }}); }, 100);
}

// ==========================================
// 10. TOOLBAR & UTILS
// ==========================================
function injectTopToolbar() {
    if (document.getElementById('crm-top-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'crm-top-bar';
    bar.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 45px; background: #ffffff; border-bottom: 1px solid #d1d7db; z-index: 999999; display: flex; align-items: center; justify-content: flex-end; padding: 0 16px; box-sizing: border-box; font-family: inherit; gap: 10px;`;
    
    const mkBtn = (icon, text, click, id) => {
        const b = document.createElement("div");
        if(id) b.id = id;
        b.innerHTML = `${icon} <span style="margin-left:6px;font-size:14px;">${text}</span>`;
        b.style.cssText = "display:flex;align-items:center;padding:6px 12px;background:#e9edef;color:#54656f;border-radius:24px;cursor:pointer;border:1px solid #d1d7db;";
        b.onclick = click;
        return b;
    };

    bar.appendChild(mkBtn(ICONS.cloud, "Conectar", () => window.CRM_Supabase && window.CRM_Supabase.login(), 'crm-btn-cloud'));
    bar.appendChild(mkBtn(ICONS.tag, "Etiquetas Generales", (e) => { e.stopPropagation(); showGlobalLabelDropdown(e.currentTarget); }, 'crm-btn-filter-tags'));
    bar.appendChild(mkBtn(ICONS.filter, "Programados", (e) => { e.stopPropagation(); toggleGlobalFilter('scheduled', e.currentTarget); }, 'crm-btn-filter-sched'));
    bar.appendChild(mkBtn(ICONS.status, "Estados", (e) => { e.stopPropagation(); abrirModalEstados(); }));
    bar.appendChild(mkBtn(ICONS.broadcast, "Difusión", (e) => { e.stopPropagation(); abrirModalDifusion(); }));
    bar.appendChild(mkBtn(ICONS.lightning, "M. Rápidos", (e) => { e.stopPropagation(); quickReplySystem.openManager(); }));

    document.body.prepend(bar);
    const app = document.getElementById('app');
    if(app) { app.style.top = '45px'; app.style.height = 'calc(100% - 45px)'; }
}

function createButton(iconSvg, text) {
    const btn = document.createElement("div");
    btn.innerHTML = `${iconSvg} <span style="margin-left: 6px;">${text}</span>`;
    btn.style.cssText = "display: flex; align-items: center; justify-content: center; padding: 6px 12px; background-color: #e9edef; color: #54656f; border-radius: 24px; cursor: pointer; font-size: 14px; font-weight: 500; border: 1px solid transparent;";
    return btn;
}

// Helpers WPP
async function obtenerChatId() {
    if (window.WPP && WPP.chat && WPP.chat.getActiveChat) { const c = WPP.chat.getActiveChat(); if(c && c.id) return c.id._serialized; }
    try { if (WPP.whatsapp && WPP.whatsapp.Store && WPP.whatsapp.Store.Chat) { const c = WPP.whatsapp.Store.Chat.active(); if(c && c.id) return c.id._serialized; }} catch(e){}
    try { const t = document.querySelector("#main header span[dir='auto']"); if(t) { const n = t.innerText; const l = await WPP.chat.list(); const f = l.find(x => x.name===n || x.formattedTitle===n); return f ? f.id._serialized : null; }} catch(e){}
    return null;
}
function getLabelModule() { return WPP.labels || WPP.label || null; }

function iniciarVigilanteSidebar() {
    const check = setInterval(() => {
        const pane = document.getElementById("pane-side");
        if(pane) { clearInterval(check); actualizarIconosSidebar(); new MutationObserver(actualizarIconosSidebar).observe(pane, {childList:true, subtree:true}); }
    }, 1000);
}
function actualizarIconosSidebar() {
    const pane = document.getElementById("pane-side");
    if(!pane) return;
    const chats = new Set(scheduledMessages.filter(m => m.status==='pending').map(m => m.chatId));
    pane.querySelectorAll('div[role="row"]').forEach(r => {
        const id = getChatIdFromRow(r);
        if(id && chats.has(id)) {
            if(!r.querySelector('#crm-sched-icon')) {
                const s = document.createElement('span'); s.id='crm-sched-icon'; s.innerHTML=ICONS.clockYellow; s.style.cssText="position:absolute;top:25px;right:15px;z-index:999;"; r.style.position='relative'; r.appendChild(s);
            }
        } else { const i = r.querySelector('#crm-sched-icon'); if(i) i.remove(); }
    });
}
function getChatIdFromRow(node) {
    try { const k = Object.keys(node).find(k=>k.startsWith("__reactFiber$")); let c=node[k]; while(c) { if(c.memoizedProps?.data?.id) return c.memoizedProps.data.id._serialized; c=c.return; }} catch(e){} return null;
}
function initSupabaseConnection() { window.addEventListener('message', (e) => { if(e.data?.action==='LOGIN_GOOGLE_RESPONSE' && e.data.payload.success) localStorage.setItem('crm_cloud_user', JSON.stringify(e.data.payload.user)); }); }

// ARRANQUE
const arranque = setInterval(() => { if (window.WPP && window.WPP.isReady) { clearInterval(arranque); iniciarVigilante(); }}, 1000);