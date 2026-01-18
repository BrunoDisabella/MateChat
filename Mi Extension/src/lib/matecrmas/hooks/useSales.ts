import { useState, useCallback, useEffect } from 'react';
import { Product, Sale } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useSales = (products: Product[]) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoadingSales, setIsLoadingSales] = useState(true);
    const [salesError, setSalesError] = useState<string | null>(null);
    
    const [dateRange, setDateRange] = useState<{start: string, end: string}>(() => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(start.getDate() - 30); 
        start.setHours(0, 0, 0, 0);
        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    });

    const fetchSales = useCallback(async (currentProducts: Product[], start?: string, end?: string) => {
        if (currentProducts.length === 0) return;

        const startDateStr = start || dateRange.start;
        const endDateStr = end || dateRange.end;
        const startDateObj = new Date(startDateStr);
        const endDateObj = new Date(endDateStr);

        setIsLoadingSales(true);
        setSalesError(null);
        
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .limit(2000); 

            if (error) throw error;

            const rawSales = data || [];
            
            const productMap = new Map<string, Product>();
            currentProducts.forEach(p => {
                if (p.id) productMap.set(p.id, p);
                if (p.sku) productMap.set(p.sku.toUpperCase(), p);
            });

            const enrichedSales: Sale[] = rawSales.map((sale: any) => {
                // Mapeo robusto de campos (soporta camelCase y snake_case)
                const rawDate = sale.createdAt || sale.created_at || sale.CreatedAt || 
                                sale.creadoEn || sale['creadoEn'] || 
                                sale.date_created || 
                                new Date().toISOString();

                const rawChannel = sale.salesChannel || sale.sales_channel || sale.SalesChannel || 
                                   sale['Canal de ventas'] || sale.canal_de_ventas || 
                                   'Desconocido';

                const rawItems = sale.items || sale.elementos || sale.products || [];
                const rawTotal = sale.total || sale.monto_total || 0;
                const rawSubtotal = sale.subtotal || sale.sub_total || rawTotal; 
                const rawDiscount = sale.discountPercentage || sale.discount_percentage || sale.porcentaje_descuento || 0;

                // Campos de Envío (Lectura robusta)
                const rawShippingMethod = sale.shippingMethod || sale.shipping_method || undefined;
                const rawShippingCost = Number(sale.shippingCost || sale.shipping_cost || 0);
                const rawShippingQuantity = Number(sale.shippingQuantity || sale.shipping_quantity || 1);

                const enrichedItems = Array.isArray(rawItems) ? rawItems.map((item: any) => {
                    const productId = item.productId || item.product_id || item.id_producto;
                    const itemSku = item.sku || item.SKU || 'N/A';
                    
                    const product = productMap.get(productId) || 
                                   (itemSku !== 'N/A' ? productMap.get(itemSku.toUpperCase()) : undefined);
                    
                    return {
                        ...item,
                        productId: productId || (product ? product.id : 'unknown'),
                        unitCost: product ? product.cost : (item.unitCost || item.costo_unitario || 0),
                        name: product ? product.name : (item.name || item.nombre || 'Producto Desconocido'),
                        sku: product ? product.sku : itemSku,
                        unitPrice: item.unitPrice || item.precio_unitario || 0,
                        quantity: item.quantity || item.cantidad || 1,
                        lineId: item.lineId || `${sale.id}-${productId}-${Math.random()}`
                    };
                }) : [];

                return {
                    id: sale.id || sale.identificacion,
                    items: enrichedItems,
                    subtotal: Number(rawSubtotal),
                    total: Number(rawTotal),
                    discountPercentage: Number(rawDiscount),
                    salesChannel: rawChannel,
                    createdAt: rawDate,
                    shippingMethod: rawShippingMethod,
                    shippingCost: rawShippingCost,
                    shippingQuantity: rawShippingQuantity
                };
            });

            const filteredAndSortedSales = enrichedSales
                .filter(sale => {
                    const saleDate = new Date(sale.createdAt);
                    if (isNaN(saleDate.getTime())) return false;
                    return saleDate >= startDateObj && saleDate <= endDateObj;
                })
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setSales(filteredAndSortedSales);

        } catch (error: any) {
            let errorMessage = "Error desconocido al cargar ventas.";
            if (error) {
                if (typeof error === 'string') errorMessage = error;
                else if (error.message) errorMessage = error.message;
            }
            Logger.error("❌ Error cargando ventas.", { error: errorMessage });
            setSalesError(`Error de BD: ${errorMessage}`);
            setSales([]);
        } finally {
            setIsLoadingSales(false);
        }
    }, [dateRange]); 

    useEffect(() => {
        if (products.length > 0) {
            fetchSales(products);
        }
    }, [products, fetchSales]);

    const setSalesDateRange = useCallback((start: Date, end: Date) => {
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        setDateRange({ start: startIso, end: endIso });
        fetchSales(products, startIso, endIso);
    }, [products, fetchSales]);

    const addSale = useCallback(async (saleData: Omit<Sale, 'id'>, currentProducts: Product[]): Promise<Sale | null> => {
        Logger.info("Intentando registrar venta...", saleData);

        try {
            let finalData = null;

            const rpcPayload = {
                p_items: saleData.items,
                p_subtotal: saleData.subtotal,
                p_total: saleData.total,
                p_discount_percentage: saleData.discountPercentage,
                p_sales_channel: saleData.salesChannel,
                p_created_at: saleData.createdAt,
                p_shipping_method: saleData.shippingMethod || null,
                p_shipping_cost: saleData.shippingCost || 0,
                p_shipping_quantity: saleData.shippingQuantity || 1
            };

            // USAMOS register_sale_v3 QUE MANEJA COLUMNAS HÍBRIDAS
            const { data: rpcData, error: rpcError } = await supabase.rpc('register_sale_v3', rpcPayload);
            
            if (rpcError) {
                console.warn("RPC v3 falló, intentando inserts directos como fallback.", rpcError.message);
                
                // FALLBACK: Insert Directo CamelCase (Lo más probable según tu esquema)
                const camelCaseData = {
                    items: saleData.items,
                    subtotal: saleData.subtotal,
                    total: saleData.total,
                    discountPercentage: saleData.discountPercentage,
                    salesChannel: saleData.salesChannel,
                    createdAt: saleData.createdAt,
                    shipping_method: saleData.shippingMethod, // Estos nuevos en snake_case
                    shipping_cost: saleData.shippingCost,
                    shipping_quantity: saleData.shippingQuantity
                };

                const { data: insertData, error: insertError } = await supabase.from('sales').insert(camelCaseData).select().single();
                
                if (insertError) {
                     // ULTIMO RECURSO: Insert SnakeCase completo
                     const snakeCaseData = {
                        items: saleData.items,
                        subtotal: saleData.subtotal,
                        total: saleData.total,
                        discount_percentage: saleData.discountPercentage,
                        sales_channel: saleData.salesChannel,
                        created_at: saleData.createdAt,
                        shipping_method: saleData.shippingMethod,
                        shipping_cost: saleData.shippingCost,
                        shipping_quantity: saleData.shippingQuantity
                    };
                    const { data: snakeData, error: snakeError } = await supabase.from('sales').insert(snakeCaseData).select().single();
                    
                    if (snakeError) throw rpcError; // Tiramos el error original de la V3 que suele ser más claro
                    finalData = snakeData;
                } else {
                    finalData = insertData;
                }
            } else {
                finalData = rpcData;
                Logger.info("✅ Venta registrada via RPC v3 (Híbrido).");
            }

            if (!finalData || !finalData.id) throw new Error("No se devolvió ID de venta.");

            // --- ACTUALIZACIÓN DE STOCK INTELIGENTE (Soporte Variantes) ---
            for (const item of saleData.items) {
                try {
                    // 1. Consultar el producto fresco de la BD para tener las variantes actualizadas
                    const { data: productData, error: fetchError } = await supabase
                        .from('products')
                        .select('id, quantity, variants')
                        .eq('id', item.productId)
                        .single();

                    if (fetchError || !productData) {
                        Logger.warn(`No se pudo obtener producto ${item.productId} para actualizar stock.`);
                        continue;
                    }

                    let newVariants = productData.variants;
                    let newGlobalQty = productData.quantity;

                    // 2. Si la venta especifica una variante y el producto las tiene
                    if (item.variant && Array.isArray(newVariants)) {
                        const variantIndex = newVariants.findIndex((v: any) => v.color === item.variant);
                        
                        if (variantIndex !== -1) {
                            // Restamos de la variante específica
                            const currentVarQty = newVariants[variantIndex].quantity || 0;
                            const newVarQty = Math.max(0, currentVarQty - item.quantity);
                            newVariants[variantIndex].quantity = newVarQty;
                            
                            // IMPORTANTE: Recalculamos el stock global sumando todas las variantes
                            // Esto mantiene la consistencia entre el número total y la suma de colores
                            newGlobalQty = newVariants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0);
                        } else {
                            // Si no encuentra variante (raro), descontamos del global
                            newGlobalQty = Math.max(0, newGlobalQty - item.quantity);
                        }
                    } else {
                        // 3. Si no es una venta con variante (producto simple), descontamos del global
                        newGlobalQty = Math.max(0, newGlobalQty - item.quantity);
                    }

                    // 4. Guardamos los cambios en Supabase
                    await supabase
                        .from('products')
                        .update({ 
                            quantity: newGlobalQty,
                            variants: newVariants
                        })
                        .eq('id', item.productId);

                } catch (err: any) {
                    Logger.error(`Error actualizando stock para item ${item.sku}: ${err.message}`);
                }
            }

            return { ...saleData, id: finalData.id } as Sale;
            
        } catch (error: any) {
            Logger.error(`❌ Error CRÍTICO al registrar venta: ${error.message}`);
            alert(`Error al registrar: ${error.message}. \n\nIMPORTANTE: Ejecuta el script SQL 'register_sale_v3' en Supabase.`);
            return null;
        }
    }, []);

    const updateSale = useCallback(async (saleId: string, updatedSaleData: Sale, currentProducts: Product[]): Promise<Sale | null> => {
         // Intentamos update con snake_case primero
         const { error } = await supabase.from('sales').update({
            items: updatedSaleData.items,
            subtotal: updatedSaleData.subtotal,
            total: updatedSaleData.total,
            discount_percentage: updatedSaleData.discountPercentage,
            sales_channel: updatedSaleData.salesChannel,
            created_at: updatedSaleData.createdAt,
            shipping_method: updatedSaleData.shippingMethod,
            shipping_cost: updatedSaleData.shippingCost,
            shipping_quantity: updatedSaleData.shippingQuantity
         }).eq('id', saleId);
         
         if (error) {
            Logger.error(`Error actualizando venta: ${error.message}`);
            return null;
         }
         return updatedSaleData;
    }, []);

    const deleteSale = useCallback(async (saleId: string): Promise<boolean> => {
        try {
            const { error } = await supabase.rpc('delete_sale', { p_sale_id: saleId });
            if (error) throw error;
            setSales(prev => prev.filter(s => s.id !== saleId));
            return true;
        } catch (error: any) {
            Logger.error(`❌ Error al eliminar venta: ${error.message}`);
            alert(`No se pudo eliminar: ${error.message}`);
            return false;
        }
    }, []);

    return { sales, addSale, updateSale, deleteSale, isLoadingSales, salesError, setSalesDateRange, fetchSales };
};