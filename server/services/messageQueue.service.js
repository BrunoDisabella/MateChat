/**
 * Message Queue Service
 * Procesa mensajes de WhatsApp de forma secuencial por usuario
 * para evitar saturar Puppeteer con operaciones paralelas
 */

class MessageQueueService {
    constructor() {
        // Una cola por cada userId para permitir paralelismo entre usuarios
        // pero serializar operaciones del mismo usuario
        this.userQueues = new Map(); // userId -> { queue: [], processing: boolean }
        this.concurrencyPerUser = 1; // Solo 1 mensaje a la vez por usuario
        this.globalConcurrency = 3; // Máximo 3 usuarios procesando simultáneamente
        this.activeUsers = 0;
    }

    /**
     * Encola un trabajo de envío de mensaje
     * @param {string} userId - ID del usuario
     * @param {Function} job - Función async que ejecuta el envío
     * @returns {Promise} - Se resuelve cuando el trabajo se completa (o rechaza en error)
     */
    enqueue(userId, job) {
        return new Promise((resolve, reject) => {
            // Inicializar cola del usuario si no existe
            if (!this.userQueues.has(userId)) {
                this.userQueues.set(userId, {
                    queue: [],
                    processing: false
                });
            }

            const userQueue = this.userQueues.get(userId);

            // Agregar trabajo a la cola
            userQueue.queue.push({
                job,
                resolve,
                reject,
                addedAt: Date.now()
            });

            console.log(`[Queue] Job added for ${userId}. Queue length: ${userQueue.queue.length}`);

            // Intentar procesar
            this._processQueue(userId);
        });
    }

    async _processQueue(userId) {
        const userQueue = this.userQueues.get(userId);
        if (!userQueue) return;

        // Si ya estamos procesando para este usuario, salir
        if (userQueue.processing) {
            return;
        }

        // Si la cola está vacía, limpiar y salir
        if (userQueue.queue.length === 0) {
            this.userQueues.delete(userId);
            return;
        }

        // Verificar límite global de concurrencia
        if (this.activeUsers >= this.globalConcurrency) {
            // Reintentar después
            setTimeout(() => this._processQueue(userId), 200);
            return;
        }

        // Marcar como procesando
        userQueue.processing = true;
        this.activeUsers++;

        while (userQueue.queue.length > 0) {
            const { job, resolve, reject, addedAt } = userQueue.queue.shift();
            const waitTime = Date.now() - addedAt;

            console.log(`[Queue] Processing job for ${userId}. Wait time: ${waitTime}ms. Remaining: ${userQueue.queue.length}`);

            try {
                const result = await job();
                resolve(result);
            } catch (error) {
                console.error(`[Queue] Job failed for ${userId}:`, error.message);
                reject(error);
            }

            // Pequeña pausa entre mensajes del mismo usuario para no saturar
            if (userQueue.queue.length > 0) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // Terminar procesamiento
        userQueue.processing = false;
        this.activeUsers--;

        // Limpiar cola vacía
        if (userQueue.queue.length === 0) {
            this.userQueues.delete(userId);
        }

        console.log(`[Queue] Queue empty for ${userId}. Active users: ${this.activeUsers}`);
    }

    /**
     * Obtener estadísticas de la cola
     */
    getStats() {
        const stats = {
            activeUsers: this.activeUsers,
            queues: {}
        };

        for (const [userId, data] of this.userQueues) {
            stats.queues[userId] = {
                queueLength: data.queue.length,
                processing: data.processing
            };
        }

        return stats;
    }
}

export const messageQueue = new MessageQueueService();
