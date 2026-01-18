import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductFailure, ProductVariant } from '../types.ts';
import { SearchIcon, XIcon } from './icons.tsx';

interface FailureFormProps {
  products: Product[];
  onSubmit: (data: Omit<ProductFailure, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}

export const FailureForm: React.FC<FailureFormProps> = ({ products, onSubmit, onCancel }) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [productCost, setProductCost] = useState(0);

  const activeProduct = useMemo(() => {
      return products.find(p => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  useEffect(() => {
      if (activeProduct) {
          setProductCost(activeProduct.cost);
          if (searchTerm !== activeProduct.name) {
              setSearchTerm(activeProduct.name);
          }
      } else {
          setProductCost(0);
          setSelectedVariant('');
      }
  }, [activeProduct]);

  const filteredProducts = useMemo(() => {
      if (!searchTerm) return products;
      const termLower = searchTerm.toLowerCase();
      return products.filter(p => 
          p.name.toLowerCase().includes(termLower) || 
          p.sku.toLowerCase().includes(termLower)
      );
  }, [products, searchTerm]);

  const handleSelectProduct = (product: Product) => {
      setSelectedProductId(product.id);
      setSearchTerm(product.name);
      setIsDropdownOpen(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setSelectedProductId(''); 
      setIsDropdownOpen(true);
  };

  const clearSelection = () => {
      setSearchTerm('');
      setSelectedProductId('');
      setProductCost(0);
      setIsDropdownOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) {
      alert('Por favor seleccione un producto.');
      return;
    }

    if (activeProduct.variants && activeProduct.variants.length > 0 && !selectedVariant) {
        alert('Por favor seleccione el color/variante fallada.');
        return;
    }

    const parsedShipping = parseFloat(shippingCost) || 0;
    const parsedQty = parseInt(quantity, 10);

    if (isNaN(parsedQty) || parsedQty <= 0) {
        alert('La cantidad debe ser mayor a 0.');
        return;
    }

    onSubmit({
      product_id: activeProduct.id,
      product_name: activeProduct.name,
      product_sku: activeProduct.sku,
      product_cost: activeProduct.cost,
      shipping_cost: parsedShipping,
      quantity: parsedQty,
      variant: selectedVariant || undefined,
      reason: reason || 'Sin motivo especificado'
    });
  };

  const totalLoss = (productCost * (parseInt(quantity) || 1)) + (parseFloat(shippingCost) || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      {/* Buscador de Productos */}
      <div className="relative">
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Seleccionar Producto Fallado</label>
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
                type="text"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full pl-10 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => setIsDropdownOpen(true)}
                required
            />
            {searchTerm && (
                <button 
                    type="button" 
                    onClick={clearSelection}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            )}
        </div>

        {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex justify-between items-center"
                        >
                            <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {p.sku}</div>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                Stock: {p.quantity}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No se encontraron productos.</div>
                )}
            </div>
        )}
      </div>

      {/* Variante y Cantidad */}
      <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cantidad</label>
            <input 
                type="number" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)}
                min="1"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                required
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Color/Variante</label>
            <select
                value={selectedVariant}
                onChange={e => setSelectedVariant(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                disabled={!activeProduct || !activeProduct.variants || activeProduct.variants.length === 0}
            >
                <option value="">-- Seleccionar --</option>
                {activeProduct?.variants?.map((v, i) => (
                    <option key={i} value={v.color}>{v.color} (Stock: {v.quantity})</option>
                ))}
            </select>
          </div>
      </div>

      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Impacto en Inventario</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
             Se descontarán <span className="font-bold text-red-600">{quantity}</span> unidades del stock.
          </p>
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Costo de Envío Perdido ($)</label>
        <input
          type="number"
          value={shippingCost}
          onChange={(e) => setShippingCost(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="0.00"
          min="0"
          step="0.01"
        />
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
            Motivo <span className="text-gray-400 font-normal">(Opcional)</span>
        </label>
        <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            rows={2}
            placeholder="Ej: Llegó roto, cliente insatisfecho..."
        />
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Pérdida Total:</span>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 font-mono">${totalLoss.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm disabled:opacity-50" disabled={!selectedProductId}>
                Confirmar Falla
            </button>
          </div>
      </div>
    </form>
  );
};