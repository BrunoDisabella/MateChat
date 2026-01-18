
// lib/settings.ts
import { DEVELOPMENT_BACKEND_URL, PRODUCTION_BACKEND_URL } from '../config.ts';

const BACKEND_URL_KEY = 'MATECRM_BACKEND_URL';

/**
 * Obtiene la URL del backend detectando el entorno actual.
 */
export const getBackendUrl = (): string => {
    try {
        const storedUrl = localStorage.getItem(BACKEND_URL_KEY);
        if (storedUrl) return storedUrl;

        // DETECCIÓN AUTOMÁTICA:
        // Si no hay URL guardada, verificamos dónde estamos parados.
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return DEVELOPMENT_BACKEND_URL; // http://localhost:3002
        }
        
        // Si estamos en el dominio de producción, usamos la URL de producción por defecto.
        if (hostname.includes('losgurises.com.uy')) {
            return PRODUCTION_BACKEND_URL; // https://crm.losgurises.com.uy
        }

        return DEVELOPMENT_BACKEND_URL;
    } catch (error) {
        return DEVELOPMENT_BACKEND_URL;
    }
};

/**
 * Guarda la URL del backend en el almacenamiento local.
 */
export const setBackendUrl = (url: string): void => {
    try {
        if (url && url.trim()) {
            localStorage.setItem(BACKEND_URL_KEY, url.trim());
        } else {
            localStorage.removeItem(BACKEND_URL_KEY);
        }
    } catch (error) {
        console.error("No se pudo guardar en localStorage.");
    }
};
