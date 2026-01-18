
import { useState, useCallback, useEffect } from 'react';
import { AdCostRecord } from '../types.ts';
import { supabase } from '../lib/supabase.ts';
import { Logger } from '../lib/logger.ts';

export const useAdCosts = () => {
    const [adCostRecords, setAdCostRecords] = useState<AdCostRecord[]>([]);

    const fetchAdCostRecords = useCallback(async () => {
        const { data, error } = await supabase
            .from('ad_costs')
            .select('*')
            .order('end_date', { ascending: false });

        if (error) {
            Logger.error(`Error fetching ad cost records: ${error.message}`);
        } else if (data) {
            setAdCostRecords(data);
        }
    }, []);

    useEffect(() => {
        fetchAdCostRecords();
    }, [fetchAdCostRecords]);

    const addAdCostRecord = useCallback(async (recordData: Omit<AdCostRecord, 'id' | 'created_at'>) => {
        const { data, error } = await supabase
            .from('ad_costs')
            .insert([recordData])
            .select()
            .single();

        if (error) {
            Logger.error(`Error adding ad cost record: ${error.message}`);
        } else if (data) {
            Logger.info(`Nuevo registro de costo de publicidad guardado para el producto ID ${data.product_id}.`);
            // Refetch to ensure data is sorted correctly from the DB
            fetchAdCostRecords(); 
        }
    }, [fetchAdCostRecords]);

    return { adCostRecords, addAdCostRecord };
};