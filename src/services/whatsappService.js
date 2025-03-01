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
  }

  initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
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
          '--disable-gpu'
        ]
      }
    });

    this.client.on('qr', (qr) => {
      this.qrCode = qr;
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          console.error('Error generating QR code:', err);
          return;
        }
        this.io.emit('qrCode', url);
        console.log('QR code generated');
      });
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.io.emit('whatsappStatus', { status: 'connected' });
      console.log('WhatsApp client is ready!');
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.io.emit('whatsappStatus', { status: 'disconnected' });
      console.log('WhatsApp client disconnected');
    });

    this.client.on('message', async (message) => {
      // Ignore messages sent by the current user
      if (message.fromMe) return;

      try {
        // Save message to database
        const newMessage = new Message({
          messageId: message.id._serialized,
          phoneNumber: message.from,
          content: message.body,
          timestamp: new Date(),
          responseStatus: 'Pending'
        });
        
        await newMessage.save();
        console.log('Message saved to database:', newMessage);
        
        // Emit the message to connected clients
        this.io.emit('newMessage', {
          id: newMessage._id,
          messageId: newMessage.messageId,
          phoneNumber: newMessage.phoneNumber,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          responseStatus: newMessage.responseStatus
        });

        // Forward message to N8N webhook
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            messageId: newMessage.messageId,
            phoneNumber: newMessage.phoneNumber,
            content: newMessage.content,
            timestamp: newMessage.timestamp
          });
          console.log('Message forwarded to N8N');
        } catch (error) {
          console.error('Error forwarding message to N8N:', error);
        }
      } catch (error) {
        console.error('Error processing incoming message:', error);
      }
    });

    this.client.initialize();
  }

  async sendMessage(to, content) {
    if (!this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      // Format the number to ensure it's in the correct format
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      // Send the message
      const response = await this.client.sendMessage(formattedNumber, content);
      
      // Update the message status in the database
      if (response) {
        await Message.findOneAndUpdate(
          { phoneNumber: formattedNumber, responseStatus: 'Pending' },
          { responseStatus: 'Responded' },
          { sort: { timestamp: -1 } }
        );
      }
      
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
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