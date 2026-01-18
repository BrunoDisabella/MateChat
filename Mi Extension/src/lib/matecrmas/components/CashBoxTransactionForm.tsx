
import React, { useState } from 'react';
import { CashBoxTransaction, TransactionType } from '../types.ts';

interface CashBoxTransactionFormProps {
  onSubmit: (data: Omit<CashBoxTransaction, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  transactionType: TransactionType;
}

export const CashBoxTransactionForm: React.FC<CashBoxTransactionFormProps> = ({ onSubmit, onCancel, transactionType }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || parseFloat(amount) <= 0) {
      alert('Por favor, complete todos los campos con valores válidos.');
      return;
    }
    onSubmit({
      amount: parseFloat(amount),
      description,
      type: transactionType,
    });
  };

  const isIncome = transactionType === 'ingreso';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="amount" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Monto ($)</label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
          placeholder="Ej: 1000"
          required
          step="0.01"
          min="0.01"
        />
      </div>
      <div>
        <label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Descripción</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
          placeholder={isIncome ? "Ej: Inversión inicial" : "Ej: Retiro para gastos"}
          required
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={`font-medium rounded-lg text-sm px-4 py-2 text-white focus:outline-none focus:ring-4 ${
            isIncome 
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-300 dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-800'
              : 'bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800'
          }`}
        >
          {isIncome ? 'Agregar Ingreso' : 'Confirmar Egreso'}
        </button>
      </div>
    </form>
  );
};