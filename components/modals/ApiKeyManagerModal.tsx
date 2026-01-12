import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { ApiConfig, Session } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
}

// Configuración dinámica de la URL
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = IS_LOCALHOST ? 'http://localhost:3001' : '';

export const ApiKeyManagerModal: React.FC<Props> = ({ isOpen, onClose, session }) => {
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ enabled: true, apiKey: '' });
  const [status, setStatus] = useState('');

  const fetchApiConfig = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-key`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.success) {
        setApiConfig(data.apiConfig);
      } else {
        setStatus('Error al obtener la configuración.');
      }
    } catch (error) {
      setStatus('Error de red al obtener la configuración.');
      console.error('Failed to fetch API config', error);
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      setStatus('');
      fetchApiConfig();
    }
  }, [isOpen, fetchApiConfig]);

  const handleSave = async () => {
    if (!session) return;
    setStatus('Guardando...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-key`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(apiConfig)
      });
      const data = await res.json();
      setStatus(data.success ? 'Configuración guardada.' : `Error: ${data.error}`);
      if(data.success) fetchApiConfig();
    } catch (e) {
      setStatus('Error al guardar la configuración.');
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestor de API Key">
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                Configura una API Key para permitir que sistemas externos (como n8n) envíen mensajes a través de tu WhatsApp.
            </p>
            <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-md hover:bg-gray-50">
                <input
                    type="checkbox"
                    checked={apiConfig.enabled}
                    onChange={(e) => setApiConfig(prev => ({...prev, enabled: e.target.checked}))}
                    className="w-5 h-5 text-[#00a884] rounded focus:ring-[#00a884]"
                />
                <span className="text-sm font-medium text-gray-700">Habilitar acceso por API</span>
            </label>
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                 <input
                    type="text"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig(prev => ({...prev, apiKey: e.target.value}))}
                    placeholder="Ej: clave_secreta_123"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#00a884] focus:border-[#00a884] outline-none"
                />
            </div>
             <button
                onClick={handleSave}
                className="w-full py-2 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-md font-medium transition-colors"
              >
                Guardar Configuración
            </button>
            {status && (
                <p className={`text-sm text-center mt-2 ${status.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                    {status}
                </p>
            )}
        </div>
    </Modal>
  );
};