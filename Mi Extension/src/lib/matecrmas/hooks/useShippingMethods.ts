import { useState, useCallback, useEffect } from 'react';
import { ShippingMethod } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useShippingMethods = () => {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMethods = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error(`Error fetching shipping methods: ${error.message}`);
    } else if (data) {
      setShippingMethods(data as ShippingMethod[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const addMethod = useCallback(async (name: string, cost: number) => {
    const { data, error } = await supabase
      .from('shipping_methods')
      .insert([{ name, cost }])
      .select()
      .single();

    if (error) {
      Logger.error(`Error adding shipping method: ${error.message}`);
      toast.error('No se pudo guardar el método de envío.');
    } else if (data) {
      setShippingMethods(prev => [data, ...prev]);
      toast.success('Método de envío agregado.');
    }
  }, []);

  const updateMethod = useCallback(async (id: string, name: string, cost: number) => {
    const { data, error } = await supabase
      .from('shipping_methods')
      .update({ name, cost })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      Logger.error(`Error updating shipping method: ${error.message}`);
      toast.error('Error al actualizar.');
    } else if (data) {
      setShippingMethods(prev => prev.map(m => m.id === id ? data : m));
      toast.success('Actualizado correctamente.');
    }
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('shipping_methods')
      .delete()
      .eq('id', id);

    if (error) {
      Logger.error(`Error deleting shipping method: ${error.message}`);
      toast.error('Error al eliminar.');
    } else {
      setShippingMethods(prev => prev.filter(m => m.id !== id));
      toast.success('Eliminado correctamente.');
    }
  }, []);

  return { shippingMethods, isLoading, addMethod, updateMethod, deleteMethod };
};