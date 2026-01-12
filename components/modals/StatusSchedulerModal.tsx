import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { ScheduledStatus } from '../../types';
import { Trash2, Plus, Type, Image as ImageIcon, Video, Calendar, Upload, X } from 'lucide-react';
import { blobToBase64 } from '../../utils/formatters';
import type { Socket } from 'socket.io-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
}

const BG_COLORS = [
    '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e', '#14b8a6', 
    '#64748b', '#0f172a'
];

export const StatusSchedulerModal: React.FC<Props> = ({ isOpen, onClose, socket }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [statuses, setStatuses] = useState<ScheduledStatus[]>([]);
  
  // Create Form States
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[4]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const minDateTime = new Date().toISOString().slice(0, 16);

  useEffect(() => {
    if (isOpen && socket) {
        socket.emit('get-scheduled-statuses');
        const handleStatuses = (data: ScheduledStatus[]) => setStatuses(data);
        socket.on('scheduled-statuses-list', handleStatuses);
        return () => {
            socket.off('scheduled-statuses-list', handleStatuses);
        };
    }
  }, [isOpen, socket]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setMediaFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setMediaPreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleSchedule = async () => {
      if (!scheduledDate || !socket) return alert('Debes seleccionar una fecha y hora');
      
      const payload: any = {
          type,
          scheduled_time: new Date(scheduledDate).toISOString(),
          status: 'pending'
      };

      if (type === 'text') {
          if(!text.trim()) return alert('El texto no puede estar vacío');
          payload.content = text;
          payload.background_color = bgColor;
      } else {
          if(!mediaFile) return alert('Debes subir un archivo');
          const base64 = await blobToBase64(mediaFile);
          payload.media_data = base64;
          payload.media_mimetype = mediaFile.type;
          payload.content = text; // Caption
      }

      socket.emit('create-scheduled-status', payload);
      
      // Reset
      setText('');
      setMediaFile(null);
      setMediaPreview(null);
      setScheduledDate('');
      setActiveTab('list');
  };

  const handleDelete = (id: string) => {
      if (confirm('¿Eliminar estado programado?') && socket) {
          socket.emit('delete-scheduled-status', id);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Programar Estados">
      <div className="flex flex-col h-[600px]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
            <button 
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'create' ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setActiveTab('create')}
            >
                Crear Nuevo
            </button>
            <button 
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'list' ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setActiveTab('list')}
            >
                Programados ({statuses.filter(s => s.status === 'pending').length})
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
            {activeTab === 'create' ? (
                <div className="space-y-6">
                    {/* Type Selector */}
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setType('text')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 w-24 transition-all ${type === 'text' ? 'border-[#00a884] bg-green-50 text-[#00a884]' : 'border-gray-200 text-gray-500'}`}>
                            <Type className="w-6 h-6" />
                            <span className="text-xs font-medium">Texto</span>
                        </button>
                        <button onClick={() => setType('image')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 w-24 transition-all ${type === 'image' ? 'border-[#00a884] bg-green-50 text-[#00a884]' : 'border-gray-200 text-gray-500'}`}>
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-xs font-medium">Imagen</span>
                        </button>
                        <button onClick={() => setType('video')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 w-24 transition-all ${type === 'video' ? 'border-[#00a884] bg-green-50 text-[#00a884]' : 'border-gray-200 text-gray-500'}`}>
                            <Video className="w-6 h-6" />
                            <span className="text-xs font-medium">Video</span>
                        </button>
                    </div>

                    {/* Content Preview & Input */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100 relative min-h-[250px] flex flex-col">
                        {type === 'text' ? (
                            <div className="flex-1 flex items-center justify-center p-8 transition-colors" style={{ backgroundColor: bgColor }}>
                                <textarea 
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    placeholder="Escribe tu estado..."
                                    className="w-full bg-transparent text-white text-center text-xl font-medium outline-none placeholder:text-white/50 resize-none overflow-hidden"
                                    rows={4}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
                                {mediaPreview ? (
                                    <>
                                        {type === 'image' ? (
                                            <img src={mediaPreview} alt="Preview" className="max-h-[200px] object-contain" />
                                        ) : (
                                            <video src={mediaPreview} className="max-h-[200px] object-contain" controls />
                                        )}
                                        <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
                                        <Upload className="w-8 h-8" />
                                        <span className="text-sm">Subir {type === 'image' ? 'Foto' : 'Video'}</span>
                                    </button>
                                )}
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept={type === 'image' ? "image/*" : "video/*"} 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                />
                            </div>
                        )}
                        
                        {/* Caption input for media */}
                        {type !== 'text' && (
                            <div className="p-3 bg-white border-t border-gray-200">
                                <input 
                                    type="text" 
                                    value={text} 
                                    onChange={e => setText(e.target.value)}
                                    placeholder="Añadir comentario..."
                                    className="w-full outline-none text-sm text-gray-700"
                                />
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                        {type === 'text' && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {BG_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => setBgColor(c)}
                                        className={`w-8 h-8 rounded-full border-2 shrink-0 ${bgColor === c ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha de Publicación</label>
                            <input 
                                type="datetime-local" 
                                value={scheduledDate}
                                min={minDateTime}
                                onChange={e => setScheduledDate(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-[#00a884] text-sm"
                            />
                        </div>

                        <button 
                            onClick={handleSchedule}
                            disabled={!scheduledDate || (type === 'text' && !text) || (type !== 'text' && !mediaFile)}
                            className="w-full bg-[#00a884] text-white py-3 rounded-lg font-bold hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Programar Estado
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {statuses.length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-sm">No hay estados programados.</div>
                    )}
                    
                    {statuses.map(status => {
                        const date = new Date(status.scheduled_time);
                        const isPending = status.status === 'pending';
                        
                        return (
                            <div key={status.id} className="border border-gray-200 rounded-lg p-3 flex gap-3 hover:bg-gray-50 transition-colors">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-gray-200 flex items-center justify-center">
                                    {status.type === 'text' ? (
                                        <div className="w-full h-full flex items-center justify-center text-[8px] text-white p-1 text-center" style={{ backgroundColor: status.background_color }}>
                                            {status.content?.substring(0, 20)}...
                                        </div>
                                    ) : (
                                        <div className="text-gray-400">
                                            {status.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isPending ? 'bg-yellow-100 text-yellow-700' : status.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {status.status === 'sent' ? 'Publicado' : status.status === 'pending' ? 'Pendiente' : 'Error'}
                                        </span>
                                        <button onClick={() => handleDelete(status.id)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    {status.content && <p className="text-sm text-gray-800 truncate">{status.content}</p>}
                                    {status.error && <p className="text-xs text-red-500 mt-1">{status.error}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </Modal>
  );
};