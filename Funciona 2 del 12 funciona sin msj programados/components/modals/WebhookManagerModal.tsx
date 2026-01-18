import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Webhook, Session } from '../../types';
import { useConsole } from '../../contexts/ConsoleContext';
import { Trash2, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
}

// Configuración dinámica de la URL
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = IS_LOCALHOST ? 'http://localhost:3001' : '';

export const WebhookManagerModal: React.FC<Props> = ({ isOpen, onClose, session }) => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [onReceive, setOnReceive] = useState(false);
  const [onSent, setOnSent] = useState(false);
  const [isServerConfigured, setIsServerConfigured] = useState<boolean | null>(null);
  const { logEvent } = useConsole();

  const fetchWebhooks = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/webhooks`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (data.success) {
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    }
  }, [session]);

  useEffect(() => {
    const checkServerStatus = async () => {
        if (!session) return;
        logEvent('WebhookManager', 'info', 'Checking webhook server status...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/webhooks/status`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error('Server error');

            const data = await response.json();
            if (data.success) {
                setIsServerConfigured(data.configured);
            }
        } catch (error: any) {
            logEvent('WebhookManager', 'error', 'Failed status check', error.message);
            setIsServerConfigured(false);
        }
    };

    if (isOpen) {
      setIsServerConfigured(null);
      checkServerStatus();
      fetchWebhooks();
    }
  }, [isOpen, session, fetchWebhooks, logEvent]);
  
  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim() || !session) return;
    try {
        await fetch(`${API_BASE_URL}/api/webhooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ url: newWebhookUrl, onMessageReceived: onReceive, onMessageSent: onSent })
        });
        setNewWebhookUrl('');
        setOnReceive(false);
        setOnSent(false);
        fetchWebhooks();
    } catch (error) {
        console.error('Error adding webhook:', error);
    }
  };
  
  const handleDeleteWebhook = async (url: string) => {
    if (!session) return;
    try {
        await fetch(`${API_BASE_URL}/api/webhooks`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ url })
        });
        fetchWebhooks();
    } catch(error) {
        alert('Error al eliminar webhook.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestor de Webhooks">
       <div className="flex flex-col h-[500px]">
        <div className="mb-4">
            {isServerConfigured === null ? (
                <div className="p-3 bg-gray-100 rounded-md text-sm text-gray-600 animate-pulse">Verificando configuración...</div>
            ) : isServerConfigured ? (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm flex gap-2">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <p>Servidor configurado correctamente para Webhooks.</p>
                </div>
            ) : (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm flex gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>Falta configurar `SUPABASE_SERVICE_ROLE_KEY` en el servidor.</p>
                </div>
            )}
        </div>

        <div className="mb-4 border-b border-gray-100 pb-4">
          <div className="space-y-3">
             <input
              type="text"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="URL del Webhook (https://...)"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:border-[#00a884]"
            />
            <div className="flex items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={onReceive} onChange={e => setOnReceive(e.target.checked)} className="rounded text-[#00a884] focus:ring-[#00a884]"/>
                    <span className="text-sm text-gray-700">Recibir Mensajes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={onSent} onChange={e => setOnSent(e.target.checked)} className="rounded text-[#00a884] focus:ring-[#00a884]"/>
                    <span className="text-sm text-gray-700">Enviar Mensajes</span>
                </label>
            </div>
             <button
                onClick={handleAddWebhook}
                className="w-full bg-[#00a884] text-white px-4 py-2 rounded-md hover:bg-[#008f6f] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Añadir Webhook
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            <h4 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wider">Configurados</h4>
            <ul className="space-y-2">
                {webhooks.length === 0 && <p className="text-gray-400 text-sm text-center">No hay webhooks.</p>}
                {webhooks.map(hook => (
                    <li key={hook.url} className="flex flex-col p-3 rounded-md border border-gray-100 hover:bg-gray-50 text-sm gap-2">
                        <span className="font-mono text-gray-700 truncate font-semibold">{hook.url}</span>
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                                {hook.onMessageReceived && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">Entrante</span>}
                                {hook.onMessageSent && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Saliente</span>}
                            </div>
                            <button onClick={() => handleDeleteWebhook(hook.url)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </Modal>
  );
};