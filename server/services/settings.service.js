
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

class SettingsService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
    }

    initialize() {
        if (!config.supabaseUrl || (!config.supabaseAnonKey && !config.supabaseServiceKey)) {
            console.error('[Settings] Supabase credentials missing. Multi-tenancy will not work.');
            return;
        }

        const keyToUse = config.supabaseServiceKey || config.supabaseAnonKey;
        if (config.supabaseServiceKey) {
            console.log('[Settings] Initializes using SERVICE ROLE KEY (Bypassing RLS)');
        } else {
            console.warn('[Settings] Initialized using ANON KEY (RLS enforced - might fail for backend ops)');
        }

        this.supabase = createClient(config.supabaseUrl, keyToUse, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
        this.initialized = true;
        console.log('[Settings] Service initialized');
    }

    /**
     * Obtiene la configuración de un usuario
     * @param {string} userId - ID del usuario de Supabase
     */
    async getUserSettings(userId) {
        if (!this.initialized) return null;

        const { data, error } = await this.supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('[Settings] Error fetching settings:', error);
            return null;
        }

        // Si no existe, crearlo
        if (!data) {
            return await this.createDefaultSettings(userId);
        }

        return data;
    }

    /**
     * Crea configuración por defecto para un nuevo usuario
     */
    async createDefaultSettings(userId) {
        const newSettings = {
            user_id: userId,
            api_key: uuidv4(),
            webhooks: [],
            whatsapp_status: 'disconnected'
        };

        const { data, error } = await this.supabase
            .from('user_settings')
            .insert(newSettings)
            .select()
            .single();

        if (error) {
            console.error('[Settings] Error creating settings:', error);
            throw error;
        }

        return data;
    }

    /**
     * Busca configuración por API Key
     */
    async getByApiKey(apiKey) {
        if (!this.initialized) return null;

        const { data, error } = await this.supabase
            .from('user_settings')
            .select('*')
            .eq('api_key', apiKey)
            .single();

        if (error) {
            // console.error('[Settings] API Key lookup failed:', error.message);
            return null;
        }

        return data;
    }

    /**
     * Guarda los webhooks del usuario
     */
    async saveWebhooks(userId, webhooks) {
        if (!this.initialized) return false;

        const { error } = await this.supabase
            .from('user_settings')
            .update({ webhooks, updated_at: new Date() })
            .eq('user_id', userId);

        if (error) {
            console.error('[Settings] Error saving webhooks:', error);
            return false;
        }
        return true;
    }

    /**
     * Actualiza la API Key con un valor personalizado
     */
    async updateApiKey(userId, newApiKey) {
        if (!this.initialized) return false;

        const { error } = await this.supabase
            .from('user_settings')
            .update({ api_key: newApiKey, updated_at: new Date() })
            .eq('user_id', userId);

        if (error) {
            console.error('[Settings] Error updating API key:', error);
            return false;
        }
        return true;
    }

    /**
     * Genera una nueva API Key para el usuario
     */
    async rotateApiKey(userId) {
        if (!this.initialized) return null;

        const newKey = uuidv4();
        return await this.updateApiKey(userId, newKey) ? newKey : null;
    }
}

export const settingsService = new SettingsService();
