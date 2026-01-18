

import React, { useState, useMemo } from 'react';
import { CalculatorIcon, CurrencyDollarIcon, BoxIcon, SyncIcon, SparklesIcon } from './icons.tsx';

export const CalculatorPage: React.FC = () => {
  // Estado de los inputs
  const [productCost, setProductCost] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [pickupCost, setPickupCost] = useState<string>('25');
  const [taxValue, setTaxValue] = useState<string>('12'); // Monto fijo en pesos
  const [adCost, setAdCost] = useState<string>('300');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [deliveryRate, setDeliveryRate] = useState<string>('85'); // Tasa de entrega

  const calculateSuggestedPrice = () => {
    const cost = parseFloat(productCost) || 0;
    const w = parseFloat(weight) || 0;
    const pickup = parseFloat(pickupCost) || 0;
    const tax = parseFloat(taxValue) || 0;
    const ads = parseFloat(adCost) || 0;
    const rate = parseFloat(deliveryRate) || 0;
    const rateDecimal = rate / 100;

    // Calcular Envío (Misma lógica que en results)
    let shipping = 0;
    if (w > 0) {
      if (w <= 2) shipping = 189;
      else if (w <= 5) shipping = 210;
      else if (w <= 10) shipping = 263;
      else if (w <= 15) shipping = 310;
      else if (w <= 20) shipping = 389;
      else if (w <= 25) shipping = 446;
      else if (w <= 30) shipping = 530;
      else shipping = 530;
    }

    // Costos Fijos Totales
    const fixedCosts = cost + shipping + pickup + ads + tax;

    // Algoritmo Inverso para Margen Real del 20%
    // Formula derivada: Price = (FixedCosts + (105 * Rate)) / (Rate * (1 - 0.01 - TargetMargin))
    // Donde 0.01 es el % de contrarrembolso y TargetMargin es 0.20
    
    if (rateDecimal <= 0) {
        alert("La tasa de entrega no puede ser 0.");
        return;
    }

    const targetMargin = 0.20;
    const codPercentage = 0.01;
    const baseCodFee = 105;

    const numerator = fixedCosts + (baseCodFee * rateDecimal);
    const denominator = rateDecimal * (1 - codPercentage - targetMargin);

    if (denominator <= 0) {
        alert("No es posible alcanzar ese margen con los costos actuales.");
        return;
    }

    const suggested = numerator / denominator;
    setSellingPrice(suggested.toFixed(2));
  };

  // Cálculos derivados
  const results = useMemo(() => {
    const cost = parseFloat(productCost) || 0;
    const w = parseFloat(weight) || 0;
    const pickup = parseFloat(pickupCost) || 0;
    const tax = parseFloat(taxValue) || 0;
    const ads = parseFloat(adCost) || 0;
    const price = parseFloat(sellingPrice) || 0;
    const rate = parseFloat(deliveryRate) || 0;
    const rateDecimal = rate / 100;

    // Regla de envío según peso
    let shipping = 0;
    if (w > 0) {
      if (w <= 2) shipping = 189;
      else if (w <= 5) shipping = 210;
      else if (w <= 10) shipping = 263;
      else if (w <= 15) shipping = 310;
      else if (w <= 20) shipping = 389;
      else if (w <= 25) shipping = 446;
      else if (w <= 30) shipping = 530;
      else shipping = 530; // Fallback para más de 30kg
    }

    // Costo de Contrarrembolso "Full" (si la entrega es exitosa)
    // Regla: $105 + 1% del valor de la mercadería
    const codFull = price > 0 ? 105 + (price * 0.01) : 0;

    // --- CÁLCULOS PONDERADOS POR TASA DE ENTREGA ---
    
    // 1. Facturación Esperada (Precio Venta * Tasa)
    const expectedRevenue = price * rateDecimal;

    // 2. Costo Contrarrembolso Esperado (Costo COD * Tasa)
    const expectedCod = codFull * rateDecimal;

    // 3. Costos Fijos (Se pagan salga bien o mal la entrega)
    const fixedCosts = cost + shipping + pickup + ads + tax;

    // Costo Total Promedio por Despacho
    const totalExpectedCost = fixedCosts + expectedCod;

    const profit = expectedRevenue - totalExpectedCost;
    const margin = expectedRevenue > 0 ? (profit / expectedRevenue) * 100 : 0;

    // Nuevo cálculo: Cobro en Agencia = Precio Venta - Envío - Contrarrembolso - Impuesto
    // NOTA: Se usa el precio real (price) y el costo full de COD, no los ponderados.
    const agencyCollection = price - shipping - codFull - tax;

    return {
      shipping,
      codFull,
      expectedCod,
      taxAmount: tax,
      totalExpectedCost,
      expectedRevenue,
      profit,
      margin,
      rateDecimal,
      agencyCollection
    };
  }, [productCost, weight, pickupCost, taxValue, adCost, sellingPrice, deliveryRate]);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <CalculatorIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calculadora de Rentabilidad</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Columna de Inputs */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <BoxIcon className="w-5 h-5" /> Datos del Producto
          </h3>
          
          <div className="space-y-4">
            {/* Costo Producto */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Costo del Producto ($)</label>
              <input
                type="number"
                value={productCost}
                onChange={(e) => setProductCost(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Ej: 800"
                min="0"
              />
            </div>

            {/* Peso */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Peso (Kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Ej: 1.5"
                min="0"
                step="0.1"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Determina el costo de envío automáticamente.</p>
            </div>

            {/* Tasa de Entrega */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <label className="block mb-2 text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <SyncIcon className="w-4 h-4" /> Tasa de Entrega (%)
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={deliveryRate}
                        onChange={(e) => setDeliveryRate(e.target.value)}
                        className="bg-white border border-blue-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="85"
                        min="0"
                        max="100"
                    />
                    <span className="text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        Efectividad
                    </span>
                </div>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Afecta a la Facturación Real y al costo de Contrarrembolso.
                </p>
            </div>

            {/* Costos Fijos Editables */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Levante ($)</label>
                    <input
                        type="number"
                        value={pickupCost}
                        onChange={(e) => setPickupCost(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Impuesto ($)</label>
                    <input
                        type="number"
                        value={taxValue}
                        onChange={(e) => setTaxValue(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>

             <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Publicidad ($)</label>
                <input
                    type="number"
                    value={adCost}
                    onChange={(e) => setAdCost(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-gray-900 dark:text-white">Precio de Venta ($)</label>
                    <button 
                        onClick={calculateSuggestedPrice}
                        className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors"
                        title="Calcula el precio necesario para obtener un 20% de margen real"
                    >
                        <SparklesIcon className="w-4 h-4" /> Sugerir para 20% Margen
                    </button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 font-bold">$</span>
                    </div>
                    <input
                        type="number"
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        className="bg-white border-2 border-blue-300 text-gray-900 text-lg font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-8 p-2.5 dark:bg-gray-700 dark:border-blue-800 dark:text-white"
                        placeholder="0.00"
                        min="0"
                    />
                </div>
            </div>
          </div>
        </div>

        {/* Columna de Resultados */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg shadow-inner border border-gray-200 dark:border-gray-700 flex flex-col h-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5" /> Análisis de Rentabilidad Promedio
          </h3>

          <div className="space-y-3 flex-grow text-sm">
            <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <span className="text-gray-800 dark:text-gray-200 font-semibold">Facturación Esperada</span>
                <div className="text-right">
                     <span className="font-mono font-bold text-gray-900 dark:text-white">${results.expectedRevenue.toFixed(2)}</span>
                     <p className="text-[10px] text-gray-500">({parseFloat(sellingPrice || '0')} × {results.rateDecimal})</p>
                </div>
            </div>

             <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 mt-2">
                <span className="text-blue-800 dark:text-blue-200 font-semibold">Cobro en Agencia</span>
                <div className="text-right">
                     <span className="font-mono font-bold text-blue-900 dark:text-blue-100">${results.agencyCollection.toFixed(2)}</span>
                     <p className="text-[10px] text-blue-500 dark:text-blue-400">(Venta - Envío - C.Reemb. - Imp.)</p>
                </div>
            </div>

            <div className="my-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costos por Despacho</div>

            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-gray-600 dark:text-gray-400">Costo Producto</span>
                <span className="font-mono font-medium dark:text-gray-200">${parseFloat(productCost || '0').toFixed(2)}</span>
            </div>
            
             <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-gray-600 dark:text-gray-400">Envío ({weight || 0}kg)</span>
                <span className="font-mono font-medium text-orange-600 dark:text-orange-400">${results.shipping.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <div>
                    <span className="text-gray-600 dark:text-gray-400 block">Contrarrembolso</span>
                    <span className="text-[10px] text-gray-400">(${results.codFull.toFixed(2)} × {results.rateDecimal})</span>
                </div>
                <span className="font-mono font-medium text-orange-600 dark:text-orange-400">${results.expectedCod.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-gray-600 dark:text-gray-400">Levante</span>
                <span className="font-mono font-medium text-orange-600 dark:text-orange-400">${parseFloat(pickupCost || '0').toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-gray-600 dark:text-gray-400">Impuesto</span>
                <span className="font-mono font-medium text-orange-600 dark:text-orange-400">${results.taxAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-gray-600 dark:text-gray-400">Publicidad</span>
                <span className="font-mono font-medium text-purple-600 dark:text-purple-400">${parseFloat(adCost || '0').toFixed(2)}</span>
            </div>
            
             <div className="border-t border-gray-300 dark:border-gray-600 my-4"></div>

            <div className="flex justify-between items-center p-2 bg-gray-200 dark:bg-gray-700 rounded font-bold">
                <span className="text-gray-800 dark:text-white">Costo Total Promedio</span>
                <span className="font-mono text-red-600 dark:text-red-400">${results.totalExpectedCost.toFixed(2)}</span>
            </div>
          </div>

          <div className={`mt-6 p-4 rounded-lg text-center border-2 ${results.profit >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
             <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Ganancia Promedio por Unidad</p>
             <p className={`text-3xl font-bold ${results.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${results.profit.toFixed(2)}
             </p>
             <p className={`text-sm font-medium mt-1 ${results.profit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                Margen Real: {results.margin.toFixed(1)}%
             </p>
             <p className="text-xs text-gray-400 mt-2">Considerando {deliveryRate}% de entregas exitosas</p>
          </div>
        </div>
      </div>
    </div>
  );
};
