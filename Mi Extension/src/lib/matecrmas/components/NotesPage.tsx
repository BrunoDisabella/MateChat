
import React, { useState, useMemo } from 'react';
import { useNotes } from '../hooks/useNotes.ts';
import { Note } from '../types.ts';
import { NoteIcon, PlusIcon, SearchIcon, TrashIcon, ImageIcon, XIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { toast } from 'sonner';

export const NotesPage: React.FC = () => {
    const { notes, isLoading, addNote, updateNote, deleteNote } = useNotes();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form States
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const filteredNotes = useMemo(() => {
        if (!searchTerm) return notes;

        // Función auxiliar para normalizar texto:
        // 1. Convierte a minúsculas.
        // 2. Descompone caracteres (NFD) para separar letras de tildes.
        // 3. Elimina los diacríticos (tildes) con regex.
        const normalize = (text: string) => 
            text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const term = normalize(searchTerm);

        return notes.filter(n => 
            normalize(n.title || '').includes(term) || 
            normalize(n.content || '').includes(term)
        );
    }, [notes, searchTerm]);

    const handleOpenModal = (note?: Note) => {
        if (note) {
            setEditingNote(note);
            setTitle(note.title || '');
            setContent(note.content || '');
            setImagePreview(note.image_url || null);
        } else {
            setEditingNote(null);
            setTitle('');
            setContent('');
            setImagePreview(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title && !content && !imagePreview) {
            toast.error('La nota debe tener algún contenido.');
            return;
        }

        if (editingNote) {
            await updateNote(editingNote.id, {
                title,
                content,
                image_url: imagePreview || undefined
            });
        } else {
            await addNote({
                title,
                content,
                image_url: imagePreview || undefined
            });
        }
        handleCloseModal();
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await deleteNote(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div>
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <NoteIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notas y Recordatorios</h2>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                            placeholder="Buscar en notas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 whitespace-nowrap"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nueva Nota
                    </button>
                </div>
            </div>

            {/* Notes Grid */}
            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Cargando notas...</div>
            ) : filteredNotes.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <NoteIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay notas</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'No se encontraron notas con ese criterio.' : 'Comienza creando una nueva nota para guardar tus ideas.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
                    {filteredNotes.map((note) => (
                        <div 
                            key={note.id} 
                            onClick={() => handleOpenModal(note)}
                            className="group bg-yellow-50 dark:bg-gray-800 border border-yellow-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col relative"
                        >
                            {note.image_url && (
                                <div className="h-40 w-full overflow-hidden">
                                    <img src={note.image_url} alt="Note attachment" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                </div>
                            )}
                            <div className="p-4 flex-grow">
                                {note.title && <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">{note.title}</h3>}
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm line-clamp-6">
                                    {note.content || <span className="italic text-gray-400">(Sin texto)</span>}
                                </p>
                            </div>
                            <div className="p-3 pt-0 flex justify-between items-center mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
                                <button 
                                    onClick={(e) => handleDeleteClick(note.id, e)}
                                    className="relative z-10 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                    title="Eliminar nota"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Form */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingNote ? 'Editar Nota' : 'Crear Nota'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border-none text-xl font-bold placeholder-gray-400 focus:ring-0 bg-transparent text-gray-900 dark:text-white p-0"
                            placeholder="Título"
                        />
                    </div>
                    <div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full border-none resize-none h-40 placeholder-gray-400 focus:ring-0 bg-transparent text-gray-800 dark:text-gray-300 p-0"
                            placeholder="Escribe una nota..."
                        />
                    </div>
                    
                    {/* Image Preview Area */}
                    {imagePreview && (
                        <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                             <img src={imagePreview} alt="Preview" className="w-full max-h-60 object-contain bg-gray-50 dark:bg-gray-900" />
                             <button
                                type="button"
                                onClick={() => setImagePreview(null)}
                                className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                             >
                                 <XIcon className="w-4 h-4" />
                             </button>
                        </div>
                    )}

                    {/* Footer Toolbar */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                         <label className="cursor-pointer p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <ImageIcon className="w-5 h-5" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                         </label>
                         
                         <div className="flex gap-2">
                             <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg border border-gray-300 dark:border-gray-600"
                             >
                                 Cerrar
                             </button>
                             <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg"
                             >
                                 Guardar
                             </button>
                         </div>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Eliminar Nota"
                message="¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer."
            />
        </div>
    );
};
