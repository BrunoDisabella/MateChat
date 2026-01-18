import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../types.ts';
import { ImageIcon, PlusIcon, TrashIcon } from './icons.tsx';

interface ProductFormProps {
  onSubmit: (productData: Omit<Product, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  initialData?: Product | null;
}

export const ProductForm: React.FC<ProductFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [priceX2, setPriceX2] = useState('');
  
  const [priceMatias, setPriceMatias] = useState('');
  const [priceMatiasX2, setPriceMatiasX2] = useState('');
  
  const [priceLosGurises, setPriceLosGurises] = useState('');
  const [priceLosGurisesX2, setPriceLosGurisesX2] = useState('');

  const [quantity, setQuantity] = useState('0');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [newVariantColor, setNewVariantColor] = useState('');
  const [newVariantQty, setNewVariantQty] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSku(initialData.sku);
      setCost(initialData.cost.toFixed(2));
      setPrice(initialData.price.toString());
      setPriceX2(initialData.priceX2 ? initialData.priceX2.toString() : '');
      
      setPriceMatias(initialData.priceMatias ? initialData.priceMatias.toString() : '');
      setPriceMatiasX2(initialData.priceMatiasX2 ? initialData.priceMatiasX2.toString() : '');
      
      setPriceLosGurises(initialData.priceLosGurises ? initialData.priceLosGurises.toString() : '');
      setPriceLosGurisesX2(initialData.priceLosGurisesX2 ? initialData.priceLosGurisesX2.toString() : '');

      setImageUrl(initialData.imageUrl);
      setImagePreview(initialData.imageUrl);
      setVariants(initialData.variants || []);
      setIsActive(initialData.isActive !== undefined ? initialData.isActive : true);
      
