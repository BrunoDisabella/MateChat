
import React from 'react';
import { ExpenseCategory } from '../types.ts';
import { CurrencyDollarIcon, TrashIcon } from './icons.tsx';

export interface UnifiedExpense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory | 'Egreso de Caja';
  createdAt: string;
  source: 'expense' | 'cashbox';
}

interface ExpenseListProps {
  expenses: UnifiedExpense[];
  onDelete: (id: string, source: 'expense' | 'cashbox') => void;
}

const categoryStyles: { [key in ExpenseCategory | 'Egreso de Caja']: string } = {
  'Publicidad': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  'Costo de Envío': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Devolución': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'Otro': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  'Egreso de Caja': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, onDelete }) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CurrencyDollarIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Historial de Gastos</h2>
      </div>
      {expenses.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay gastos registrados.</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">¡Registra tu primer gasto para verlo aquí!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-shadow hover:shadow-md">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(expense.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryStyles[expense.category]}`}>
                          {expense.category}
                      </span>
                  </div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-1 break-words">{expense.description}</p>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto flex items-center justify-end gap-4">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">- ${expense.amount.toFixed(2)}</p>
                  <button
                        onClick={() => onDelete(expense.id, expense.source)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                        aria-label="Eliminar Gasto"
                    >
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};