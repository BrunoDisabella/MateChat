require('dotenv').config();

const whatsappConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0',
  appId: process.env.WHATSAPP_APP_ID,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  clientToken: process.env.WHATSAPP_CLIENT_TOKEN,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  
  // Verificar que las credenciales estén configuradas
  validateConfig() {
    if (!this.appId || !this.accessToken) {
      throw new Error('Las credenciales básicas de WhatsApp Business API no están configuradas correctamente en el archivo .env');
    }
    return true;
  }
};

module.exports = whatsappConfig;