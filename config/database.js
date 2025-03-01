// Modo sin base de datos
const connectDB = async () => {
  console.log('Ejecutando en modo sin base de datos. Los mensajes se almacenarán solo en memoria.');
  return Promise.resolve();
};

module.exports = connectDB;