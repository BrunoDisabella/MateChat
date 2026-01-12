import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Label, Session } from '../../types';
import { Trash2, Plus, Tag, Copy } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  labels: Label[];
  socket: Socket | null;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#64748b', // slate
];

export const LabelManagerModal: React.FC<Props> = ({ isOpen, onClose, labels, socket }) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!name.trim() || !socket) return;
    socket.emit('create-label', { name: name.trim(), color: selectedColor });
    setName('');
  };

  const handleDelete = (id: string) => {
    if (!socket || !window.confirm('¿Eliminar etiqueta? Se quitará de todos los chats.')) return;
    socket.emit('delete-label', id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Etiquetas">
      <div className="flex flex-col h-[500px]">
        {/* Crear */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="space-y-3">
             <div className="flex gap-2">
                <div className="relative w-full">
                    <Tag className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nueva etiqueta..." 
                        className="pl-9 pr-3 py-2 border rounded-md w-full focus:outline-none focus:border-[#00a884]"
                    />
                </div>
                <button 
                    onClick={handleCreate}
                    disabled={!name.trim()}
                    className="bg-[#00a884] text-white px-4 py-2 rounded-md hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-5 h-5" />
                </button>
             </div>
             
             {/* Color Picker */}
             <div className="flex gap-2 items-center overflow-x-auto pb-1 custom-scrollbar">
                {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${selectedColor === color ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                    />
                ))}
             </div>
          </div>
        </div>
        
        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-2">
           <ul className="space-y-1">
             {labels.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">
                    No tienes etiquetas creadas.
                </div>
             )}
             {labels.map(label => (
               <li key={label.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg group border border-transparent hover:border-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }}></div>
                     <div className="flex flex-col">
                        <span className="font-medium text-gray-700 leading-tight">{label.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono select-all cursor-text flex items-center gap-1" title="ID para n8n/API">
                           ID: {label.id}
                        </span>
                     </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(label.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    title="Eliminar etiqueta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
               </li>
             ))}
           </ul>
        </div>
        
        <div className="p-3 bg-blue-50 text-blue-700 text-xs text-center border-t border-blue-100">
            Usa estos <strong>ID</strong> para configurar tus automatizaciones en n8n.
        </div>
      </div>
    </Modal>
  );
};