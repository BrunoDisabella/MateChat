import React, { useMemo } from 'react';
import { Product } from '../types.ts';
import { PencilIcon, TrashIcon, BoxPlusIcon, ErrorIcon, StopIcon } from './icons.tsx';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onAddStock: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, onAddStock }) => {
  const LOW_STOCK_THRESHOLD = 15;
  
  // Sincronización visual forzada: Calculamos el total nosotros
  const displayedTotalStock = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
        return product.variants.reduce((acc, v) => acc + (v.quantity || 0), 0);
    }
    return product.quantity;
  }, [product.quantity, product.variants]);

  const isTotalLow = displayedTotalStock < LOW_STOCK_THRESHOLD;
  const hasLowStockVariant = product.variants?.some(v => v.quantity < LOW_STOCK_THRESHOLD) ?? false;
  const isLowStock = isTotalLow || hasLowStockVariant;
  
  const isActive = product.isActive !== false; 

  let containerClasses = "group rounded-lg shadow-md overflow-hidden transition-transform duration-300 flex flex-col ";
  
  if (!isActive) {
      containerClasses += "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-75 grayscale";
  } else if (isLowStock) {
      containerClasses += "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:scale-105 hover:shadow-xl";
  } else {
      containerClasses += "bg-white dark:bg-gray-800 hover:scale-105 hover:shadow-xl";
  }

  return (
    <div className={containerClasses}>
      <div className="aspect-square w-full overflow-hidden relative">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
        />
        
        {!isActive && (
             <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center">
                 <span className="bg-gray-800 text-white font-bold px-3 py-1 rounded border border-gray-500 flex items-center gap-1 shadow-lg transform -rotate-12">
                    <StopIcon className="w-4 h-4" /> INACTIVO
                 </span>
             </div>
        )}

        {product.variants && product.variants.length > 0 && (
             <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm z-10 font-bold">
                 {product.variants.length} COLORES
             </div>
        )}
        
        {isActive && isLowStock && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 text-white text-xs font-bold px-2 py-1 text-center backdrop-blur-sm flex items-center justify-center gap-1">
                <ErrorIcon className="w-3 h-3" /> STOCK BAJO
            </div>
        )}
      </div>
      <div className="p-4 flex-grow relative">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{product.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider">{product.sku}</p>
        
        <div className="flex justify-between items-center mt-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Costo Promedio:</span>
          <span className="font-mono">${product.cost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mt-1 text-sm font-bold text-gray-800 dark:text-gray-100">
          <span>Precio Venta:</span>
          <span className="font-mono">${product.price.toFixed(2)}</span>
        </div>
        
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center text-sm font-bold text-gray-800 dark:text-gray-200">
              <span>Stock Total:</span>
              <span className={`font-mono text-lg ${isActive && isTotalLow ? 'text-red-600 dark:text-red-400 font-extrabold animate-pulse' : 'text-green-600 dark:text-green-400'}`}>
                {displayedTotalStock}
              </span>
            </div>
            
            {product.variants && product.variants.length > 0 && (
                <div className="mt-2 space-y-1">
                    {product.variants.slice(0, 3).map((v, i) => (
                        <div key={i} className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                            <span className="truncate pr-2">{v.color}</span>
                            <span className={isActive && v.quantity < LOW_STOCK_THRESHOLD ? "text-red-600 dark:text-red-400 font-bold" : "font-semibold"}>
                                {v.quantity}
                            </span>
                        </div>
                    ))}
                    {product.variants.length > 3 && (
                        <p className="text-[10px] text-gray-400 text-right italic">+ {product.variants.length - 3} más...</p>
                    )}
                </div>
            )}
        </div>
      </div>
      
      <div className={`flex justify-end p-2 border-t transition-colors 
        ${!isActive ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 
          isLowStock ? 'bg-red-100/50 dark:bg-red-900/40 border-red-200 dark:border-red-800' : 
          'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'}`}
      >
        <button 
          onClick={() => onAddStock(product)}
          className="p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
          disabled={!isActive}
          title={!isActive ? "Producto inactivo" : "Agregar Stock"}
        >
          <BoxPlusIcon className={`w-5 h-5 ${!isActive ? 'opacity-50' : ''}`} />
        </button>
        <button 
          onClick={() => onEdit(product)}
          className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          title="Editar Producto"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
        <button 
          onClick={() => onDelete(product.id)}
          className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
          title="Eliminar"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};