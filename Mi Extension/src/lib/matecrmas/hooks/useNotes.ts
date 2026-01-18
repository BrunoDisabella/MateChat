
import { useState, useCallback, useEffect } from 'react';
import { Note } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useNotes = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotes = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            Logger.error(`Error fetching notes: ${error.message}`);
        } else if (data) {
            setNotes(data as Note[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const addNote = useCallback(async (noteData: Omit<Note, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('notes')
            .insert([noteData])
            .select()
            .single();

        if (error) {
            Logger.error(`Error adding note: ${error.message}`);
            toast.error('No se pudo guardar la nota.');
        } else if (data) {
            setNotes(prev => [data, ...prev]);
            toast.success('Nota guardada.');
        }
    }, []);

    const updateNote = useCallback(async (id: string, updates: Partial<Omit<Note, 'id' | 'created_at'>>) => {
        const { data, error } = await supabase
            .from('notes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            Logger.error(`Error updating note: ${error.message}`);
            toast.error('Error al actualizar la nota.');
        } else if (data) {
            setNotes(prev => prev.map(n => n.id === id ? data : n));
            toast.success('Nota actualizada.');
        }
    }, []);

    const deleteNote = useCallback(async (id: string) => {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);

        if (error) {
            Logger.error(`Error deleting note: ${error.message}`);
            toast.error('Error al eliminar la nota.');
        } else {
            setNotes(prev => prev.filter(n => n.id !== id));
            toast.success('Nota eliminada.');
        }
    }, []);

    return { notes, isLoading, addNote, updateNote, deleteNote };
};
