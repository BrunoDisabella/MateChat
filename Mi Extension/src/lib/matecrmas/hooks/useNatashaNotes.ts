
import { useState, useCallback, useEffect } from 'react';
import { NatashaNote } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useNatashaNotes = () => {
    const [notes, setNotes] = useState<NatashaNote[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotes = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('natasha_notes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            Logger.error(`Error fetching Natasha notes: ${error.message}`);
        } else if (data) {
            setNotes(data as NatashaNote[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const addNote = useCallback(async (noteData: Omit<NatashaNote, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('natasha_notes')
            .insert([noteData])
            .select()
            .single();

        if (error) {
            Logger.error(`Error adding Natasha note: ${error.message}`);
            toast.error('No se pudo guardar la nota.');
        } else if (data) {
            setNotes(prev => [data, ...prev]);
            toast.success('Nota guardada con éxito.');
        }
    }, []);

    const updateNote = useCallback(async (id: string, updates: Partial<Omit<NatashaNote, 'id' | 'created_at'>>) => {
        const { data, error } = await supabase
            .from('natasha_notes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            Logger.error(`Error updating Natasha note: ${error.message}`);
            toast.error('Error al actualizar la nota.');
        } else if (data) {
            setNotes(prev => prev.map(n => n.id === id ? data : n));
            toast.success('Nota actualizada.');
        }
    }, []);

    const deleteNote = useCallback(async (id: string) => {
        const { error } = await supabase
            .from('natasha_notes')
            .delete()
            .eq('id', id);

        if (error) {
            Logger.error(`Error deleting Natasha note: ${error.message}`);
            toast.error('Error al eliminar la nota.');
        } else {
            setNotes(prev => prev.filter(n => n.id !== id));
            toast.success('Nota eliminada.');
        }
    }, []);

    return { notes, isLoading, addNote, updateNote, deleteNote };
};