      // Calcular stock inicial basado en variantes si existen
      if (initialData.variants && initialData.variants.length > 0) {
          const total = initialData.variants.reduce((acc, v) => acc + v.quantity, 0);
          setQuantity(total.toString());
      } else {
          setQuantity(initialData.quantity.toString());
      }
    } else {
      setName('');
      setSku('');
      setCost('');
      setPrice('');
      setPriceX2('');
      setPriceMatias('');
      setPriceMatiasX2('');
      setPriceLosGurises('');
      setPriceLosGurisesX2('');
      setQuantity('0');
      setImageUrl('');
      setImagePreview(null);
      setVariants([]);
      setIsActive(true);
    }
  }, [initialData]);

  // Recalcular stock total cada vez que cambien las variantes
  useEffect(() => {
    if (variants.length > 0) {
        const total = variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
        setQuantity(total.toString());
    }
  }, [variants]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddVariant = () => {
    if (!newVariantColor || !newVariantQty) return;
    const qty = parseInt(newVariantQty);
    if (isNaN(qty) || qty < 0) return;

    if (variants.some(v => v.color.toLowerCase() === newVariantColor.toLowerCase())) {
        alert('Este color ya existe en la lista.');
        return;
    }

    setVariants([...variants, { color: newVariantColor, quantity: qty }]);
    setNewVariantColor('');
    setNewVariantQty('');
  };

  const handleUpdateVariantQty = (index: number, newQty: string) => {
      const parsed = parseInt(newQty);
      if (isNaN(parsed) || parsed < 0) return;
      const updated = [...variants];
      updated[index].quantity = parsed;
      setVariants(updated);
  };

  const handleRemoveVariant = (index: number) => {
    const newVariants = [...variants];
    newVariants.splice(index, 1);
    setVariants(newVariants);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || (!isEditing && !cost) || !price || !imageUrl) {
      alert('Por favor complete todos los campos requeridos.');
      return;
    }
    
    // Aseguramos que la cantidad enviada sea la suma real de las variantes
    const finalQuantity = variants.length > 0 
        ? variants.reduce((acc, v) => acc + v.quantity, 0)
        : parseInt(quantity, 10);

    onSubmit({
      name,
      sku,
      cost: isEditing ? (initialData?.cost || 0) : parseFloat(cost),
      price: parseFloat(price),
      priceX2: priceX2 ? parseFloat(priceX2) : null,
      priceMatias: priceMatias ? parseFloat(priceMatias) : null,
      priceMatiasX2: priceMatiasX2 ? parseFloat(priceMatiasX2) : null,
      priceLosGurises: priceLosGurises ? parseFloat(priceLosGurises) : null,
      priceLosGurisesX2: priceLosGurisesX2 ? parseFloat(priceLosGurisesX2) : null,
      quantity: finalQuantity,
      imageUrl,
      variants,
      isActive,
    });
  };

  const disabledClasses = "bg-gray-200 dark:bg-gray-800 cursor-not-allowed";
  const enabledClasses = "bg-gray-50 dark:bg-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <span className="text-sm font-medium text-gray-900 dark:text-white">Estado del Producto</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">{isActive ? 'Activo' : 'Inactivo'}</span>
        </label>
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nombre del Producto</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
      </div>
       <div>
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">SKU Base</label>
        <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{isEditing ? 'Costo Promedio ($)' : 'Costo Inicial ($)'}</label>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={`border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:border-gray-600 dark:text-white ${isEditing ? disabledClasses : enabledClasses}`} required={!isEditing} step="0.01" disabled={isEditing} />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Stock Total</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:border-gray-600 dark:text-white ${variants.length > 0 ? disabledClasses : enabledClasses}`} required min="0" disabled={variants.length > 0} />
          {variants.length > 0 && <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-bold">✓ Calculado de variantes.</p>}
        </div>
      </div>

      <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Variantes de Color (Stock por color)</h4>
        <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Color" value={newVariantColor} onChange={e => setNewVariantColor(e.target.value)} className="flex-grow bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg p-2.5" />
            <input type="number" placeholder="Cant." value={newVariantQty} onChange={e => setNewVariantQty(e.target.value)} className="w-20 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg p-2.5" />
            <button type="button" onClick={handleAddVariant} className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="w-5 h-5" /></button>
        </div>
        {variants.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {variants.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 w-1/2">{v.color}</span>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={v.quantity} 
                                onChange={(e) => handleUpdateVariantQty(idx, e.target.value)}
                                className="w-16 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-center text-xs p-1 rounded font-bold"
                            />
                            <button type="button" onClick={() => handleRemoveVariant(idx)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      
      <div className="space-y-4 p-4 border rounded-lg dark:border-gray-600">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white -mb-2">Precios Generales</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Precio Venta ($)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required step="0.01" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Pack X2 ($)</label>
            <input type="number" value={priceX2} onChange={(e) => setPriceX2(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" step="0.01" />
          </div>
        </div>
      </div>

      {/* Secciones de canales simplificadas para brevedad pero manteniendo funcionalidad */}
      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg dark:border-gray-600 bg-purple-50 dark:bg-purple-900/10">
          <div className="col-span-2 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">Precios Canal Matías</div>
          <input type="number" placeholder="Precio ($)" value={priceMatias} onChange={e => setPriceMatias(e.target.value)} className="bg-white border text-sm p-2 rounded dark:bg-gray-700 dark:text-white" />
          <input type="number" placeholder="Pack X2 ($)" value={priceMatiasX2} onChange={e => setPriceMatiasX2(e.target.value)} className="bg-white border text-sm p-2 rounded dark:bg-gray-700 dark:text-white" />
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg dark:border-gray-600 bg-orange-50 dark:bg-orange-900/10">
          <div className="col-span-2 text-xs font-bold text-orange-700 dark:text-orange-300 uppercase">Precios Canal Los Gurises</div>
          <input type="number" placeholder="Precio ($)" value={priceLosGurises} onChange={e => setPriceLosGurises(e.target.value)} className="bg-white border text-sm p-2 rounded dark:bg-gray-700 dark:text-white" />
          <input type="number" placeholder="Pack X2 ($)" value={priceLosGurisesX2} onChange={e => setPriceLosGurisesX2(e.target.value)} className="bg-white border text-sm p-2 rounded dark:bg-gray-700 dark:text-white" />
      </div>

       <div>
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Imagen del Producto</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-24 object-cover rounded shadow-md" />
            ) : (
              <ImageIcon className="mx-auto h-10 w-10 text-gray-400" />
            )}
            <div className="flex text-xs text-gray-600 dark:text-gray-400">
              <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded font-medium text-blue-600 hover:text-blue-500">
                <span>Subir archivo</span>
                <input id="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" />
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300">Cancelar</button>
        <button type="submit" className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600">
          {initialData ? 'Guardar Cambios' : 'Crear Producto'}
        </button>
      </div>
    </form>
  );
};