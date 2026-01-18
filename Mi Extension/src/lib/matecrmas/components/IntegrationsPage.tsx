
import React, { useState, useEffect, useCallback } from 'react';
import { CogIcon, ErrorIcon } from './icons.tsx';
import { Logger } from '../lib/logger.ts';
import { MercadoLibreSettings } from './MercadoLibreSettings.tsx';
import { getBackendUrl } from '../lib/settings.ts';

// Acceso seguro a variables de entorno: si import.meta.env no existe, usamos un objeto vacío.
const env = (import.meta as any).env || {};
const MERCADOLIBRE_APP_ID = env.VITE_MERCADOLIBRE_APP_ID || '6671634517136690';

// --- Funciones de Ayuda para PKCE (Proof Key for Code Exchange) ---
function generateCodeVerifier(): string {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    return btoa(String.fromCharCode(...randomBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/\=/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/\=/g, '');
}


export const IntegrationsPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const backendUrl = getBackendUrl();
            // Si es localhost, intentamos, pero si falla no mostramos error crítico
            const statusUrl = `${backendUrl.replace(/\/$/, '')}/api/mercadolibre/auth/status`;
            
            const response = await fetch(statusUrl);
            if (!response.ok) {
                throw new Error(`Estado HTTP ${response.status}`);
            }
            const data = await response.json();

            if (data.authenticated) {
                Logger.info("✅ Conexión con Mercado Libre verificada.");
                sessionStorage.setItem('ML_CONNECTED_STATUS', 'true');
                setIsConnected(true);
            } else {
                sessionStorage.removeItem('ML_CONNECTED_STATUS');
                setIsConnected(false);
            }
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            // SILENCIAMOS EL ERROR VISUAL:
            // En lugar de mostrar una alerta roja, simplemente logueamos el warning
            // y mostramos la pantalla de "Conectar" por defecto.
            Logger.warn("⚠️ Verificación de estado omitida (Backend no disponible o error de red).", { error: err.message });
            sessionStorage.removeItem('ML_CONNECTED_STATUS');
            setIsConnected(false);
            setError(null); 
        } finally {
            setIsLoading(false);
        }
    };

    checkStatus();
  }, []);


  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      const redirectUri = `https://crm.losgurises.com.uy/`;

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: MERCADOLIBRE_APP_ID,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: verifier
      });
      
      const authUrl = `https://auth.mercadolibre.com/authorization?${params.toString()}`;
      
      Logger.log("Redirigiendo a Mercado Libre para autorización...", { authUrl, redirectUri });
      window.location.href = authUrl;

    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(`No se pudo iniciar la autenticación: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    Logger.log("Desconectando de Mercado Libre...");
    sessionStorage.removeItem('ML_CONNECTED_STATUS');
    setIsConnected(false);
    Logger.info("Desconexión completada.");
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <CogIcon className="w-12 h-12 text-gray-400 animate-spin" />
            <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
                Cargando integraciones...
            </p>
        </div>
    );
  }

  if (isConnected) {
    return <MercadoLibreSettings onDisconnect={handleDisconnect} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CogIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Integraciones</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        {error && (
            <div className="mb-4 flex items-center gap-3 p-3 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                <ErrorIcon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
            </div>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mercado Libre</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Sincroniza tus productos, precios y gestiona tus ventas directamente.
                </p>
            </div>
            <button
                onClick={handleConnect}
                className="mt-4 sm:mt-0 flex-shrink-0 text-white bg-yellow-500 hover:bg-yellow-600 focus:ring-4 focus:ring-yellow-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-yellow-400 dark:hover:bg-yellow-500 focus:outline-none dark:focus:ring-yellow-600 no-underline"
            >
                Conectar con Mercado Libre
            </button>
        </div>
      </div>
    </div>
  );
};
