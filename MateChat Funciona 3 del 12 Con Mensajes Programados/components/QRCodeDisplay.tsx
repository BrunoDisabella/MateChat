import React, { useState } from 'react';
import { LogOut, RefreshCw, Trash2, Loader2 } from 'lucide-react';

interface Props {
  qrCode: string | null;
  error: string | null;
  onLogout: () => void;
  onResetConnection: () => void;
}

export const QRCodeDisplay: React.FC<Props> = ({ qrCode, error, onLogout, onResetConnection }) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    console.log('Botón eliminar conexión presionado');
    if (window.confirm('¿Estás seguro? Esto eliminará la sesión actual de WhatsApp en el servidor y generará un nuevo código QR.')) {
        console.log('Confirmación aceptada, ejecutando reset...');
        setIsResetting(true);
        onResetConnection();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-[#f0f2f5] p-6 text-center h-full animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-4xl w-full flex flex-col md:flex-row gap-8 items-center">
        
        {/* Columna Izquierda: Instrucciones */}
        <div className="flex-1 text-left">
            <h2 className="text-2xl font-light text-[#41525d] mb-6">Usa WhatsApp en MateChat</h2>
            
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
                    {error}
                </div>
            )}

            <ol className="list-decimal pl-5 space-y-4 text-[16px] text-[#3b4a54] leading-relaxed">
              <li>Abre WhatsApp en tu teléfono.</li>
              <li>Toca <strong>Menú</strong> en Android o <strong>Configuración</strong> en iPhone.</li>
              <li>Toca <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
              <li>Apunta tu teléfono a la pantalla para capturar el código.</li>
            </ol>
            
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
                <button 
                    onClick={handleReset}
                    disabled={isResetting}
                    className="flex items-center gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded transition-colors w-fit text-sm font-medium disabled:opacity-50"
                >
                    {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {isResetting ? 'Eliminando sesión...' : 'Eliminar conexión con WhatsApp'}
                </button>
                
                <button 
                    onClick={onLogout}
                    className="flex items-center gap-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-4 py-2 rounded transition-colors w-fit text-sm font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión de la cuenta
                </button>
            </div>
        </div>

        {/* Columna Derecha: QR */}
        <div className="flex-shrink-0">
            {qrCode && !isResetting ? (
               <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 relative group">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm rounded-lg">
                      <p className="text-[#00a884] font-medium text-sm">Escanéame</p>
                  </div>
               </div>
            ) : (
              <div className="w-64 h-64 bg-gray-50 rounded-lg flex flex-col items-center justify-center border border-gray-200 relative overflow-hidden">
                {isResetting ? (
                    <>
                        <RefreshCw className="w-8 h-8 text-[#00a884] animate-spin mb-3" />
                        <span className="text-sm text-gray-500">Reiniciando sesión...</span>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#00a884] rounded-full animate-spin mb-4"></div>
                        <span className="text-sm text-gray-400">Generando código QR...</span>
                    </>
                )}
              </div>
            )}
        </div>

      </div>
    </div>
  );
};