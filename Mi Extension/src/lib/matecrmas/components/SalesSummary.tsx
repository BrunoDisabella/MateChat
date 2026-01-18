import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Sale, Expense, Product, SalesChannel, SaleItem, AdCostRecord, CashBoxTransaction, ProductFailure } from '../types.ts';
import { CurrencyDollarIcon, CalendarIcon, UploadIcon, ArchiveIcon, ErrorIcon, SyncIcon, CheckCircleIcon, BoxIcon, TruckIcon, AlertTriangleIcon } from './icons.tsx';
import { DateRangePicker } from './DateRangePicker.tsx';
import { ProductSalesTable } from './ProductSalesTable.tsx';
import { AdCostImportModal } from './AdCostImportModal.tsx';
import { Logger } from '../lib/logger.ts';
import { CashBoxSummary } from './CashBoxSummary.tsx';

type ImportedAdCost = {
    productId: string;
    totalAdCost: number;
    startDate: string;
    endDate: string;
};

interface SalesSummaryProps {
  sales: Sale[];
  isLoadingSales: boolean;
  salesError: string | null;
  expenses: Expense[];
  products: Product[];
  failures: ProductFailure[]; // Nueva prop
  adCostHistory: AdCostRecord[];
  onAdCostImport: (record: Omit<AdCostRecord, 'id' | 'created_at'>) => void;
  cashBoxBalance: number;
  cashBoxTransactions: CashBoxTransaction[];
  onAddIncome: () => void;
  onAddOutcome: () => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDateRangeChange: (start: Date, end: Date) => void;
}

const StatCard: React.FC<{ title: string; value: string; color: string; loading?: boolean; icon?: React.ReactNode }> = ({ title, value, color, loading, icon }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-col justify-between min-h-[100px] relative overflow-hidden">
        <div className="flex justify-between items-start z-10 relative">
             <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
             {icon && <div className="opacity-20 text-gray-500">{icon}</div>}
        </div>
        {loading ? (
             <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2"></div>
        ) : (
             <p className={`text-2xl font-bold ${color} mt-2 z-10 relative`}>{value}</p>
        )}
    </div>
);

