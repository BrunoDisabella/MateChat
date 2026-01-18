import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Product, Sale, SaleItem, SalesChannel, ShippingMethod } from '../types.ts';
import { TrashIcon, PlusIcon, TruckIcon } from './icons.tsx';

interface SaleFormProps {
  products: Product[];
  onSubmit: (saleData: Omit<Sale, 'id'>) => void;
  onCancel: () => void;
  initialData?: Sale | null;
  shippingMethods: ShippingMethod[];
}

export const SaleForm: React.FC<SaleFormProps> = ({ products, onSubmit, onCancel, initialData, shippingMethods }) => {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [quantityToAdd, setQuantityToAdd] = useState('1');
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [salesChannel, setSalesChannel] = useState<SalesChannel>('Correo Uruguayo');
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Estados de Envío
  const [selectedShippingMethodName, setSelectedShippingMethodName] = useState<string>('');
  const [shippingUnitCost, setShippingUnitCost] = useState<string>('0');
  const [shippingQuantity, setShippingQuantity] = useState<string>('1');

  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [selectedProductOption, setSelectedProductOption] = useState<string>('');
  
  // Nuevo estado para el precio manual
  const [manualPrice, setManualPrice] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setItems(initialData.items);
      setDiscountPercentage(initialData.discountPercentage.toString());
      setSalesChannel(initialData.salesChannel);
      setDate(new Date(initialData.createdAt).toISOString().slice(0, 10));
      setSelectedShippingMethodName(initialData.shippingMethod || '');
      
      const qty = initialData.shippingQuantity || 1;
      setShippingQuantity(qty.toString());
      
      const totalCost = initialData.shippingCost || 0;
      setShippingUnitCost((qty > 0 ? totalCost / qty : 0).toString());

    } else {
      setItems([]);
      setDiscountPercentage('0');
      setSalesChannel('Correo Uruguayo');
      setDate(new Date().toISOString().slice(0, 10));
      setSelectedShippingMethodName('');
      setShippingUnitCost('0');
      setShippingQuantity('1');
    }
  }, [initialData]);

  const handleShippingChange = (methodName: string) => {
    setSelectedShippingMethodName(methodName);
    const method = shippingMethods.find(m => m.name === methodName);
    if (method) {
        setShippingUnitCost(method.cost.toString());
    } else {
        setShippingUnitCost('0');
    }
  };
  
  const productOptions = useMemo(() => {
    const isMatiasChannel = salesChannel === 'Matías';
    const isLosGurisesChannel = salesChannel === 'Los Gurises';
    
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const options: { value: string; label: string; productId: string }[] = [];
    
    filteredProducts.forEach(p => {
      let singlePrice = p.price;
      let packPrice = p.priceX2;

      if (isMatiasChannel) {
          singlePrice = p.priceMatias ? p.priceMatias : p.price;
          packPrice = p.priceMatiasX2 ? p.priceMatiasX2 : p.priceX2;
      } else if (isLosGurisesChannel) {
          singlePrice = p.priceLosGurises ? p.priceLosGurises : p.price;
          packPrice = p.priceLosGurisesX2 ? p.priceLosGurisesX2 : p.priceX2;
      }

      options.push({
        value: `${p.id}_single`,
        label: `${p.name} ($${singlePrice.toFixed(2)})`,
        productId: p.id,
      });

      if (packPrice && packPrice > 0) {
        options.push({
          value: `${p.id}_pack`,
          label: `${p.name} - Pack x2 ($${(packPrice).toFixed(2)})`,
          productId: p.id,
        });
      }
    });
    return options;
  }, [products, salesChannel, searchTerm]);

  useEffect(() => {
    setSelectedVariant('');
  }, [selectedProductOption]);

  useEffect(() => {
    if (productOptions.length > 0) {
      const selectionStillExists = productOptions.some(opt => opt.value === selectedProductOption);
      if (!selectionStillExists) {
        setSelectedProductOption(productOptions[0].value);
      }
    } else {
      setSelectedProductOption('');
    }
  }, [productOptions]);
  
  const activeProduct = useMemo(() => {
      if (!selectedProductOption) return null;
      const [pid] = selectedProductOption.split('_');
      return products.find(p => p.id === pid) || null;
  }, [selectedProductOption, products]);

  // Efecto para actualizar el precio sugerido cuando cambia el producto o el canal
  // Pero permite que el usuario lo edite después
  useEffect(() => {
      if (!activeProduct || !selectedProductOption) {
          setManualPrice('');
          return;
      }

      const [_, type] = selectedProductOption.split('_');
      const isPack = type === 'pack';
      const isMatiasChannel = salesChannel === 'Matías';
      const isLosGurisesChannel = salesChannel === 'Los Gurises';

      let suggestedPrice = 0;

      if (isPack) {
          let packPrice = activeProduct.priceX2;
          if (isMatiasChannel && activeProduct.priceMatiasX2) packPrice = activeProduct.priceMatiasX2;
          else if (isLosGurisesChannel && activeProduct.priceLosGurisesX2) packPrice = activeProduct.priceLosGurisesX2;
          suggestedPrice = packPrice || 0;
      } else {
          let singlePrice = activeProduct.price;
          if (isMatiasChannel && activeProduct.priceMatias) singlePrice = activeProduct.priceMatias;
          else if (isLosGurisesChannel && activeProduct.priceLosGurises) singlePrice = activeProduct.priceLosGurises;
          suggestedPrice = singlePrice || 0;
      }

      setManualPrice(suggestedPrice.toString());

  }, [activeProduct, selectedProductOption, salesChannel]);

  const handleAddItem = useCallback(() => {
    const addMultiplier = parseFloat(quantityToAdd);
    const finalPrice = parseFloat(manualPrice);
    
    if (!selectedProductOption || isNaN(addMultiplier) || addMultiplier <= 0) return;
    if (isNaN(finalPrice) || finalPrice < 0) {
        alert("El precio debe ser un número válido.");
        return;
    }
    if (!activeProduct) return;

    if (activeProduct.variants && activeProduct.variants.length > 0 && !selectedVariant) {
        alert("Por favor, selecciona un color/variante para este producto.");
        return;
    }

    const [productId, type] = selectedProductOption.split('_');
    const isPack = type === 'pack';

    const unitsNeeded = addMultiplier * (isPack ? 2 : 1);
    
    // Stock Logic
    const quantityInCart = items
        .filter(item => 
            item.productId === activeProduct.id && 
            (!selectedVariant || item.variant === selectedVariant) 
        )
        .reduce((acc, item) => acc + (item.name.includes('(Pack x2)') ? item.quantity * 2 : item.quantity), 0);
    
    let availableStock = activeProduct.quantity;
    if (selectedVariant && activeProduct.variants) {
        const variantData = activeProduct.variants.find(v => v.color === selectedVariant);
        if (variantData) availableStock = variantData.quantity;
    }

    if (availableStock < (quantityInCart + unitsNeeded)) {
        alert(`Stock insuficiente ${selectedVariant ? `para el color ${selectedVariant}` : ''}.\nDisponible: ${availableStock}\nRequerido total: ${quantityInCart + unitsNeeded}`);
        return;
    }

    let saleItem: SaleItem;
    const variantLabel = selectedVariant ? ` [${selectedVariant}]` : '';

    if (isPack) {
        // Usamos manualPrice directamente
        saleItem = {
            lineId: `${Date.now()}-${Math.random()}`,
            productId: activeProduct.id,
            name: `${activeProduct.name}${variantLabel} (Pack x2)`,
            sku: activeProduct.sku,
            quantity: addMultiplier,
            unitPrice: finalPrice, // Precio manual
            unitCost: activeProduct.cost * 2,
            variant: selectedVariant || undefined
        };
    } else {
        // Usamos manualPrice directamente
        saleItem = {
            lineId: `${Date.now()}-${Math.random()}`,
            productId: activeProduct.id,
            name: `${activeProduct.name}${variantLabel}`,
            sku: activeProduct.sku,
            quantity: addMultiplier,
            unitPrice: finalPrice, // Precio manual
            unitCost: activeProduct.cost,
            variant: selectedVariant || undefined
        };
    }
    
    const newItems = [...items];
    const existingItemIndex = newItems.findIndex(item => 
        item.productId === saleItem.productId && 
        item.name === saleItem.name &&
        item.variant === saleItem.variant &&
        item.unitPrice === saleItem.unitPrice // Solo agrupamos si el precio es el mismo
    );

    if (existingItemIndex > -1) {
        newItems[existingItemIndex].quantity += saleItem.quantity;
    } else {
        newItems.push(saleItem);
    }
    
    setItems(newItems);
    setQuantityToAdd('1');
    setSelectedVariant('');
    // No reseteamos manualPrice aquí para que si quiere agregar otro igual, el precio persista visualmente hasta que cambie producto
  }, [selectedProductOption, activeProduct, items, quantityToAdd, manualPrice, selectedVariant]);
  
  const handleRemoveItem = (lineId: string) => {
    setItems(items.filter(item => item.lineId !== lineId));
  };

  const { subtotal, total } = useMemo(() => {
    const sub = items.reduce((acc, item) => {
        return acc + item.unitPrice * item.quantity;
    }, 0);
    const discount = parseFloat(discountPercentage) || 0;
    const finalTotal = sub * (1 - discount / 100);
    return { subtotal: sub, total: finalTotal };
  }, [items, discountPercentage]);

  const totalShippingCost = useMemo(() => {
      const unit = parseFloat(shippingUnitCost) || 0;
      const qty = parseFloat(shippingQuantity) || 0;
      return unit * qty;
  }, [shippingUnitCost, shippingQuantity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Por favor agregue al menos un producto a la venta.');
      return;
    }

    const finalItems = items.map(item => {
      const isPack = item.name.includes('(Pack x2)');
      if(isPack){
        return {
          ...item,
          quantity: item.quantity * 2,
          unitPrice: item.unitPrice / 2, // Desglosamos el precio del pack para el unitario real
          unitCost: item.unitCost / 2,
          name: item.name.replace(' (Pack x2)', '').replace(` [${item.variant}]`, '')
        }
      }
      return {
          ...item,
          name: item.name.replace(` [${item.variant}]`, '')
      };
    });

    onSubmit({
      items: finalItems,
      discountPercentage: parseFloat(discountPercentage) || 0,
      subtotal,
      total,
      salesChannel,
      createdAt: new Date(date + 'T00:00:00').toISOString(),
      shippingMethod: selectedShippingMethodName || undefined,
      shippingCost: totalShippingCost,
      shippingQuantity: parseFloat(shippingQuantity) || 1,
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Agregar Productos</label>
          <div className="space-y-2">
              <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Buscar producto..."
              />
              <div className="flex flex-col gap-2">
                  <div className="w-full">
                      <select
                        value={selectedProductOption}
                        onChange={e => setSelectedProductOption(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={productOptions.length === 0}
                      >
                      {productOptions.length > 0 ? (
                          productOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                      ) : (
                          <option>No se encontraron productos</option>
                      )}
                      </select>
                      
                      {activeProduct && activeProduct.variants && activeProduct.variants.length > 0 && (
                          <div className="mt-2">
                              <select
                                value={selectedVariant}
                                onChange={e => setSelectedVariant(e.target.value)}
                                className="bg-yellow-50 border border-yellow-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-white"
                                required
                              >
                                  <option value="">-- Seleccionar Color --</option>
                                  {activeProduct.variants.map((v, idx) => (
                                      <option key={idx} value={v.color}>
                                          {v.color} (Stock: {v.quantity})
                                      </option>
                                  ))}
                              </select>
                          </div>
                      )}

                      {activeProduct && !selectedVariant && (!activeProduct.variants || activeProduct.variants.length === 0) && (
                          <p className="text-xs text-gray-500 mt-1 pl-1">
                              Stock Global: {activeProduct.quantity}
                          </p>
                      )}
                  </div>
                  
                  {/* Fila de Cantidad y Precio */}
                  <div className="flex gap-2 w-full">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cant.</label>
                        <input
                            type="number"
                            value={quantityToAdd}
                            onChange={e => setQuantityToAdd(e.target.value)}
                            min="0.1"
                            step="0.1"
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 dark:bg-gray-700 dark:border-gray-600 text-center"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Precio ($)</label>
                        <input
                            type="number"
                            value={manualPrice}
                            onChange={e => setManualPrice(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full bg-white border border-blue-300 text-gray-900 text-sm font-semibold rounded-lg p-2.5 dark:bg-gray-600 dark:border-blue-500 dark:text-white text-center shadow-sm"
                            placeholder="Precio"
                        />
                    </div>
                    <div className="flex items-end">
                        <button type="button" onClick={handleAddItem} className="p-2.5 mb-[1px] text-white bg-blue-600 rounded-lg hover:bg-blue-700 h-[42px] w-[42px] flex items-center justify-center">
                            <PlusIcon className="w-5 h-5"/>
                        </button>
                    </div>
                  </div>
              </div>
          </div>
        </div>
        
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 rounded-md border dark:border-gray-700 p-2">
          {items.length === 0 && <p className="text-center text-sm text-gray-500 py-4">Carrito vacío</p>}
          {items.map(item => (
              <div key={item.lineId} className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                <div className="flex-grow">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {item.name} 
                      {item.variant && <span className="ml-1 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">{item.variant}</span>}
                      <span className="ml-1">({item.quantity}x)</span>
                  </p>
                  <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                </div>
                <div className="text-right">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                        (${item.unitPrice.toFixed(2)} c/u)
                    </div>
                </div>
                <button type="button" onClick={() => handleRemoveItem(item.lineId)} className="text-red-500 hover:text-red-700">
                  <TrashIcon className="w-5 h-5"/>
                </button>
              </div>
          ))}
        </div>

        {/* Sección de Envío Actualizada */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-3">
                <TruckIcon className="w-4 h-4" /> Logística y Envío
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5">
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Método</label>
                    <select
                        value={selectedShippingMethodName}
                        onChange={e => handleShippingChange(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">-- Sin envío --</option>
                        {shippingMethods.map(method => (
                            <option key={method.id} value={method.name}>{method.name}</option>
                        ))}
                    </select>
                </div>
                <div className="sm:col-span-4">
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Costo Unitario ($)</label>
                    <input 
                        type="number" 
                        value={shippingUnitCost} 
                        onChange={e => setShippingUnitCost(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                    />
                </div>
                <div className="sm:col-span-3">
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Cantidad</label>
                    <input 
                        type="number" 
                        value={shippingQuantity} 
                        onChange={e => setShippingQuantity(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="1"
                        min="1"
                        step="1"
                    />
                </div>
            </div>
            {totalShippingCost > 0 && (
                <div className="mt-2 text-right text-sm text-blue-800 dark:text-blue-300 font-medium">
                    Total Envío (Resta ganancia): <span className="font-bold">${totalShippingCost.toFixed(2)}</span>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
           <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Canal de Venta</label>
              <select
                  value={salesChannel}
                  onChange={e => setSalesChannel(e.target.value as SalesChannel)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                  <option value="Correo Uruguayo">Correo Uruguayo</option>
                  <option value="Matías">Matías</option>
                  <option value="Mercado Libre">Mercado Libre</option>
                  <option value="Los Gurises">Los Gurises</option>
              </select>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Descuento (%)</label>
            <input type="number" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} min="0" max="100" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="sm:col-span-2">
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Fecha de Venta</label>
              <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-right space-y-1">
          <p className="text-md text-gray-600 dark:text-gray-300">Subtotal: <span className="font-mono">${subtotal.toFixed(2)}</span></p>
          {parseFloat(discountPercentage) > 0 && <p className="text-md text-red-500">Descuento: <span className="font-mono">-${(subtotal - total).toFixed(2)}</span></p>}
          <p className="text-xl font-bold text-gray-900 dark:text-white">Total: <span className="font-mono">${total.toFixed(2)}</span></p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500">Cancelar</button>
          <button type="submit" className="text-white bg-green-700 hover:bg-green-800 font-medium rounded-lg text-sm px-4 py-2 dark:bg-green-600">
             {initialData ? 'Actualizar Venta' : 'Guardar Venta'}
          </button>
        </div>
      </form>
    </>
  );
};