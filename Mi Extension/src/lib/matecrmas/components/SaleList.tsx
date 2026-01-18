
import React from 'react';
import { Sale, SalesChannel } from '../types.ts';
import { ReceiptIcon, PencilIcon, TrashIcon, SyncIcon, TruckIcon } from './icons.tsx';

interface SaleListProps {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (saleId: string) => void;
  isLoading?: boolean;
}

const channelStyles: { [key in SalesChannel]: string } = {
  'Correo Uruguayo': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Matías': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'Mercado Libre': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'Los Gurises': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

export const SaleList: React.FC<SaleListProps> = ({ sales, onEdit, onDelete, isLoading = false }) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ReceiptIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Historial de Ventas</h2>
        {isLoading && <SyncIcon className="w-5 h-5 text-gray-400 animate-spin ml-2" />}
      </div>
      
      {isLoading ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <SyncIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">Cargando historial...</p>
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay ventas registradas en este período.</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const isReadOnly = sale.salesChannel === 'Mercado Libre';
            return (
              <div key={sale.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-shadow hover:shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {new Date(sale.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${channelStyles[sale.salesChannel]}`}>
                            {sale.salesChannel}
                        </span>
                    </div>
                    
                    <ul className="mt-3 text-sm text-gray-700 dark:text-gray-200 list-none space-y-1">
                      {sale.items.map((item, index) => (
                        <li key={item.lineId || index} className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{item.quantity}x</span> 
                          <span>{item.name}</span>
                          {item.variant && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">[{item.variant}]</span>}
                        </li>
                      ))}
                    </ul>

                    {/* Información de Envío visible en la tarjeta */}
                    {sale.shippingMethod && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded w-fit">
                            <TruckIcon className="w-4 h-4" />
                            <span className="font-semibold">{sale.shippingMethod}</span>
                            {sale.shippingCost !== undefined && sale.shippingCost > 0 && (
                                <span className="ml-1 border-l border-blue-200 pl-2">Costo: ${sale.shippingCost.toFixed(2)}</span>
                            )}
                        </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-3 sm:pt-0 sm:pl-4">
                    {sale.discountPercentage > 0 && (
                        <p className="text-sm text-red-500 font-medium">-{sale.discountPercentage}% OFF</p>
                    )}
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${sale.total.toFixed(2)}</p>
                    <div className="mt-3 flex justify-end gap-2">
                      {!isReadOnly && (
                        <>
                          <button
                              onClick={() => onEdit(sale)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Editar"
                          >
                              <PencilIcon className="w-5 h-5"/>
                          </button>
                          <button
                              onClick={() => onDelete(sale.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Eliminar"
                          >
                              <TrashIcon className="w-5 h-5"/>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
