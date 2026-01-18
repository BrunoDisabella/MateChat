
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNatashaNotes } from '../hooks/useNatashaNotes.ts';
import { NatashaNote } from '../types.ts';
import { HeartIcon, PlusIcon, SearchIcon, TrashIcon, ImageIcon, XIcon, MicrophoneIcon, StopIcon, SendIcon, CogIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { toast } from 'sonner';
import { Logger } from '../lib/logger.ts';

export const NatashaNotesPage: React.FC = () => {
    const { notes, isLoading, addNote, updateNote, deleteNote } = useNatashaNotes();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<NatashaNote | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // HTTP Request Config State
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [apiUrl, setApiUrl] = useState('https://matechat.losgurises.com.uy/api/send-message');
    const [apiKey, setApiKey] = useState('matechat.com');
    const [chatId, setChatId] = useState('');

    // Form States
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // Audio Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Load Config on mount
    useEffect(() => {
        setApiUrl(localStorage.getItem('MATECHAT_API_URL') || 'https://matechat.losgurises.com.uy/api/send-message');
        // Valor por defecto basado en tus capturas de n8n ('matechat.com')
        setApiKey(localStorage.getItem('MATECHAT_API_KEY') || 'matechat.com');
        setChatId(localStorage.getItem('MATECHAT_CHAT_ID') || '');
    }, []);

    const filteredNotes = useMemo(() => {
        if (!searchTerm) return notes;
        const normalize = (text: string) => 
            text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const term = normalize(searchTerm);
        return notes.filter(n => 
            normalize(n.title || '').includes(term) || 
            normalize(n.content || '').includes(term)
        );
    }, [notes, searchTerm]);

    const handleOpenModal = (note?: NatashaNote) => {
        if (note) {
            setEditingNote(note);
            setTitle(note.title || '');
            setContent(note.content || '');
            setImagePreview(note.image_url || null);
            setAudioPreview(note.audio_url || null);
        } else {
            setEditingNote(null);
            setTitle('');
            setContent('');
            setImagePreview(null);
            setAudioPreview(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isRecording) stopRecording();
        setIsModalOpen(false);
        setEditingNote(null);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Audio Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    setAudioPreview(reader.result as string);
                };
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("No se pudo acceder al micrófono.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title && !content && !imagePreview && !audioPreview) {
            toast.error('La nota debe tener algún contenido.');
            return;
        }

        const noteData = {
            title,
            content,
            image_url: imagePreview || undefined,
            audio_url: audioPreview || undefined
        };

        if (editingNote) {
            await updateNote(editingNote.id, noteData);
        } else {
            await addNote(noteData);
        }
        handleCloseModal();
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteId(id);
    };

    const handleSendClick = async (note: NatashaNote, e: React.MouseEvent) => {
        e.stopPropagation();
        
        const currentApiUrl = localStorage.getItem('MATECHAT_API_URL');
        const rawApiKey = localStorage.getItem('MATECHAT_API_KEY');
        const currentChatId = localStorage.getItem('MATECHAT_CHAT_ID');
        
        if (!currentApiUrl || !rawApiKey || !currentChatId) {
            toast.error("Falta configuración. Revisa URL, API Key y Chat ID (⚙️).");
            setIsConfigOpen(true);
            return;
        }

        const currentApiKey = rawApiKey.trim();
        const toastId = toast.loading("Enviando solicitud HTTP...");

        try {
            // 1. Construir el Caption (Texto)
            let messageText = "";
            if (note.title) messageText += `*${note.title}*\n\n`;
            if (note.content) messageText += note.content;
            
            // 2. Preparar el Payload (Cuerpo del JSON)
            const payload: any = {
                chatId: currentChatId,
                text: messageText || " "
            };

            // 3. Lógica de Media (Imagen/Audio) adaptada a la estructura de n8n
            // n8n espera un objeto { base64, mimetype, fileName } dentro de 'media'
            const mediaSource = note.image_url || note.audio_url;

            if (mediaSource) {
                // Formato DataURI: "data:image/png;base64,iVBORw0KGgo..."
                const parts = mediaSource.split(',');
                
                if (parts.length === 2) {
                    const header = parts[0]; // "data:image/png;base64"
                    const base64Data = parts[1]; // "iVBORw0KGgo..."
                    
                    // Extraer mimetype
                    const mimeMatch = header.match(/:(.*?);/);
                    const mimetype = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                    
                    // Generar nombre de archivo
                    const ext = mimetype.split('/')[1] || 'bin';
                    const fileName = `archivo_${Date.now()}.${ext}`;

                    payload.media = {
                        base64: base64Data,
                        mimetype: mimetype,
                        fileName: fileName
                    };
                } else {
                    console.warn("Formato de DataURI no reconocido, enviando crudo.");
                    payload.media = mediaSource; // Fallback
                }
            }

            const response = await fetch(currentApiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': currentApiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                
                // Manejo de errores específicos
                if (response.status === 403) {
                    throw new Error(`API Key inválida (403). Asegúrate que sea '${currentApiKey}' y no el ChatID.`);
                }
                if (response.status === 413) {
                    throw new Error("El archivo es demasiado grande para el servidor (413).");
                }

                try {
                    const jsonError = JSON.parse(errorText);
                    const msg = jsonError.error || jsonError.message || JSON.stringify(jsonError);
                    throw new Error(`API Error: ${msg}`);
                } catch {
                    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
                }
            }

            toast.success("Nota enviada a MateChat API.", { id: toastId });
            Logger.info("Nota enviada a MateChat API", { id: note.id, hasMedia: !!payload.media });

        } catch (error: any) {
            let errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error detallado al enviar:", error);
            toast.error(`Fallo el envío: ${errorMessage}`, { id: toastId });
            Logger.error("Fallo al enviar solicitud HTTP", { error: errorMessage });
        }
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await deleteNote(deleteId);
            setDeleteId(null);
        }
    };

    const saveApiConfig = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('MATECHAT_API_URL', apiUrl.trim());
        localStorage.setItem('MATECHAT_API_KEY', apiKey.trim());
        localStorage.setItem('MATECHAT_CHAT_ID', chatId.trim());
        toast.success("Configuración HTTP guardada.");
        setIsConfigOpen(false);
    };

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6 bg-pink-50 dark:bg-pink-900/20 p-4 rounded-xl border border-pink-100 dark:border-pink-800/50">
                <div className="flex items-center gap-3">
                    <HeartIcon className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notas Natasha</h2>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto items-center">
                    <button 
                        onClick={() => setIsConfigOpen(true)}
                        className="p-2 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-800/50 rounded-full transition-colors"
                        title="Configurar Solicitud HTTP"
                    >
                        <CogIcon className="w-6 h-6" />
                    </button>

                    <div className="relative flex-grow sm:flex-grow-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full sm:w-48 pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 sm:text-sm transition-all"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 whitespace-nowrap transition-transform hover:scale-105"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nueva Nota
                    </button>
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="text-center py-12 text-gray-500 animate-pulse">Cargando recuerdos...</div>
            ) : filteredNotes.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-dashed border-pink-200 dark:border-gray-700">
                    <HeartIcon className="mx-auto h-12 w-12 text-pink-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay notas de Natasha</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Guarda tus pensamientos, fotos y audios aquí.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max">
                    {filteredNotes.map((note) => (
                        <div 
                            key={note.id} 
                            onClick={() => handleOpenModal(note)}
                            className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden flex flex-col relative border border-gray-100 dark:border-gray-700"
                        >
                            {note.image_url && (
                                <div className="h-48 w-full overflow-hidden relative">
                                    <img src={note.image_url} alt="Note attachment" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                            <div className="p-5 flex-grow flex flex-col gap-3">
                                {note.title && <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{note.title}</h3>}
                                
                                <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-4 flex-grow">
                                    {note.content || (
                                        !note.image_url && !note.audio_url ? <span className="italic text-gray-400">Nota vacía</span> : null
                                    )}
                                </p>

                                {note.audio_url && (
                                    <div className="mt-2 bg-pink-50 dark:bg-pink-900/30 p-2 rounded-lg flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <audio controls src={note.audio_url} className="w-full h-8" />
                                    </div>
                                )}
                            </div>
                            <div className="p-4 pt-0 flex justify-between items-center mt-auto text-xs text-gray-400 border-t border-gray-50 dark:border-gray-700/50">
                                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => handleSendClick(note, e)}
                                        className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                        title="Enviar Solicitud HTTP"
                                    >
                                        <SendIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteClick(note.id, e)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Eliminar"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingNote ? 'Editar Nota' : 'Crear Nota Natasha'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border-none text-2xl font-bold placeholder-gray-300 focus:ring-0 bg-transparent text-gray-900 dark:text-white p-0"
                        placeholder="Título..."
                    />
                    
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full border-none resize-none h-32 placeholder-gray-400 focus:ring-0 bg-transparent text-gray-800 dark:text-gray-300 p-0 leading-relaxed"
                        placeholder="Escribe algo bonito..."
                    />
                    
                    {/* Audio Recorder Section */}
                    <div className="flex items-center gap-4 py-2">
                        {!isRecording && !audioPreview ? (
                            <button
                                type="button"
                                onClick={startRecording}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                                <span>Grabar Audio</span>
                            </button>
                        ) : isRecording ? (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-600 animate-pulse"
                            >
                                <StopIcon className="w-5 h-5" />
                                <span>Detener (Grabando...)</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 w-full bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                <audio controls src={audioPreview!} className="flex-grow h-8" />
                                <button 
                                    type="button" 
                                    onClick={() => setAudioPreview(null)}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Image Preview */}
                    {imagePreview && (
                        <div className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                             <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain bg-gray-50 dark:bg-gray-900" />
                             <button
                                type="button"
                                onClick={() => setImagePreview(null)}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                             >
                                 <XIcon className="w-4 h-4" />
                             </button>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                         <label className="cursor-pointer p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title="Agregar imagen">
                            <ImageIcon className="w-6 h-6" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                         </label>
                         
                         <div className="flex gap-3">
                             <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                             >
                                 Cancelar
                             </button>
                             <button
                                type="submit"
                                className="px-6 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                             >
                                 Guardar
                             </button>
                         </div>
                    </div>
                </form>
            </Modal>

            {/* HTTP Request Config Modal */}
            <Modal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                title="Configurar Solicitud HTTP"
            >
                <form onSubmit={saveApiConfig} className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Configura los parámetros para enviar la nota a la API de MateChat.
                    </p>
                    <div>
                        <label htmlFor="api-url" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">URL</label>
                        <input
                            type="url"
                            id="api-url"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            placeholder="https://..."
                        />
                    </div>
                    <div>
                        <label htmlFor="api-key" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">API Key (x-api-key)</label>
                        <input
                            type="text"
                            id="api-key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            placeholder="Tu clave de API"
                        />
                        <p className="mt-1 text-xs text-gray-500">Por defecto: matechat.com</p>
                    </div>
                    <div>
                        <label htmlFor="chat-id" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Chat ID (Destinatario)</label>
                        <input
                            type="text"
                            id="chat-id"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            placeholder="Ej: 59899425515@c.us"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsConfigOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
                        >
                            Guardar Configuración
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Eliminar Nota"
                message="¿Estás seguro? Esta acción no se puede deshacer."
            />
        </div>
    );
};
