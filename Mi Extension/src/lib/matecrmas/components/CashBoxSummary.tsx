
import React from 'react';
import { CashBoxTransaction } from '../types.ts';
import { CashIcon, PlusIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon } from './icons.tsx';

interface CashBoxSummaryProps {
    balance: number;
    transactions: CashBoxTransaction[];
    onAddIncome: () => void;
    onAddOutcome: () => void;
    onDeleteTransaction: (transactionId: string) => void;
}

export const CashBoxSummary: React.FC<CashBoxSummaryProps> = ({ balance, transactions, onAddIncome, onAddOutcome, onDeleteTransaction }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <CashIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dinero en Caja</h3>
                        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            ${balance.toFixed(2)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={onAddIncome}
                        className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Ingreso</span>
                    </button>
                    <button
                        onClick={onAddOutcome}
                        className="inline-flex items-center justify-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        <ArrowDownIcon className="w-5 h-5" />
                        <span>Egreso</span>
                    </button>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Movimientos Recientes</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {transactions.length > 0 ? (
                        transactions.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                <div>
                                    <p className="text-gray-800 dark:text-gray-200">{t.description}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(t.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-1 font-semibold ${t.type === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {t.type === 'ingreso' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                                        <span>${t.amount.toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={() => onDeleteTransaction(t.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        aria-label="Eliminar movimiento"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay movimientos registrados.</p>
                    )}
                </div>
            </div>
        </div>
    );
};