import { useState, useCallback, useEffect } from 'react';
import { Product, ProductVariant } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';
import { toast } from 'sonner';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      Logger.error(`Error fetching products: ${error.message}`);
    } else if (data) {
      setProducts(data as Product[]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'created_at' | 'cost' | 'quantity'> & { initialQuantity: number; initialCost: number }) => {
    const { initialQuantity, initialCost, ...baseProductData } = productData;

    const { data: existingSku } = await supabase
      .from('products')
      .select('name')
      .eq('sku', baseProductData.sku)
      .maybeSingle();

    if (existingSku) {
      Logger.error(`Error: El SKU "${baseProductData.sku}" ya está en uso.`);
      toast.error("El SKU ya existe.");
      return;
    }
    
    // Si hay variantes, el stock inicial es la suma de las variantes
    const finalQty = baseProductData.variants && baseProductData.variants.length > 0
        ? baseProductData.variants.reduce((acc, v) => acc + v.quantity, 0)
        : initialQuantity;

    const productToInsert = { ...baseProductData, quantity: finalQty, cost: initialCost };

    let { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert([productToInsert])
      .select()
      .single();

    if (productError) {
      Logger.error(`Error al agregar producto: ${productError.message}`);
      return;
    }
    
    if (finalQty > 0 && initialCost >= 0) {
        await supabase.from('stock_entries').insert([{ 
            product_id: newProduct.id, 
            quantity: finalQty, 
            unit_cost: initialCost 
        }]);
    }

    await fetchProducts();
    toast.success("Producto creado exitosamente.");

  }, [fetchProducts]);

  const addStockEntry = async (productId: string, quantity: number, unitCost: number, variantName?: string) => {
    try {
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('variants, quantity, cost')
            .eq('id', productId)
            .single();

        if (fetchError || !product) throw new Error("No se pudo obtener el producto.");

        await supabase
            .from('stock_entries')
            .insert([{ product_id: productId, quantity, unit_cost: unitCost }]);
        
        let currentVariants: ProductVariant[] = product.variants || [];
        const oldQuantity = product.quantity || 0;
        const oldCost = product.cost || 0;
        
        // Actualizar variantes si corresponde
        if (variantName) {
            const variantIndex = currentVariants.findIndex(v => v.color.toLowerCase() === variantName.toLowerCase());
            if (variantIndex >= 0) {
                currentVariants[variantIndex].quantity += quantity;
            } else {
                currentVariants.push({ color: variantName, quantity: quantity });
            }
        }

        // Recalcular Total Global SIEMPRE basado en variantes si las hay
        const newTotalQuantity = currentVariants.length > 0
            ? currentVariants.reduce((acc, v) => acc + v.quantity, 0)
            : oldQuantity + quantity;
        
        const totalInvestment = (oldQuantity * oldCost) + (quantity * unitCost);
        const newAverageCost = newTotalQuantity > 0 ? totalInvestment / newTotalQuantity : unitCost;

        const { error: updateError } = await supabase
            .from('products')
            .update({ 
                quantity: newTotalQuantity,
                variants: currentVariants,
                cost: newAverageCost
            })
            .eq('id', productId);

        if (updateError) throw updateError;

        toast.success(`Stock actualizado: +${quantity} unidades.`);
        await fetchProducts();

    } catch (error: any) {
        Logger.error(`Error en entrada de stock: ${error.message}`);
        toast.error("Hubo un problema al actualizar el stock.");
    }
  };

  const updateProduct = useCallback(async (updatedProduct: Product) => {
    // Sincronización de seguridad: Recalcular quantity basándose en variants antes de enviar
    let finalQty = updatedProduct.quantity;
    if (updatedProduct.variants && updatedProduct.variants.length > 0) {
        finalQty = updatedProduct.variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
    }

    const { id, created_at, cost, ...updateData } = updatedProduct;
    
    // Forzamos la cantidad sincronizada
    const cleanUpdateData = { ...updateData, quantity: finalQty };

    let { error } = await supabase
      .from('products')
      .update(cleanUpdateData)
      .eq('id', id);

    if (error) {
      Logger.error(`Error al actualizar producto: ${error.message}`);
      toast.error("Error al actualizar.");
    } else {
      toast.success("Producto actualizado correctamente.");
      await fetchProducts();
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      Logger.error(`Error deleting product: ${error.message}`);
    } else {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    }
  }, []);

  return { products, addProduct, updateProduct, deleteProduct, fetchProducts, addStockEntry };
};