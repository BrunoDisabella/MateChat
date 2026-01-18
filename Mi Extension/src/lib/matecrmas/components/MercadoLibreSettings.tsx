
import React, { useState, useEffect, useCallback } from 'react';
import { ReceiptIcon, MessageIcon, PriceTagIcon } from './icons.tsx';
import { getBackendUrl, setBackendUrl } from '../lib/settings.ts';
import { Logger, instrumentedFetch, HttpError } from '../lib/logger.ts';

interface MercadoLibreSettingsProps {
  onDisconnect: () => void;
}

const CheckCircleIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SyncIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-3.181-3.183l-3.181-3.183a8.25 8.25 0 00-11.664 0l-3.181 3.183" />
    </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

const PermissionRow: React.FC<{ title: string; description: string; access: string; }> = ({ title, description, access }) => (
    <div className="flex justify-between items-center py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 flex-shrink-0 ml-4 font-medium">
            <span>{access}</span>
        </div>
    </div>
);

const TopicRow: React.FC<{ title: string; icon: React.FC<{className?: string}> }> = ({ title, icon: Icon }) => (
    <div className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-800 dark:text-gray-200">{title}</span>
        </div>
         <span className="text-sm font-medium text-green-600 dark:text-green-400">Suscrito</span>
    </div>
);

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

export const MercadoLibreSettings: React.FC<MercadoLibreSettingsProps> = ({ onDisconnect }) => {
    const [backendUrlInput, setBackendUrlInput] = useState('');
    const [saved, setSaved] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        setBackendUrlInput(getBackendUrl());
    }, []);

    const handleSave = () => {
        setBackendUrl(backendUrlInput);
        Logger.info('URL del backend guardada:', { backendUrl: backendUrlInput });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleSyncSales = useCallback(async () => {
        const url = getBackendUrl();
        if (!url) {
            Logger.error("No se puede sincronizar: la URL del backend no está configurada.");
            setSyncStatus('error');
            setSyncResult("La URL del backend no está configurada.");
            return;
        }

        setSyncStatus('loading');
        setSyncResult(null);

        try {
            const normalizedUrl = url.replace(/\/$/, '');
            const syncUrl = `${normalizedUrl}/api/mercadolibre/sales`;
            
            const data = await instrumentedFetch(syncUrl);
            
            setSyncStatus('success');
            const resultMessage = data.message || `Sincronizadas ${data.salesSynced || 0} ventas.`;
            setSyncResult(resultMessage);
            Logger.info('Sincronización manual de ventas completada.', data);
            setTimeout(() => {
                setSyncStatus('idle');
                setSyncResult(null);
            }, 5000);

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            setSyncStatus('error');
            setSyncResult(`Falló la sincronización. Revisa la consola (Ctrl+0) para más detalles. Error: ${err.message}`);
        }

    }, []);

    const getStatusIndicator = () => {
        switch (syncStatus) {
            case 'loading':
                return <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><SyncIcon className="w-4 h-4 animate-spin" /> Sincronizando...</div>;
            case 'success':
                return <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"><CheckCircleIcon className="w-4 h-4" /> {syncResult || '¡Sincronización exitosa!'}</div>;
            case 'error':
                return (
                    <div className="flex flex-col items-start gap-1 text-sm text-red-500 dark:text-red-400">
                        <div className="flex items-center gap-2">
                           <ErrorIcon className="w-4 h-4" />
                           <span>Error en la sincronización</span>
                        </div>
                         <p className="text-xs ml-6 text-gray-500 dark:text-gray-400">{syncResult}</p>
                    </div>
                );
            case 'idle':
            default:
                return <div className="text-sm text-gray-500 dark:text-gray-400">Listo para sincronizar.</div>;
        }
    };


    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-4xl mx-auto animate-fade-in-up space-y-8">
            <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <CheckCircleIcon className="w-8 h-8 text-green-500" />
                            Conexión con Mercado Libre Activa
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tu CRM ahora está autorizado para interactuar con Mercado Libre.</p>
                    </div>
                    <button 
                        onClick={onDisconnect}
                        className="mt-4 sm:mt-0 py-2 px-4 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800 flex-shrink-0"
                    >
                        Desconectar
                    </button>
                </div>
            </div>

            <div className="mt-6">
                 <h3 className="text-gray-600 dark:text-gray-300 font-semibold text-lg">Configuración del Servidor Backend</h3>
                 <div className="mt-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Este es el servidor que se comunica de forma segura con Mercado Libre para obtener tus datos. La aplicación necesita esta dirección para funcionar.
                    </p>
                    <div className="flex flex-col sm:flex-row items-end gap-2">
                        <div className="w-full">
                             <label htmlFor="backend-url" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">URL del Servidor</label>
                             <input
                                type="url"
                                id="backend-url"
                                value={backendUrlInput}
                                onChange={(e) => setBackendUrlInput(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                placeholder="https://tu-servidor-backend.com"
                             />
                             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Ingresa la URL base de tu servidor, ej: https://crm.losgurises.com.uy. La aplicación agregará las rutas de la API automáticamente.
                             </p>
                        </div>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex-shrink-0 ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {saved ? '¡Guardado!' : 'Guardar'}
                        </button>
                    </div>
                 </div>
            </div>

             <div className="mt-6">
                 <h3 className="text-gray-600 dark:text-gray-300 font-semibold text-lg">Sincronización de Datos</h3>
                 <div className="mt-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                       Usa este botón para traer las últimas ventas de Mercado Libre. La primera vez puede tardar. Las siguientes serán mucho más rápidas.
                    </p>
                     <div className="flex flex-col sm:flex-row items-center gap-4">
                        <button
                            onClick={handleSyncSales}
                            disabled={syncStatus === 'loading'}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-wait"
                        >
                            <SyncIcon className={`w-5 h-5 ${syncStatus === 'loading' ? 'animate-spin' : ''}`} />
                            Sincronizar Ventas
                        </button>
                        <div className="flex-grow h-px bg-gray-200 dark:bg-gray-600 sm:block hidden"></div>
                        <div className="min-w-[200px] text-center sm:text-left">
                            {getStatusIndicator()}
                        </div>
                     </div>
                 </div>
            </div>
            
            <div className="mt-6">
                <h3 className="text-gray-600 dark:text-gray-300 font-semibold text-lg">Resumen de Permisos Otorgados</h3>
                <div className="mt-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Permisos de la Aplicación</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Estos son los permisos que has concedido a la aplicación. Determinan a qué datos puede acceder y qué acciones puede realizar en tu cuenta de Mercado Libre.</p>
                        <div className="mt-4">
                            <PermissionRow title="Leer tu información básica" description="Consultar los datos de tu perfil de usuario." access="Concedido" />
                            <PermissionRow title="Leer tus publicaciones" description="Acceder a la información de tus productos publicados." access="Concedido" />
                            <PermissionRow title="Modificar tus publicaciones" description="Crear, actualizar y eliminar publicaciones." access="Concedido" />
                             <PermissionRow title="Gestionar tus ventas" description="Leer la información de tus órdenes y ventas." access="Concedido" />
                        </div>
                    </div>

                    <div className="mt-8">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Notificaciones (Webhooks)</h4>
                         <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">La aplicación recibirá notificaciones en tiempo real sobre los siguientes eventos:</p>
                        <div className="mt-4 space-y-3">
                            <TopicRow title="Nuevas Ventas (Orders)" icon={ReceiptIcon} />
                            <TopicRow title="Nuevos Mensajes (Messages)" icon={MessageIcon} />
                            <TopicRow title="Cambios de Precio (Prices)" icon={PriceTagIcon} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
