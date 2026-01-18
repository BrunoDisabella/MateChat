
import { useState, useCallback, useEffect } from 'react';
import { Expense } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';

export const useExpenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);

    const fetchExpenses = useCallback(async () => {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('createdAt', { ascending: false });
        
        if (error) {
            Logger.error(`Error fetching expenses: ${error.message}`);
        } else if (data) {
            setExpenses(data);
        }
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const addExpense = useCallback(async (expenseData: Omit<Expense, 'id'>) => {
        const { data, error } = await supabase
            .from('expenses')
            .insert([expenseData])
            .select();

        if (error) {
            Logger.error(`Error adding expense: ${error.message}`);
        } else if (data) {
            setExpenses(prevExpenses => [data[0], ...prevExpenses]);
        }
    }, []);

    const deleteExpense = useCallback(async (expenseId: string) => {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId);
        
        if (error) {
            Logger.error(`Error al eliminar el gasto: ${error.message}`);
        } else {
            setExpenses(prevExpenses => prevExpenses.filter(e => e.id !== expenseId));
        }
    }, []);

    return { expenses, addExpense, deleteExpense };
};