const SalesChannelChart: React.FC<{ sales: Sale[], isLoading: boolean, error: string | null, deliveryRate: number }> = ({ sales, isLoading, error, deliveryRate }) => {
    const salesByChannel = useMemo(() => {
        // 1. Agrupar ventas totales brutas por canal
        const data = sales.reduce((acc: Record<string, number>, sale) => {
            const currentTotal = acc[sale.salesChannel] || 0;
            acc[sale.salesChannel] = currentTotal + Number(sale.total);
            return acc;
        }, {} as Record<string, number>);

        // 2. Aplicar la tasa de entrega para calcular el "Ingreso Real Estimado"
        return Object.entries(data)
            .map(([channel, total]) => {
                let adjustedTotal = Number(total);
                // Solo aplicamos la tasa a Correo Uruguayo
                if (channel === 'Correo Uruguayo') {
                    adjustedTotal = Number(total) * (Number(deliveryRate) / 100);
                }
                return { 
                    channel: channel as SalesChannel, 
                    total: adjustedTotal, 
                    originalTotal: Number(total) 
                };
            })
            .sort((a, b) => b.total - a.total); // Ordenar por el total ajustado (real)
    }, [sales, deliveryRate]);

    const maxSales = useMemo(() => Math.max(...salesByChannel.map(c => c.total), 0), [salesByChannel]);

    const channelColors: { [key in SalesChannel]: string } = {
      'Correo Uruguayo': 'bg-blue-500',
      'Matías': 'bg-purple-500',
      'Mercado Libre': 'bg-yellow-500',
      'Los Gurises': 'bg-orange-500',
    };

    if (isLoading) return <div className="p-8 flex justify-center"><SyncIcon className="w-8 h-8 animate-spin text-gray-400"/></div>;
    if (error) return <div className="p-4 text-red-500 text-center">Error cargando gráfico</div>;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ingresos Reales por Canal</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Ajustado por Tasa de Entrega
                </span>
            </div>
            
            <div className="w-full space-y-5">
                {salesByChannel.length === 0 ? <p className="text-gray-500">Sin datos para los filtros actuales</p> : salesByChannel.map(({ channel, total, originalTotal }) => (
                    <div key={channel}>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{channel}</span>
                            <div className="text-right">
                                <span className="block text-sm font-bold text-gray-900 dark:text-white font-mono">${total.toFixed(2)}</span>
                                {channel === 'Correo Uruguayo' && total < originalTotal && (
                                    <span className="text-xs text-gray-400 line-through">Bruto: ${originalTotal.toFixed(0)}</span>
                                )}
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div 
                                className={`${channelColors[channel] || 'bg-gray-500'} h-3 rounded-full transition-all duration-500 relative group`} 
                                style={{ width: `${maxSales > 0 ? (total / maxSales) * 100 : 0}%` }}
                            >
                                {/* Tooltip simple */}
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {((total / (salesByChannel.reduce((a, b) => a + b.total, 0) || 1)) * 100).toFixed(1)}% del total
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Utiles de fecha - Aseguran precisión de milisegundos
const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEndOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const getStartOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
};

const getDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
};

type PresetKey = 'last7' | 'last15' | 'thisMonth' | '30days' | 'year' | 'all';

const ALL_CHANNELS: SalesChannel[] = ['Correo Uruguayo', 'Matías', 'Mercado Libre', 'Los Gurises'];

export const SalesSummary: React.FC<SalesSummaryProps> = ({ 
    sales,
    isLoadingSales,
    salesError,
    expenses, 
    products, 
    failures,
    adCostHistory, 
    onAdCostImport,
    cashBoxBalance,
    cashBoxTransactions,
    onAddIncome,
    onAddOutcome,
    onDeleteTransaction,
    onDateRangeChange,
}) => {
    const [activePreset, setActivePreset] = useState<PresetKey | null>('thisMonth');
    
    // UI Date State
    const [startDate, setStartDate] = useState<Date>(getStartOfCurrentMonth());
    const [endDate, setEndDate] = useState<Date>(getEndOfDay(new Date()));
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    
    // Channel Filtering State (Multi-select)
    const [selectedChannels, setSelectedChannels] = useState<Set<SalesChannel>>(new Set(ALL_CHANNELS));

    // Estado para Tasa de Entrega con persistencia
    const [deliverySuccessRate, setDeliverySuccessRate] = useState(() => {
        const saved = localStorage.getItem('DELIVERY_SUCCESS_RATE');
        return saved ? parseFloat(saved) : 85;
    });

    const [adCosts, setAdCosts] = useState<{ [productId: string]: number }>({});
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Handlers de cambio de fecha con precisión horaria
    const handleSetDateRange = (start: Date, end: Date, preset: PresetKey) => {
        const preciseStart = getStartOfDay(start);
        const preciseEnd = getEndOfDay(end);
        
        setStartDate(preciseStart);
        setEndDate(preciseEnd);
        setActivePreset(preset);
        onDateRangeChange(preciseStart, preciseEnd); 
    };

    const handleApplyDates = (start: Date, end: Date) => {
        const preciseStart = getStartOfDay(start);
        const preciseEnd = getEndOfDay(end);
        
        setStartDate(preciseStart);
        setEndDate(preciseEnd);
        setIsPickerOpen(false);
        setActivePreset(null);
        onDateRangeChange(preciseStart, preciseEnd);
    };
    
    // Toggle Channel Logic
    const toggleChannel = (channel: SalesChannel) => {
        setSelectedChannels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(channel)) {
                // Prevenir desactivar el último canal (al menos uno debe estar activo para ver algo)
                if (newSet.size > 1) newSet.delete(channel);
            } else {
                newSet.add(channel);
            }
            return newSet;
        });
    };

    // Handler para guardar la tasa de entrega
    const handleDeliveryRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
            setDeliverySuccessRate(val);
            localStorage.setItem('DELIVERY_SUCCESS_RATE', val.toString());
        }
    };
    
    // Inicializar rango al montar
    useEffect(() => {
        onDateRangeChange(getStartOfCurrentMonth(), getEndOfDay(new Date()));
    }, []);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => selectedChannels.has(sale.salesChannel));
    }, [sales, selectedChannels]);

    // Cálculo del Valor Total del Inventario
    const inventoryValue = useMemo(() => {
        return products.reduce((total, product) => total + (product.cost * product.quantity), 0);
    }, [products]);

     const totalUnitsSoldPerProductAllChannels = useMemo(() => {
        const unitsMap = new Map<string, number>();
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const currentUnits = unitsMap.get(item.productId) || 0;
                unitsMap.set(item.productId, currentUnits + item.quantity);
            });
        });
        return unitsMap;
    }, [sales]);

    const productSalesSummary = useMemo(() => {
        const productDataMap = new Map();
        const successRate = deliverySuccessRate / 100;

        filteredSales.forEach(sale => {
            const discountFactor = Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 1;
            const channelSuccessFactor = sale.salesChannel === 'Correo Uruguayo' ? successRate : 1;

            sale.items.forEach(item => {
                if (!productDataMap.has(item.productId)) {
                    const productInfo = products.find(p => p.id === item.productId);
                    productDataMap.set(item.productId, {
                        productId: item.productId,
                        name: productInfo?.name || item.name,
                        sku: productInfo?.sku || item.sku,
                        imageUrl: productInfo?.imageUrl || '',
                        unitsSold: 0,
                        rawUnitsSold: 0,
                        totalRevenue: 0,
                        totalCost: 0,
                        adCost: 0,
                        profit: 0
                    });
                }
                const current = productDataMap.get(item.productId);
                current.unitsSold += (item.quantity * channelSuccessFactor);
                current.rawUnitsSold += item.quantity;
                current.totalRevenue += (item.unitPrice * item.quantity * discountFactor * channelSuccessFactor);
                current.totalCost += (item.unitCost * item.quantity * channelSuccessFactor);
            });
        });

        return Array.from(productDataMap.values()).map((data: any) => {
             const totalAdCostForProduct = adCosts[data.productId] || 0;
             let adCostForRow = 0;
             
             if (totalAdCostForProduct > 0) {
                 const totalRaw = totalUnitsSoldPerProductAllChannels.get(data.productId) || 1;
                 const ratio = Number(data.rawUnitsSold) / Number(totalRaw); 
                 adCostForRow = totalAdCostForProduct * ratio;
             }
             
             data.adCost = adCostForRow;
             data.profit = (Number(data.totalRevenue) || 0) - (Number(data.totalCost) || 0) - adCostForRow;
             return data;
        }).sort((a: any, b: any) => b.profit - a.profit);
    }, [filteredSales, products, deliverySuccessRate, adCosts, totalUnitsSoldPerProductAllChannels]);

    const summary = useMemo(() => {
        // 1. Ingresos y Costo Mercadería (basado en productos)
        const totalRevenue = productSalesSummary.reduce((acc: number, p: any) => acc + (Number(p.totalRevenue) || 0), 0);
        const totalCostOfGoods = productSalesSummary.reduce((acc: number, p: any) => acc + (Number(p.totalCost) || 0), 0);
        const grossProfit = totalRevenue - totalCostOfGoods;
        
        // 2. Gastos Operativos (basado en rango de fecha)
        const totalOperationalExpenses = expenses
            .filter(e => {
                const eDate = new Date(e.createdAt).getTime();
                return eDate >= startDate.getTime() && eDate <= endDate.getTime();
            })
            .reduce((acc: number, e) => acc + (Number(e.amount) || 0), 0);
            
        // 3. Costo Publicidad (ya distribuido)
        const totalAdCost = productSalesSummary.reduce((acc: number, p: any) => acc + (Number(p.adCost) || 0), 0);

        // 4. Costo de Envíos
        const totalShippingCost = filteredSales.reduce((acc: number, sale) => acc + (Number(sale.shippingCost) || 0), 0);
        const totalShippingCount = filteredSales.reduce((acc: number, sale) => {
            if (sale.shippingMethod && sale.shippingMethod.trim() !== '') {
                return acc + (Number(sale.shippingQuantity) || 0);
            }
            return acc;
        }, 0);

        // 5. Costo de Fallas/Pérdidas (Nuevo)
        // Sumamos costo producto + costo envío perdido de las fallas en el rango de fecha
        const totalFailureCost = failures
            .filter(f => {
                const fDate = new Date(f.created_at).getTime();
                return fDate >= startDate.getTime() && fDate <= endDate.getTime();
            })
            .reduce((acc, f) => acc + (f.product_cost + f.shipping_cost), 0);

        // 6. Ganancia Neta
        // Restamos Costo de Envíos y Fallas también.
        const netProfit = Number(grossProfit) - Number(totalOperationalExpenses) - Number(totalAdCost) - Number(totalShippingCost) - Number(totalFailureCost);

        return { 
            totalRevenue, 
            totalCostOfGoods, 
            grossProfit, 
            totalOperationalExpenses, 
            totalAdCost, 
            totalShippingCost,
            totalShippingCount,
            totalFailureCost,
            netProfit 
        };
    }, [productSalesSummary, expenses, startDate, endDate, filteredSales, failures]);

    const baseBtnClasses = "px-3 py-1 text-xs font-medium border rounded-md transition-colors";
    const activeBtnClasses = "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700";
    const inactiveBtnClasses = "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600";
    
    // Channel Badge Classes
    const getChannelBadgeClass = (channel: SalesChannel) => {
        const isActive = selectedChannels.has(channel);
        const baseClass = "px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all select-none";
        
        if (!isActive) {
            return `${baseClass} bg-gray-100 text-gray-400 border-gray-200 opacity-60 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700`;
        }

        switch (channel) {
            case 'Correo Uruguayo':
                return `${baseClass} bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800`;
            case 'Matías':
                return `${baseClass} bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800`;
            case 'Mercado Libre':
                return `${baseClass} bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800`;
            case 'Los Gurises':
                return `${baseClass} bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800`;
            default:
                return baseClass;
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                 <div className="flex items-center gap-3">
                    <CurrencyDollarIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resumen Financiero</h2>
                    {isLoadingSales && <span className="text-xs text-blue-500 animate-pulse bg-blue-100 px-2 py-1 rounded-full">Cargando...</span>}
                 </div>
                 <button onClick={() => setIsImportModalOpen(true)} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md shadow-sm hover:bg-teal-700">
                    <UploadIcon className="w-5 h-5" />
                    <span>Importar Gastos</span>
                </button>
            </div>

            {salesError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-start gap-3" role="alert">
                    <ErrorIcon className="w-6 h-6 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong className="font-bold block">Error cargando ventas:</strong>
                        <span className="block sm:inline text-sm">{salesError}</span>
                    </div>
                </div>
            )}
            
            <CashBoxSummary balance={cashBoxBalance} transactions={cashBoxTransactions} onAddIncome={onAddIncome} onAddOutcome={onAddOutcome} onDeleteTransaction={onDeleteTransaction} />

             <div className="flex flex-col md:flex-row gap-6 my-6">
                {/* Filtro de Fechas */}
                <div className="flex-1">
                     <div className="flex items-center gap-2 mb-2">
                         <CalendarIcon className="w-4 h-4 text-gray-500" />
                         <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fecha:</span>
                     </div>
                     <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => handleSetDateRange(getDaysAgo(7), getEndOfDay(new Date()), 'last7')} className={`${baseBtnClasses} ${activePreset === 'last7' ? activeBtnClasses : inactiveBtnClasses}`}>7 Días</button>
                        <button onClick={() => handleSetDateRange(getDaysAgo(15), getEndOfDay(new Date()), 'last15')} className={`${baseBtnClasses} ${activePreset === 'last15' ? activeBtnClasses : inactiveBtnClasses}`}>15 Días</button>
                        <button onClick={() => handleSetDateRange(getStartOfCurrentMonth(), getEndOfDay(new Date()), 'thisMonth')} className={`${baseBtnClasses} ${activePreset === 'thisMonth' ? activeBtnClasses : inactiveBtnClasses}`}>Este Mes</button>
                        <button onClick={() => handleSetDateRange(getDaysAgo(30), getEndOfDay(new Date()), '30days')} className={`${baseBtnClasses} ${activePreset === '30days' ? activeBtnClasses : inactiveBtnClasses}`}>30 Días</button>
                        <button onClick={() => handleSetDateRange(new Date(new Date().getFullYear(), 0, 1), getEndOfDay(new Date()), 'year')} className={`${baseBtnClasses} ${activePreset === 'year' ? activeBtnClasses : inactiveBtnClasses}`}>Este Año</button>
                        <button onClick={() => handleSetDateRange(new Date(2020, 0, 1), getEndOfDay(new Date()), 'all')} className={`${baseBtnClasses} ${activePreset === 'all' ? activeBtnClasses : inactiveBtnClasses}`}>Histórico</button>
                        
                        <button 
                            onClick={() => setIsPickerOpen(true)}
                            className="flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ml-auto sm:ml-0"
                        >
                            <span>{activePreset === 'all' ? 'Histórico' : `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`}</span>
                        </button>
                    </div>
                </div>

                {/* Filtro de Canales */}
                <div className="flex-1">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Canales:</span>
                         <span className="text-xs text-gray-500">(Click para filtrar)</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {ALL_CHANNELS.map(channel => (
                            <button 
                                key={channel}
                                onClick={() => toggleChannel(channel)}
                                className={getChannelBadgeClass(channel)}
                            >
                                {channel}
                            </button>
                        ))}
                     </div>
                </div>

                {/* Configuración de Tasa de Entrega */}
                <div className="flex-none min-w-[150px]">
                     <div className="flex items-center gap-2 mb-2">
                         <TruckIcon className="w-4 h-4 text-gray-500" />
                         <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tasa Entrega:</span>
                     </div>
                     <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={deliverySuccessRate}
                            onChange={handleDeliveryRateChange}
                            className="block w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                        </div>
                     </div>
                     <p className="text-[10px] text-gray-500 mt-1 dark:text-gray-400">Aplica a Correo Uruguayo</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard title="Ingresos" value={`$${summary.totalRevenue.toFixed(2)}`} color="text-green-500" loading={isLoadingSales} />
                <StatCard title="Costo Mercadería" value={`$${summary.totalCostOfGoods.toFixed(2)}`} color="text-red-500" loading={isLoadingSales} />
                <StatCard title="Ganancia Bruta" value={`$${summary.grossProfit.toFixed(2)}`} color="text-sky-500" loading={isLoadingSales} />
                <StatCard title="Costo Publicidad" value={`$${summary.totalAdCost.toFixed(2)}`} color="text-purple-500" loading={isLoadingSales} />
                
                {/* Nuevas Tarjetas */}
                <StatCard title="Costo Envíos" value={`$${summary.totalShippingCost.toFixed(2)}`} color="text-blue-500" loading={isLoadingSales} icon={<TruckIcon className="w-6 h-6 text-blue-300"/>} />
                <StatCard title="Costo por Fallas" value={`$${summary.totalFailureCost.toFixed(2)}`} color="text-red-600" loading={isLoadingSales} icon={<AlertTriangleIcon className="w-6 h-6 text-red-300"/>} />

                <StatCard title="Gastos Ops" value={`$${summary.totalOperationalExpenses.toFixed(2)}`} color="text-orange-500" loading={isLoadingSales} />
                <StatCard title="Ganancia Neta" value={`$${summary.netProfit.toFixed(2)}`} color={summary.netProfit >= 0 ? "text-emerald-500" : "text-red-500"} loading={isLoadingSales} />
            </div>

            {/* Tarjeta de Valor de Inventario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                 <StatCard 
                    title="Valor Inventario Actual" 
                    value={`$${inventoryValue.toFixed(2)}`} 
                    color="text-indigo-600 dark:text-indigo-400" 
                    icon={<BoxIcon className="w-8 h-8" />}
                 />
                 <StatCard 
                    title="Envíos Realizados" 
                    value={`${summary.totalShippingCount}`} 
                    color="text-blue-600 dark:text-blue-400" 
                    icon={<TruckIcon className="w-8 h-8" />}
                 />
            </div>

            <SalesChannelChart sales={filteredSales} isLoading={isLoadingSales} error={salesError} deliveryRate={deliverySuccessRate} />
            
            <ProductSalesTable 
                data={productSalesSummary}
                adCosts={adCosts}
                onAdCostChange={(pid, cost) => setAdCosts(prev => ({...prev, [pid]: cost}))}
                adCostInputEnabled={selectedChannels.size === ALL_CHANNELS.length} // Solo editable si vemos todo
                adCostHistory={adCostHistory}
            />

            <DateRangePicker 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                initialStartDate={startDate}
                initialEndDate={endDate}
                onApply={handleApplyDates}
            />
            
            <AdCostImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={async (costs) => { await handleImportAdCosts(costs) }} products={products} />
        </div>
    );

    async function handleImportAdCosts(importedCosts: ImportedAdCost[]) {
        for (const imported of importedCosts) {
             const newRecord = {
                    product_id: imported.productId,
                    total_ad_cost: imported.totalAdCost,
                    total_units_sold: 0,
                    cost_per_sale: 0,
                    start_date: imported.startDate,
                    end_date: imported.endDate,
             };
             await onAdCostImport(newRecord);
        }
        setAdCosts(prev => {
            const n = {...prev};
            importedCosts.forEach(c => n[c.productId] = (n[c.productId]||0) + c.totalAdCost);
            return n;
        });
        setIsImportModalOpen(false);
    }
};