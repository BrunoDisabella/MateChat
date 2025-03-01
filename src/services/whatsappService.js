const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const Message = require('../models/Message');
const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.qrCode = null;
    this.isConnected = false;
    this.messageMemory = []; // Para almacenar mensajes en memoria si MongoDB no está disponible
  }

  initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote', 
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-features=site-per-process'
        ]
      }
    });

    this.client.on('qr', (qr) => {
      console.log('Código QR generado. Listo para escanear.');
      this.qrCode = qr;
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          console.error('Error al generar código QR:', err);
          return;
        }
        this.io.emit('qrCode', url);
        console.log('Código QR generado y enviado al cliente');
      });
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.io.emit('whatsappStatus', { status: 'connected' });
      console.log('¡Cliente de WhatsApp listo!');
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.io.emit('whatsappStatus', { status: 'disconnected' });
      console.log('Cliente de WhatsApp desconectado');
    });

    this.client.on('message', async (message) => {
      // Ignorar mensajes enviados por el usuario actual
      if (message.fromMe) return;

      try {
        // Crear objeto de mensaje
        const newMessage = {
          messageId: message.id._serialized,
          phoneNumber: message.from,
          content: message.body,
          timestamp: new Date(),
          responseStatus: 'Pending'
        };
        
        // Intentar guardar en MongoDB, si falla almacenar en memoria
        try {
          const dbMessage = new Message(newMessage);
          await dbMessage.save();
          console.log('Mensaje guardado en MongoDB:', newMessage);
        } catch (dbError) {
          console.warn('No se pudo guardar en MongoDB, guardando en memoria:', dbError.message);
          this.messageMemory.push(newMessage);
        }
        
        // Emitir mensaje a los clientes conectados
        this.io.emit('newMessage', {
          id: newMessage.messageId,
          messageId: newMessage.messageId,
          phoneNumber: newMessage.phoneNumber,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          responseStatus: newMessage.responseStatus
        });

        // Enviar mensaje al webhook de N8N
        if (process.env.N8N_WEBHOOK_URL) {
          try {
            await axios.post(process.env.N8N_WEBHOOK_URL, {
              messageId: newMessage.messageId,
              phoneNumber: newMessage.phoneNumber,
              content: newMessage.content,
              timestamp: newMessage.timestamp
            });
            console.log('Mensaje enviado a N8N');
          } catch (error) {
            console.error('Error al enviar mensaje a N8N:', error.message);
          }
        } else {
          console.log('No hay URL de webhook de N8N configurada');
        }
      } catch (error) {
        console.error('Error al procesar mensaje entrante:', error);
      }
    });

    console.log('Inicializando cliente WhatsApp...');
    this.client.initialize().catch(err => {
      console.error('Error al inicializar WhatsApp client:', err);
    });
  }

  async sendMessage(to, content) {
    if (!this.isConnected) {
      throw new Error('El cliente de WhatsApp no está conectado');
    }

    try {
      // Formatear el número para asegurar que está en el formato correcto
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      // Enviar el mensaje
      const response = await this.client.sendMessage(formattedNumber, content);
      
      // Actualizar el estado del mensaje en la base de datos
      if (response) {
        try {
          await Message.findOneAndUpdate(
            { phoneNumber: formattedNumber, responseStatus: 'Pending' },
            { responseStatus: 'Responded' },
            { sort: { timestamp: -1 } }
          );
        } catch (error) {
          console.warn('No se pudo actualizar el mensaje en MongoDB, actualizando en memoria');
          // Actualizar en la memoria si MongoDB no está disponible
          const messageIndex = this.messageMemory.findIndex(
            m => m.phoneNumber === formattedNumber && m.responseStatus === 'Pending'
          );
          if (messageIndex !== -1) {
            this.messageMemory[messageIndex].responseStatus = 'Responded';
          }
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected
    };
  }
}

module.exports = WhatsAppService;