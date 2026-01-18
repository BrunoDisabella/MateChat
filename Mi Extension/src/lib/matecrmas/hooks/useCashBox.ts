
import { useState, useCallback, useEffect, useMemo } from 'react';
import { CashBoxTransaction } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';

export const useCashBox = () => {
    const [transactions, setTransactions] = useState<CashBoxTransaction[]>([]);

    const fetchTransactions = useCallback(async () => {
        const { data, error } = await supabase
            .from('cash_box_transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            Logger.error(`Error fetching cash box transactions: ${error.message}`);
        } else if (data) {
            setTransactions(data);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const addTransaction = useCallback(async (transactionData: Omit<CashBoxTransaction, 'id' | 'created_at'>) => {
        // Sanitize the object to ensure only the required fields are sent.
        // This prevents potential conflicts with RLS policies if unexpected fields are present.
        const cleanData = {
            amount: transactionData.amount,
            type: transactionData.type,
            description: transactionData.description,
        };

        Logger.info('Attempting to add cash box transaction', cleanData);

        const { data, error } = await supabase
            .from('cash_box_transactions')
            .insert([cleanData])
            .select()
            .single();

        if (error) {
            Logger.error(`Error adding cash box transaction: ${error.message}`, { details: error });
        } else if (data) {
            Logger.info('Successfully added cash box transaction', data);
            setTransactions(prev => [data, ...prev]);
        }
    }, []);

    const deleteTransaction = useCallback(async (transactionId: string) => {
        const { error } = await supabase
            .from('cash_box_transactions')
            .delete()
            .eq('id', transactionId);

        if (error) {
            Logger.error(`Error deleting cash box transaction: ${error.message}`);
        } else {
            Logger.info(`Cash box transaction deleted: ${transactionId}`);
            setTransactions(prev => prev.filter(t => t.id !== transactionId));
        }
    }, []);

    const balance = useMemo(() => {
        return transactions.reduce((acc, t) => {
            // Defensively cast amount to a number to prevent calculation errors if it's a string.
            const amount = Number(t.amount);
            if (t.type === 'ingreso') {
                return acc + amount;
            } else {
                return acc - amount;
            }
        }, 0);
    }, [transactions]);

    return { transactions, balance, addTransaction, deleteTransaction };
};