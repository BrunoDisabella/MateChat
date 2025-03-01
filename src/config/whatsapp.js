require('dotenv').config();

const whatsappConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  
  // Verificar que las credenciales estén configuradas
  validateConfig() {
    if (!this.phoneNumberId || !this.businessAccountId || !this.accessToken) {
      throw new Error('Las credenciales de WhatsApp Business API no están configuradas correctamente en el archivo .env');
    }
    return true;
  }
};

module.exports = whatsappConfig;