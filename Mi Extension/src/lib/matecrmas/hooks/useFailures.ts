import { useState, useCallback, useEffect } from 'react';
import { ProductFailure, ProductVariant } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useFailures = () => {
    const [failures, setFailures] = useState<ProductFailure[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFailures = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_failures')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                Logger.error(`Error fetching failures: ${error.message}`);
            } else if (data) {
                setFailures(data as ProductFailure[]);
            }
        } catch (err) {
            Logger.error('Error de red al obtener fallas');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFailures();
    }, [fetchFailures]);

    const addFailure = useCallback(async (failureData: Omit<ProductFailure, 'id' | 'created_at'>) => {
        try {
            Logger.info(`Iniciando registro de falla para SKU: ${failureData.product_sku}`);

            // --- PASO 1: OBTENCIÓN DEL PRODUCTO ---
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, quantity, variants, sku')
                .eq('id', failureData.product_id)
                .single();

            if (productError || !product) {
                throw new Error(`No se pudo encontrar el producto en la base de datos para descontar stock.`);
            }

            // --- PASO 2: CÁLCULO DE NUEVOS VALORES ---
            const qtyToSubtract = Number(failureData.quantity) || 0;
            let currentGlobalQty = Number(product.quantity) || 0;
            let currentVariants: ProductVariant[] = Array.isArray(product.variants) ? [...product.variants] : [];
            
            // Restamos del total global
            const newGlobalQty = Math.max(0, currentGlobalQty - qtyToSubtract);
            
            // Si hay variante seleccionada, restamos de esa variante
            if (failureData.variant && currentVariants.length > 0) {
                const variantIndex = currentVariants.findIndex(v => v.color === failureData.variant);
                if (variantIndex !== -1) {
                    currentVariants[variantIndex].quantity = Math.max(0, (Number(currentVariants[variantIndex].quantity) || 0) - qtyToSubtract);
                }
            }

            // --- PASO 3: ACTUALIZACIÓN DE STOCK (CRÍTICO) ---
            const { error: updateStockError } = await supabase
                .from('products')
                .update({
                    quantity: newGlobalQty,
                    variants: currentVariants.length > 0 ? currentVariants : null
                })
                .eq('id', product.id);
            
            if (updateStockError) {
                throw new Error(`Error en base de datos al actualizar stock: ${updateStockError.message}`);
            }

            Logger.info(`Stock actualizado con éxito (-${qtyToSubtract}). Procediendo a guardar historial.`);

            // --- PASO 4: REGISTRO HISTÓRICO ---
            // Limpiamos los datos para evitar undefined que rompen el fetch
            const cleanHistoryData = {
                product_id: failureData.product_id,
                product_name: failureData.product_name,
                product_sku: failureData.product_sku,
                product_cost: Number(failureData.product_cost) || 0,
                shipping_cost: Number(failureData.shipping_cost) || 0,
                quantity: qtyToSubtract,
                variant: failureData.variant || null, // null es mejor que undefined para SQL
                reason: failureData.reason || 'Sin motivo'
            };

            const { data: newFailure, error: failureError } = await supabase
                .from('product_failures')
                .insert([cleanHistoryData])
                .select()
                .single();

            if (failureError) {
                console.warn("Stock descontado pero falló el guardado del historial:", failureError.message);
                toast.warning('¡Stock descontado! Pero no se guardó el registro histórico (Error de BD).');
                return true; 
            }

            if (newFailure) {
                setFailures(prev => [newFailure as ProductFailure, ...prev]);
                toast.success('Falla registrada y stock descontado correctamente.');
            }
            
            return true;
        } catch (error: any) {
            const msg = error.message || 'Error desconocido procesando la falla.';
            Logger.error(`Error en proceso de falla: ${msg}`);
            // Si es un Failed to fetch, sugerimos revisar conexión
            if (msg.includes('Failed to fetch')) {
                toast.error('Error de conexión con el servidor. Por favor, reintenta en unos segundos.');
            } else {
                toast.error(msg);
            }
            return false;
        }
    }, []);

    const deleteFailure = useCallback(async (id: string) => {
        try {
            const { error } = await supabase
                .from('product_failures')
                .delete()
                .eq('id', id);

            if (error) {
                Logger.error(`Error deleting failure: ${error.message}`);
                toast.error('No se pudo eliminar el registro de falla.');
            } else {
                setFailures(prev => prev.filter(f => f.id !== id));
                toast.success('Registro de falla eliminado.');
            }
        } catch (err) {
            toast.error('Error de conexión al intentar eliminar.');
        }
    }, []);

    return { failures, isLoading, addFailure, deleteFailure };
};