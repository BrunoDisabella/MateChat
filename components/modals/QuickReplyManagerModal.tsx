import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { QuickReply, Session } from '../../types';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  quickReplies: QuickReply[];
  onUpdate: () => void;
}

// Configuración dinámica de la URL
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = IS_LOCALHOST ? 'http://localhost:3001' : '';

export const QuickReplyManagerModal: React.FC<Props> = ({ isOpen, onClose, session, quickReplies, onUpdate }) => {
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAddReply = async () => {
    setError('');
    if (!shortcut.trim() || !message.trim()) {
      setError('El atajo y el mensaje son obligatorios.');
      return;
    }
    // Validar que el atajo empiece con / opcionalmente, pero lo guardamos limpio
    const cleanShortcut = shortcut.startsWith('/') ? shortcut.slice(1) : shortcut;
    
    if (cleanShortcut.includes(' ')) {
        setError('El atajo no puede contener espacios.');
        return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/quick-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ shortcut: cleanShortcut, message }),
      });
      const data = await res.json();
      if (data.success) {
        setShortcut('');
        setMessage('');
        onUpdate();
      } else {
        setError(data.error || 'No se pudo añadir la respuesta rápida.');
      }
    } catch (e) {
      setError('Error de red.');
    }
  };

  const handleDeleteReply = async (id: string) => {
    if (!window.confirm('¿Eliminar esta respuesta rápida?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/quick-replies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        onUpdate();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Error de red al eliminar.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Respuestas Rápidas">
      <div className="flex flex-col h-[500px]">
        <div className="mb-4 border-b border-gray-100 pb-4">
          <div className="space-y-3">
             {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
                <span className="flex items-center text-gray-500 font-mono">/</span>
                <input
                type="text"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="atajo (ej: saludo)"
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:border-[#00a884]"
                />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje completo aquí..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:border-[#00a884]"
            />
            <button
              onClick={handleAddReply}
              className="w-full bg-[#00a884] text-white px-4 py-2 rounded-md hover:bg-[#008f6f] flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Añadir Respuesta
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1">
          <h4 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wider">Guardadas</h4>
          <ul className="space-y-2">
            {quickReplies.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No tienes respuestas rápidas.</p>}
            {quickReplies.map(reply => (
              <li key={reply.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 group transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#00a884] font-mono">/{reply.shortcut}</span>
                  <button onClick={() => handleDeleteReply(reply.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{reply.message}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
};