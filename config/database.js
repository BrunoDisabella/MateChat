const mongoose = require('mongoose');
require('dotenv').config();

// Función para conectar a MongoDB o usar una memoria local si no hay URI
const connectDB = async () => {
  try {
    // Si no hay URI de MongoDB, usar una base de datos en memoria para desarrollo
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://brunodisabella:VS0IXOXufR1ZGVOn@cluster0.mongodb.net/matechat';
    
    console.log(`Intentando conectar a MongoDB con URI: ${mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@')}`); // Ocultar credenciales en logs
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log(`MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error de conexión a MongoDB: ${error.message}`);
    console.error('Detalles completos del error:', error);
    
    // En lugar de cerrar la aplicación, intentamos continuar sin base de datos
    console.warn('Continuando sin conexión a MongoDB. La funcionalidad será limitada.');
  }
};

module.exports = connectDB;