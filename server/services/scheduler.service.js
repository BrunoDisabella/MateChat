/**
 * Scheduler Service - Servicio de mensajes y estados programados
 * 
 * Hace polling a Supabase cada minuto para ejecutar mensajes/estados pendientes.
 * Funciona incluso cuando el navegador está cerrado.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { whatsappBaileysService } from './whatsapp-baileys.service.js';

class SchedulerService {
    constructor() {
        this.supabase = null;
        this.intervalId = null;
        this.isRunning = false;
        this.pollIntervalMs = 60000; // 1 minuto
    }

    initialize() {
        // Inicializar Supabase si hay credenciales
        if (config.supabaseUrl && config.supabaseAnonKey) {
            this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
            console.log('[Scheduler] Supabase client initialized');
        } else {
            console.warn('[Scheduler] Supabase credentials not configured. Scheduler disabled.');
            return;
        }
    }

    start() {
        if (!this.supabase) {
            console.warn('[Scheduler] Cannot start - Supabase not configured');
            return;
        }

        if (this.isRunning) {
            console.log('[Scheduler] Already running');
            return;
        }

        console.log('[Scheduler] Starting scheduler service...');
        this.isRunning = true;

        // Ejecutar inmediatamente y luego cada minuto
        this.processAll();
        this.intervalId = setInterval(() => this.processAll(), this.pollIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[Scheduler] Stopped');
    }

    async processAll() {
        try {
            await this.processScheduledMessages();
            await this.processScheduledStatuses();
        } catch (error) {
            console.error('[Scheduler] Error in processAll:', error);
        }
    }

    async processScheduledMessages() {
        try {
            const now = new Date().toISOString();

            // Buscar mensajes pendientes cuyo scheduled_time ya pasó
            const { data: messages, error } = await this.supabase
                .from('scheduled_messages')
                .select('*')
                .eq('status', 'pending')
                .eq('is_active', true)
                .lte('scheduled_time', now)
                .limit(20);

            if (error) {
                console.error('[Scheduler] Error fetching messages:', error);
                return;
            }

            if (!messages || messages.length === 0) {
                return; // Sin mensajes pendientes
            }

            console.log(`[Scheduler] Processing ${messages.length} scheduled messages...`);

            for (const msg of messages) {
                await this.sendScheduledMessage(msg);
            }

        } catch (error) {
            console.error('[Scheduler] Error processing messages:', error);
        }
    }

    async sendScheduledMessage(scheduledMsg) {
        const { id, chat_id, body, media_url, media_type, user_id } = scheduledMsg;

        try {
            // Verificar si el cliente está listo
            const isReady = whatsappBaileysService.isClientReady(user_id || 'default-user');

            if (!isReady) {
                await this.markAsFailed(id, 'WhatsApp client not connected');
                return;
            }

            // Formatear chatId correctamente
            let targetChatId = chat_id;
            if (!chat_id.includes('@')) {
                targetChatId = `${chat_id.replace(/\D/g, '')}@c.us`;
            }

            console.log(`[Scheduler] Sending message to ${targetChatId}: "${body?.substring(0, 30)}..."`);

            // Enviar mensaje usando Baileys
            await whatsappBaileysService.sendMessage(user_id || 'default-user', targetChatId, body || '');

            // Marcar como enviado
            await this.markAsSent(id);
            console.log(`[Scheduler] ✅ Message ${id} sent successfully`);

        } catch (error) {
            console.error(`[Scheduler] ❌ Failed to send message ${id}:`, error);
            await this.markAsFailed(id, error.message);
        }
    }

    async processScheduledStatuses() {
        try {
            const now = new Date().toISOString();

            const { data: statuses, error } = await this.supabase
                .from('scheduled_statuses')
                .select('*')
                .eq('status', 'pending')
                .lte('scheduled_time', now)
                .limit(10);

            if (error) {
                console.error('[Scheduler] Error fetching statuses:', error);
                return;
            }

            if (!statuses || statuses.length === 0) {
                return;
            }

            console.log(`[Scheduler] Processing ${statuses.length} scheduled statuses...`);

            for (const status of statuses) {
                await this.postScheduledStatus(status);
            }

        } catch (error) {
            console.error('[Scheduler] Error processing statuses:', error);
        }
    }

    async postScheduledStatus(scheduledStatus) {
        const { id, content, media_url, media_type, user_id } = scheduledStatus;

        try {
            const isReady = whatsappBaileysService.isClientReady(user_id || 'default-user');

            if (!isReady) {
                await this.markStatusAsFailed(id, 'WhatsApp client not connected');
                return;
            }

            console.log(`[Scheduler] Posting status: "${content?.substring(0, 30)}..."`);

            // TODO: Baileys no tiene setStatus() - necesita implementación
            // Por ahora marcamos como fallido
            await this.markStatusAsFailed(id, 'Status posting not yet implemented in Baileys');
            console.log(`[Scheduler] ⚠️ Status ${id} - feature not implemented`);

        } catch (error) {
            console.error(`[Scheduler] ❌ Failed to post status ${id}:`, error);
            await this.markStatusAsFailed(id, error.message);
        }
    }

    async markAsSent(id) {
        await this.supabase
            .from('scheduled_messages')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', id);
    }

    async markAsFailed(id, errorMessage) {
        await this.supabase
            .from('scheduled_messages')
            .update({
                status: 'failed',
                error_message: errorMessage
            })
            .eq('id', id);
    }

    async markStatusAsSent(id) {
        await this.supabase
            .from('scheduled_statuses')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', id);
    }

    async markStatusAsFailed(id, errorMessage) {
        await this.supabase
            .from('scheduled_statuses')
            .update({
                status: 'failed',
                error_message: errorMessage
            })
            .eq('id', id);
    }

    // Métodos para crear programaciones desde la API
    async createScheduledMessage({ userId, chatId, body, mediaUrl, mediaType, scheduledTime }) {
        if (!this.supabase) throw new Error('Supabase not configured');

        // Normalizar chatId
        let normalizedChatId = chatId;
        if (!chatId.includes('@')) {
            normalizedChatId = `${chatId.replace(/\D/g, '')}@c.us`;
        }

        const { data, error } = await this.supabase
            .from('scheduled_messages')
            .insert({
                user_id: userId || 'default-user',
                chat_id: normalizedChatId,
                phone: chatId.replace(/\D/g, '').replace(/@.*$/, ''),
                body: body,
                media_url: mediaUrl || null,
                media_type: mediaType || null,
                scheduled_time: scheduledTime,
                status: 'pending',
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async createScheduledStatus({ userId, content, mediaUrl, mediaType, scheduledTime }) {
        if (!this.supabase) throw new Error('Supabase not configured');

        const { data, error } = await this.supabase
            .from('scheduled_statuses')
            .insert({
                user_id: userId || 'default-user',
                content: content,
                media_url: mediaUrl || null,
                media_type: mediaType || null,
                scheduled_time: scheduledTime,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async listScheduledMessages(userId) {
        if (!this.supabase) throw new Error('Supabase not configured');

        const { data, error } = await this.supabase
            .from('scheduled_messages')
            .select('*')
            .eq('user_id', userId || 'default-user')
            .order('scheduled_time', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async listScheduledStatuses(userId) {
        if (!this.supabase) throw new Error('Supabase not configured');

        const { data, error } = await this.supabase
            .from('scheduled_statuses')
            .select('*')
            .eq('user_id', userId || 'default-user')
            .order('scheduled_time', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async deleteScheduledMessage(id, userId) {
        if (!this.supabase) throw new Error('Supabase not configured');

        const { error } = await this.supabase
            .from('scheduled_messages')
            .delete()
            .eq('id', id)
            .eq('user_id', userId || 'default-user');

        if (error) throw error;
        return true;
    }

    async deleteScheduledStatus(id, userId) {
        if (!this.supabase) throw new Error('Supabase not configured');

        const { error } = await this.supabase
            .from('scheduled_statuses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId || 'default-user');

        if (error) throw error;
        return true;
    }
}

export const schedulerService = new SchedulerService();
