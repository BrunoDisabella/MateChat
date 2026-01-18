import React from 'react';
import { PlusIcon, ShoppingCartIcon, CurrencyDollarIcon, AlertTriangleIcon } from './icons.tsx';

interface HeaderProps {
    onAddProduct: () => void;
    onRecordSale: () => void;
    onAddExpense: () => void;
    onAddFailure: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAddProduct, onRecordSale, onAddExpense, onAddFailure }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            MateCRM
          </h1>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
             <button
              onClick={onAddFailure}
              className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              aria-label="Registrar Falla"
            >
              <AlertTriangleIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Registrar Falla</span>
            </button>
             <button
              onClick={onAddExpense}
              className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              aria-label="Agregar Gasto"
            >
              <CurrencyDollarIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Agregar Gasto</span>
            </button>
             <button
              onClick={onRecordSale}
              className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              aria-label="Registrar Venta"
            >
              <ShoppingCartIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Registrar Venta</span>
            </button>
            <button
              onClick={onAddProduct}
              className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Agregar Producto"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Agregar Producto</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};