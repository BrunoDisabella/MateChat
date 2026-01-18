import React, { useMemo } from 'react';
import { Product } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onAddStock: (product: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ products, onEdit, onDelete, onAddStock }) => {
  // Lógica para detectar si un producto tiene bajo stock (menos de 15)
  const isLowStock = (product: Product) => {
    const LOW_STOCK_THRESHOLD = 15;
    const lowTotal = product.quantity < LOW_STOCK_THRESHOLD;
    const lowVariant = product.variants?.some(v => v.quantity < LOW_STOCK_THRESHOLD) ?? false;
    return lowTotal || lowVariant;
  };

  // Ordenamiento Jerárquico:
  // 1. Activos con Stock Bajo (Prioridad Máxima)
  // 2. Activos Normales
  // 3. Inactivos (Al final)
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      // Estado Activo/Inactivo (undefined se trata como activo para compatibilidad)
      const aActive = a.isActive !== false;
      const bActive = b.isActive !== false;

      // Si uno está activo y el otro no, el activo va primero
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // Si ambos tienen el mismo estado activo/inactivo:
      if (aActive && bActive) {
          // Aplicar lógica de Stock Bajo solo entre activos
          const aLow = isLowStock(a);
          const bLow = isLowStock(b);

          if (aLow && !bLow) return -1; // Bajo stock primero
          if (!aLow && bLow) return 1;  // Bajo stock primero
      }

      // Si empatan en todo lo anterior, mantener orden original (o por fecha si existiera)
      return 0;
    });
  }, [products]);

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay productos en el inventario.</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">¡Comienza agregando uno nuevo!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {sortedProducts.map((product) => (
        <ProductCard key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} onAddStock={onAddStock} />
      ))}
    </div>
  );
};