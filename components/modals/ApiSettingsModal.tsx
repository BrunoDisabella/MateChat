
import React, { useState, useEffect } from 'react';
import { X, Save, Key, Globe, Eye, EyeOff, Copy, Plus, Trash2, CheckCircle2, LogOut, Loader2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface Webhook {
    id: string;
    url: string;
    events: string[]; // 'message' (Recibido), 'message_create' (Enviado)
}

interface ApiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    socket: Socket | null;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose, socket }) => {
    const [activeTab, setActiveTab] = useState<'api' | 'webhooks'>('api');
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [loading, setLoading] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    useEffect(() => {
        if (isOpen && socket) {
            setLoading(true);
            socket.emit('get-settings');

            const handleSettings = (data: { apiKey: string; webhooks?: Webhook[] }) => {
                setApiKey(data.apiKey || '');
                if (data.webhooks) {
                    setWebhooks(data.webhooks);
                }
                setLoading(false);
            };

            const handleUpdateResponse = (response: { success: boolean; error?: string }) => {
                setLoading(false);
                if (response.success) {
                    toast.success('Configuración guardada exitosamente');
                } else {
                    toast.error(response.error || 'Error al guardar la configuración');
                }
            };

            socket.on('settings-data', handleSettings);
            socket.on('settings-updated', handleUpdateResponse);

            return () => {
                socket.off('settings-data', handleSettings);
                socket.off('settings-updated', handleUpdateResponse);
            };
        }
    }, [isOpen, socket]);

    const handleSaveApiKey = () => {
        if (!socket) return;
        setLoading(true);
        socket.emit('update-api-key', { apiKey });
        // Safety timeout
        setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    toast.error('Tiempo de espera agotado. Verifica la consola del servidor.');
                    return false;
                }
                return prev;
            });
        }, 3000);
    };

    const handleSaveWebhooks = () => {
        if (!socket) return;
        setLoading(true);
        socket.emit('save-webhooks', webhooks);
        // Safety timeout
        setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    toast.error('Tiempo de espera agotado. Verifica la consola del servidor.');
                    return false;
                }
                return prev;
            });
        }, 3000);
    };

    const addWebhook = () => {
        setWebhooks([...webhooks, { id: uuidv4(), url: '', events: ['message'] }]);
    };

    const removeWebhook = (id: string) => {
        setWebhooks(webhooks.filter(w => w.id !== id));
    };

    const updateWebhook = (id: string, field: keyof Webhook, value: any) => {
        setWebhooks(webhooks.map(w => w.id === id ? { ...w, [field]: value } : w));
    };

    const toggleEvent = (webhookId: string, eventName: string) => {
        const webhook = webhooks.find(w => w.id === webhookId);
        if (!webhook) return;

        const newEvents = webhook.events.includes(eventName)
            ? webhook.events.filter(e => e !== eventName)
            : [...webhook.events, eventName];

        updateWebhook(webhookId, 'events', newEvents);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado');
    };

    const handleDisconnectWhatsApp = () => {
        if (!socket) return;
        if (!window.confirm('¿Estás seguro? Esto cerrará la sesión de WhatsApp y tendrás que escanear un nuevo código QR.')) {
            return;
        }

        setDisconnecting(true);
        socket.emit('logout');
        toast.success('Desconectando WhatsApp...');

        // Cerrar el modal después de un momento
        setTimeout(() => {
            setDisconnecting(false);
            onClose();
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between shrink-0">
                    <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Configuración
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6 pt-4 shrink-0">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'api' ? 'text-[#00a884]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        API Key
                        {activeTab === 'api' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00a884]" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('webhooks')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'webhooks' ? 'text-[#00a884]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Webhooks
                        {activeTab === 'webhooks' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00a884]" />}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">

                    {activeTab === 'api' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-[#00a884]" />
                                    Tu API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full pl-3 pr-20 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                                        >
                                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(apiKey)}
                                            className="p-1.5 text-gray-400 hover:text-[#00a884] rounded-md transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Usa esta clave en el header <code className="bg-gray-100 px-1 rounded">x-api-key</code> de tus peticiones.
                                </p>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-[#00a884] hover:bg-[#008f6f] rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {(loading && activeTab === 'api') ? <span className="animate-spin">⏳</span> : <Save className="w-4 h-4" />}
                                    Guardar API Key
                                </button>
                            </div>

                            {/* Zona de peligro */}
                            <div className="mt-8 pt-6 border-t border-red-100">
                                <h3 className="text-sm font-medium text-red-600 mb-3">Zona de peligro</h3>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-xs text-red-600 mb-3">
                                        Esto cerrará la sesión de WhatsApp y tendrás que escanear un nuevo código QR.
                                    </p>
                                    <button
                                        onClick={handleDisconnectWhatsApp}
                                        disabled={disconnecting}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                        {disconnecting ? 'Desconectando...' : 'Borrar conexión WhatsApp'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'webhooks' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-gray-600">Configura dónde enviar los eventos.</p>
                                <button
                                    onClick={addWebhook}
                                    className="text-xs font-medium text-[#00a884] flex items-center gap-1 hover:bg-[#00a884]/10 px-2 py-1.5 rounded-md transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar Webhook
                                </button>
                            </div>

                            <div className="space-y-4">
                                {webhooks.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        <p className="text-sm text-gray-400">No hay webhooks configurados</p>
                                    </div>
                                ) : (
                                    webhooks.map((hook) => (
                                        <div key={hook.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all hover:shadow-sm">
                                            <div className="flex gap-3 items-start">
                                                <div className="flex-1 space-y-3">
                                                    <input
                                                        type="url"
                                                        placeholder="https://tu-n8n.com/webhook/..."
                                                        value={hook.url}
                                                        onChange={(e) => updateWebhook(hook.id, 'url', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00a884] transition-colors"
                                                    />
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={hook.events.includes('message')}
                                                                onChange={() => toggleEvent(hook.id, 'message')}
                                                                className="rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
                                                            />
                                                            Recibidos
                                                        </label>
                                                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={hook.events.includes('message_create')}
                                                                onChange={() => toggleEvent(hook.id, 'message_create')}
                                                                className="rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
                                                            />
                                                            Enviados
                                                        </label>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeWebhook(hook.id)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100">
                                <button
                                    onClick={handleSaveWebhooks}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-[#00a884] hover:bg-[#008f6f] rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {(loading && activeTab === 'webhooks') ? <span className="animate-spin">⏳</span> : <Save className="w-4 h-4" />}
                                    Guardar Webhooks
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
