import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import { PlusIcon, BoxIcon } from './icons.tsx';

interface AddStockFormProps {
  onSubmit: (productId: string, quantity: number, unitCost: number, variantName?: string) => void;
  onCancel: () => void;
  product: Product;
}

export const AddStockForm: React.FC<AddStockFormProps> = ({ onSubmit, onCancel, product }) => {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  
  // Lógica de variantes
  const hasVariants = product.variants && product.variants.length > 0;
  const [mode, setMode] = useState<'existing' | 'new'>(hasVariants ? 'existing' : 'new');
  const [selectedVariant, setSelectedVariant] = useState(hasVariants ? product.variants![0].color : '');
  const [newVariantName, setNewVariantName] = useState('');

  // Si el producto cambia, reseteamos
  useEffect(() => {
    if (product.variants && product.variants.length > 0) {
        setMode('existing');
        setSelectedVariant(product.variants[0].color);
    } else {
        setMode('new');
        setNewVariantName('');
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      alert('La cantidad debe ser un número entero mayor a cero.');
      return;
    }
    const parsedUnitCost = parseFloat(unitCost);
    if (isNaN(parsedUnitCost) || parsedUnitCost < 0) {
      alert('El costo por unidad debe ser un número válido, igual o mayor a cero.');
      return;
    }

    let finalVariantName: string | undefined = undefined;

    if (mode === 'existing' && hasVariants) {
        finalVariantName = selectedVariant;
    } else if (mode === 'new' && newVariantName.trim()) {
        finalVariantName = newVariantName.trim();
        // Validación simple para no duplicar si escriben lo mismo que ya existe
        if (product.variants?.some(v => v.color.toLowerCase() === finalVariantName!.toLowerCase())) {
            alert('Esta variante ya existe. Por favor selecciónala de la lista "Variante Existente".');
            return;
        }
    }

    onSubmit(product.id, parsedQuantity, parsedUnitCost, finalVariantName);
  };

  // Obtener stock actual de la variante seleccionada para mostrarlo
  const currentVariantStock = hasVariants && mode === 'existing' 
    ? product.variants?.find(v => v.color === selectedVariant)?.quantity 
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* Selector de Modo (Solo si ya tiene variantes, sino forzamos nuevo/general) */}
      <div className="bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg flex text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode('existing')}
            disabled={!hasVariants}
            className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'existing' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            } ${!hasVariants ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Existente
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'new' 
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {hasVariants ? 'Nueva Variante' : 'Crear Variante'}
          </button>
      </div>

      {/* Inputs de Variante */}
      <div>
          {mode === 'existing' && hasVariants ? (
             <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Seleccionar Variante</label>
                <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    {product.variants!.map((v, idx) => (
                        <option key={idx} value={v.color}>{v.color}</option>
                    ))}
                </select>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                    <span>Stock actual de {selectedVariant}:</span>
                    <span className="font-bold">{currentVariantStock} u.</span>
                </p>
             </div>
          ) : (
             <div>
                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nombre de la Nueva Variante</label>
                <div className="relative">
                    <input
                        type="text"
                        value={newVariantName}
                        onChange={(e) => setNewVariantName(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Ej: Azul Marino, XL, etc."
                    />
                </div>
                {!hasVariants && (
                    <p className="mt-1 text-xs text-gray-500">
                        Si dejas esto vacío, se sumará al stock general sin crear variantes.
                    </p>
                )}
             </div>
          )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cantidad a Agregar</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="Ej: 50"
            required
            min="1"
          />
        </div>
        <div>
          <label htmlFor="unitCost" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Costo Unitario ($)</label>
          <input
            type="number"
            id="unitCost"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="Ej: 385.50"
            required
            step="0.01"
            min="0"
          />
        </div>
      </div>
      
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-blue-800">
          <BoxIcon className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800 dark:text-blue-300">
             <span className="font-bold">Resumen:</span> Se agregarán {quantity || 0} unidades 
             {mode === 'existing' ? ` al color "${selectedVariant}"` : newVariantName ? ` creando la variante "${newVariantName}"` : ' al stock general'}.
             <br/>
             El stock total del producto pasará de {product.quantity} a {product.quantity + (parseInt(quantity)||0)}.
          </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800"
        >
          <PlusIcon className="w-4 h-4" />
          Confirmar Ingreso
        </button>
      </div>
    </form>
  );
};