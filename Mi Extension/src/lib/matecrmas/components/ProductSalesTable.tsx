
import React from 'react';
import { AdCostRecord } from '../types.ts';
import { ArrowUpIcon, ArrowDownIcon } from './icons.tsx';

interface ProductSaleSummary {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string;
  unitsSold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  adCost: number;
}

interface ProductSalesTableProps {
  data: ProductSaleSummary[];
  adCosts: { [productId: string]: number };
  onAdCostChange: (productId: string, cost: number) => void;
  adCostInputEnabled: boolean;
  adCostHistory: AdCostRecord[];
}

const CostTrendIndicator: React.FC<{ currentCost: number; productHistory: AdCostRecord[] }> = ({ currentCost, productHistory }) => {
    if (productHistory.length < 2) {
      return <span className="text-gray-400">-</span>;
    }
    
    // History is sorted by end_date descending, so index 0 is the latest, 1 is the one before
    const previousCost = productHistory[1].cost_per_sale;
    
    if (currentCost > previousCost) {
      return <ArrowUpIcon className="w-4 h-4 text-red-500" />;
    }
    if (currentCost < previousCost) {
      return <ArrowDownIcon className="w-4 h-4 text-green-500" />;
    }
    
    return <span className="text-gray-400">-</span>;
};

export const ProductSalesTable: React.FC<ProductSalesTableProps> = ({ data, adCosts, onAdCostChange, adCostInputEnabled, adCostHistory }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mt-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Desglose de Ventas por Producto</h3>
      <div className="overflow-x-auto">
        {data.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unidades Vendidas</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Facturación</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Mercadería</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Publicidad</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Pub/Venta</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Beneficio</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((product) => {
                const costPerSale = product.unitsSold > 0 ? product.adCost / product.unitsSold : 0;
                const productHistory = adCostHistory.filter(h => h.product_id === product.productId);

                return (
                  <tr key={product.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-md object-cover" src={product.imageUrl} alt={product.name} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{product.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-300 font-mono">
                      {Number.isInteger(product.unitsSold) ? product.unitsSold : product.unitsSold.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-300 font-mono">${product.totalRevenue.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-300 font-mono">${product.totalCost.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-end">
                          <span className="text-gray-500 dark:text-gray-400 mr-1">$</span>
                          <input
                              type="number"
                              value={adCostInputEnabled ? (adCosts[product.productId] ?? '') : product.adCost.toFixed(2)}
                              onChange={(e) => onAdCostChange(product.productId, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-24 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-1.5 text-sm text-right focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                              aria-label={`Costo de publicidad para ${product.name}`}
                              disabled={!adCostInputEnabled}
                          />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-300 font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <span>${costPerSale.toFixed(2)}</span>
                        <CostTrendIndicator currentCost={costPerSale} productHistory={productHistory} />
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold font-mono ${product.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ${product.profit.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">No hay datos de ventas de productos para el período seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
};