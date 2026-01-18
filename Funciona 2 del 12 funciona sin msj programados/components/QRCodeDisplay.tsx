import React from 'react';

interface Props {
  qrCode: string | null;
  error: string | null;
}

// Adaptador para usar las props del componente padre (qrCode, error) 
// con el diseño visual solicitado (qrCodeUrl).
export const QRCodeDisplay: React.FC<Props> = ({ qrCode, error }) => {
  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-[#f0f2f5] p-6 text-center h-full">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-2xl w-full">
        <h2 className="text-2xl font-light text-[#41525d] mb-4">Inicia sesión en MateChat</h2>
        
        {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
                {error}
            </div>
        )}

        <div className="flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-left text-[18px] text-[#3b4a54] leading-8">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Abre WhatsApp en tu teléfono.</li>
              <li>Toca <strong>Menú</strong> en Android o <strong>Configuración</strong> en iPhone.</li>
              <li>Toca <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
              <li>Apunta tu teléfono a esta pantalla para escanear el código.</li>
            </ol>
            <div className="mt-8 text-[#00a884] hover:underline cursor-pointer text-sm font-medium">
              ¿Necesitas ayuda para comenzar?
            </div>
          </div>
          <div className="flex-shrink-0">
            {qrCode ? (
               <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
               </div>
            ) : (
              <div className="w-64 h-64 bg-gray-100 rounded-lg flex flex-col items-center justify-center animate-pulse text-gray-400 border border-gray-200">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-[#00a884] rounded-full animate-spin mb-3"></div>
                <span>Generando código QR...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};