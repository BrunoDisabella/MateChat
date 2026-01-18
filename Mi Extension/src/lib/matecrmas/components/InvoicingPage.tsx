
import React, { useState, useMemo } from 'react';
import { Sale } from '../types.ts';
import { CheckCircleIcon, SyncIcon, ArrowUpIcon, SearchIcon, ReceiptIcon, CurrencyDollarIcon, XIcon, CogIcon, ErrorIcon } from './icons.tsx';
import { getBackendUrl } from '../lib/settings.ts';
import { Logger, instrumentedFetch } from '../lib/logger.ts';
import { toast } from 'sonner';

interface InvoicingPageProps {
  sales: Sale[];
  onSaleInvoiced: () => void;
}

export const InvoicingPage: React.FC<InvoicingPageProps> = ({ sales, onSaleInvoiced }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [billerApiKey, setBillerApiKey] = useState(() => localStorage.getItem('BILLER_API_KEY') || '');
  const [billerSucursalId, setBillerSucursalId] = useState(() => localStorage.getItem('BILLER_SUCURSAL_ID') || '');
  const [showConfig, setShowConfig] = useState(!localStorage.getItem('BILLER_API_KEY'));

  const backendUrl = getBackendUrl();

  const filteredSales = useMemo(() => {
    let gurisesSales = sales.filter(s => s.salesChannel === 'Los Gurises');
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      gurisesSales = gurisesSales.filter(s => 
        s.items.some(i => i.name.toLowerCase().includes(term)) ||
        s.id.toLowerCase().includes(term)
      );
    }
    return gurisesSales;
  }, [sales, searchTerm]);

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billerApiKey.trim() || !billerSucursalId.trim()) {
        toast.error("Ingresa el Token y el ID de Sucursal.");
        return;
    }

    setIsVerifying(true);
    Logger.info(`Intentando conectar con Backend en: ${backendUrl}`);
    
    try {
        const verifyUrl = `${backendUrl.replace(/\/$/, '')}/api/billing/verify`;

        const data = await instrumentedFetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: billerApiKey.trim(),
                sucursalId: billerSucursalId.trim()
            })
        });

        if (data && data.success) {
            localStorage.setItem('BILLER_API_KEY', billerApiKey.trim());
            localStorage.setItem('BILLER_SUCURSAL_ID', billerSucursalId.trim());
            toast.success("¡Configuración Biller validada!");
            setShowConfig(false);
        }
    } catch (error: any) {
        let errorMsg = "Error de comunicación.";
        if (error.message === "Failed to fetch") {
            errorMsg = `No se pudo contactar con tu servidor (${backendUrl}). Verifica que el backend esté encendido.`;
        } else if (error.status) {
            errorMsg = `El servidor respondió con error ${error.status}. Revisa la consola.`;
        }
        toast.error(errorMsg, { duration: 6000 });
    } finally {
        setIsVerifying(false);
    }
  };

  const issueInvoice = async (sale: Sale) => {
    if (!billerApiKey || !billerSucursalId) {
        toast.error("Configura primero la API de Biller.");
        setShowConfig(true);
        return;
    }

    setIsProcessing(sale.id);
    const toastId = toast.loading(`Emitiendo comprobante para #${sale.id.slice(-6)}...`);

    try {
        const invoicingUrl = `${backendUrl.replace(/\/$/, '')}/api/billing/issue`;

        const result = await instrumentedFetch(invoicingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                saleId: sale.id,
                apiKey: billerApiKey,
                sucursalId: billerSucursalId,
                saleData: sale
            })
        });

        toast.success("Factura emitida correctamente.", { id: toastId });
        onSaleInvoiced(); 
    } catch (error: any) {
        toast.error("Error al emitir. Revisa la consola de errores (Ctrl+0).", { id: toastId });
    } finally {
        setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
             <ReceiptIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Facturación Local (Biller v2)</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest flex items-center gap-2">
                Conectado vía: <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-[10px]">{backendUrl}</span>
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className={`px-4 py-2 text-sm font-bold rounded-xl border transition-colors flex items-center gap-2 ${showConfig ? 'bg-gray-100 text-gray-600' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100'}`}
        >
          <CogIcon className="w-4 h-4" />
          {showConfig ? 'Cerrar Ajustes' : 'Ajustes de API'}
        </button>
      </div>

      {showConfig && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border-2 border-teal-500/20 animate-fade-in-up">
            <form onSubmit={handleVerifyAndSave} className="space-y-4 max-w-md">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-teal-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">Configuración de Producción Biller</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block mb-1 text-xs font-black text-gray-400 uppercase tracking-tighter">Bearer Token de Biller</label>
                        <input 
                            type="password" 
                            value={billerApiKey} 
                            onChange={e => setBillerApiKey(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                            placeholder="Copia el token desde el panel de Biller"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-xs font-black text-gray-400 uppercase tracking-tighter">ID Sucursal</label>
                        <input 
                            type="text" 
                            value={billerSucursalId} 
                            onChange={e => setBillerSucursalId(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-mono"
                            placeholder="Ej: 53"
                            required
                        />
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    disabled={isVerifying}
                    className="w-full bg-teal-600 text-white font-black py-3 rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isVerifying ? <SyncIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
                    VERIFICAR CONEXIÓN
                </button>
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                        <span className="font-bold text-teal-600 mr-1">Nota:</span> 
                        Esta aplicación envía los datos a tu servidor <b>{backendUrl}</b>, el cual se encarga de enviarlos de forma segura a <b>biller.uy</b> usando tu Token.
                    </p>
                </div>
            </form>
        </div>
      )}

      <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
          </div>
          <input
              type="text"
              className="bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm block w-full pl-12 p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="Buscar venta local de Los Gurises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado DGI</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Acción</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic">No hay ventas locales pendientes.</td>
                      </tr>
                  ) : filteredSales.map((sale) => {
                      const isInvoiced = sale.billingStatus === 'invoiced';
                      return (
                          <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-gray-900 dark:text-white">{new Date(sale.createdAt).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">#{sale.id.slice(-6)}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">
                                      {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-black text-gray-900 dark:text-white">${sale.total.toFixed(2)}</td>
                              <td className="px-6 py-4 text-center">
                                  {isInvoiced ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                          <CheckCircleIcon className="w-3 h-3" /> EMITIDO
                                      </span>
                                  ) : (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                          <SyncIcon className="w-3 h-3" /> SIN FACTURAR
                                      </span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  {isInvoiced ? (
                                      <a href={sale.invoiceUrl} target="_blank" className="inline-flex items-center gap-1 text-xs font-black text-teal-600 hover:text-teal-700 hover:underline">
                                          <ReceiptIcon className="w-4 h-4" /> VER PDF
                                      </a>
                                  ) : (
                                      <button 
                                          onClick={() => issueInvoice(sale)}
                                          disabled={!!isProcessing}
                                          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-[10px] font-black rounded-xl hover:bg-teal-700 shadow-md shadow-teal-600/10 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                      >
                                          {isProcessing === sale.id ? <SyncIcon className="w-3 h-3 animate-spin" /> : <CurrencyDollarIcon className="w-3 h-3" />}
                                          EMITIR E-TICKET
                                      </button>
                                  )}
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
      </div>
    </div>
  );
};
