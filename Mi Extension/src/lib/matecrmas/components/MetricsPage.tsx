
import React, { useMemo, useState } from 'react';
import { Sale, Product, ProductFailure } from '../types.ts';
import { ShoppingCartIcon, ArchiveIcon, ChartBarIcon, ReceiptIcon, CalendarIcon, SyncIcon, ArrowUpIcon, ArrowDownIcon, AlertTriangleIcon, BoxIcon } from './icons.tsx';
import { DateRangePicker } from './DateRangePicker.tsx';

interface MetricsPageProps {
  sales: Sale[];
  expenses: any[];
  products: Product[];
  failures: ProductFailure[];
  onDateRangeChange: (start: Date, end: Date) => void;
  isLoading?: boolean;
}

type PresetKey = 'last7' | 'last30' | 'thisMonth' | 'thisYear';

export const MetricsPage: React.FC<MetricsPageProps> = ({ sales, products, failures, onDateRangeChange, isLoading }) => {
  
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey | null>('last30');
  
  const [uiStartDate, setUiStartDate] = useState<Date>(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
  });
  const [uiEndDate, setUiEndDate] = useState<Date>(new Date());

  const handleApplyDates = (start: Date, end: Date) => {
      setUiStartDate(start);
      setUiEndDate(end);
      setIsPickerOpen(false);
      setActivePreset(null);
      onDateRangeChange(start, end);
  };

  const setPreset = (key: PresetKey) => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      let start = new Date();
      if (key === 'last7') start.setDate(end.getDate() - 7);
      else if (key === 'last30') start.setDate(end.getDate() - 30);
      else if (key === 'thisMonth') start = new Date(end.getFullYear(), end.getMonth(), 1);
      else if (key === 'thisYear') start = new Date(end.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      setUiStartDate(start);
      setUiEndDate(end);
      setActivePreset(key);
      onDateRangeChange(start, end);
  };

  const stats = useMemo(() => {
    // 1. Definir Periodos (Actual vs Anterior)
    const currentStart = uiStartDate.getTime();
    const currentEnd = uiEndDate.getTime();
    const duration = currentEnd - currentStart;
    const prevStart = currentStart - duration;
    const prevEnd = currentStart;

    // Filtramos ventas por periodos
    const currentSales = sales.filter(s => {
        const d = new Date(s.createdAt).getTime();
        return d >= currentStart && d <= currentEnd;
    });

    const prevSales = sales.filter(s => {
        const d = new Date(s.createdAt).getTime();
        return d >= prevStart && d <= prevEnd;
    });

    const daysInRange = Math.max(Math.ceil(duration / (1000 * 60 * 60 * 24)), 1);

    // 2. Cálculos de KPIs con Comparativa
    const calcKPIs = (salesArr: Sale[]) => {
        const rev = salesArr.reduce((acc, s) => acc + Number(s.total), 0);
        const qty = salesArr.reduce((acc, s) => acc + s.items.reduce((ia, i) => ia + i.quantity, 0), 0);
        const orders = salesArr.length;
        const avg = orders > 0 ? rev / orders : 0;
        return { rev, qty, orders, avg };
    };

    const currentKPI = calcKPIs(currentSales);
    const prevKPI = calcKPIs(prevSales);

    const getDiff = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
    };

    // 3. Proyecciones por Producto
    const projectionData = products.map(product => {
        const unitsSold = currentSales.reduce((acc, sale) => {
            return acc + sale.items
                .filter(item => item.productId === product.id)
                .reduce((itemAcc, item) => itemAcc + item.quantity, 0);
        }, 0);

        const velocity = unitsSold / daysInRange;
        const currentStock = product.quantity;
        const daysRemaining = velocity > 0 ? currentStock / velocity : Infinity;
        const suggested30Days = velocity > 0 ? Math.max(0, (velocity * 30) - currentStock) : 0;

        return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            imageUrl: product.imageUrl,
            currentStock,
            unitsSold,
            velocity,
            daysRemaining,
            suggested30Days
        };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);

    // 4. Agrupación Mensual (Para el gráfico de barras de meses)
    const monthlySales = sales.reduce((acc: Record<string, number>, s) => {
        const date = new Date(s.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + Number(s.total);
        return acc;
    }, {});

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const trendMonths = Object.entries(monthlySales)
        .map(([key, total]) => {
            const [year, month] = key.split('-');
            return {
                label: `${monthNames[parseInt(month)-1]} ${year.slice(2)}`,
                total,
                key
            };
        })
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(-6); // Últimos 6 meses

    return {
        currentKPI,
        diffs: {
            revenue: getDiff(currentKPI.rev, prevKPI.rev),
            orders: getDiff(currentKPI.orders, prevKPI.orders),
            avg: getDiff(currentKPI.avg, prevKPI.avg),
            units: getDiff(currentKPI.qty, prevKPI.qty)
        },
        projectionData,
        trendMonths,
        atRiskCount: projectionData.filter(p => p.daysRemaining <= 7).length,
        daysInRange
    };
  }, [sales, products, uiStartDate, uiEndDate]);

  const maxMonthRevenue = Math.max(...stats.trendMonths.map(m => m.total), 1);

  return (
    <div className="space-y-8 animate-fade-in-up pb-10">
      
      {/* Header con Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <ChartBarIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Análisis Comparativo</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Comparando con el periodo anterior de {stats.daysInRange} días</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mr-2">
                {(['last7', 'last30', 'thisMonth', 'thisYear'] as PresetKey[]).map(key => (
                    <button
                        key={key}
                        onClick={() => setPreset(key)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activePreset === key ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        {key === 'last7' ? '7D' : key === 'last30' ? '30D' : key === 'thisMonth' ? 'Mes' : 'Año'}
                    </button>
                ))}
            </div>
            <button 
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:border-indigo-500 transition-colors shadow-sm"
            >
                <CalendarIcon className="w-4 h-4 text-indigo-500" />
                {uiStartDate.toLocaleDateString()} - {uiEndDate.toLocaleDateString()}
            </button>
        </div>
      </div>

      {/* KPI Cards con Comparativa porcentual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Ventas Totales</p>
              <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">${stats.currentKPI.rev.toLocaleString()}</p>
              <div className={`mt-4 flex items-center gap-1 text-xs font-black ${stats.diffs.revenue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.diffs.revenue >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                  <span>{Math.abs(stats.diffs.revenue).toFixed(1)}% vs anterior</span>
              </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
              <p className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">${stats.currentKPI.avg.toFixed(0)}</p>
              <div className={`mt-4 flex items-center gap-1 text-xs font-black ${stats.diffs.avg >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.diffs.avg >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                  <span>{Math.abs(stats.diffs.avg).toFixed(1)}% vs anterior</span>
              </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Unidades Vendidas</p>
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{stats.currentKPI.qty}</p>
              <div className={`mt-4 flex items-center gap-1 text-xs font-black ${stats.diffs.units >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.diffs.units >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                  <span>{Math.abs(stats.diffs.units).toFixed(1)}% de volumen</span>
              </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pedidos</p>
              <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">{stats.currentKPI.orders}</p>
              <div className={`mt-4 flex items-center gap-1 text-xs font-black ${stats.diffs.orders >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.diffs.orders >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                  <span>{Math.abs(stats.diffs.orders).toFixed(1)}% en frecuencia</span>
              </div>
          </div>
      </div>

      {/* Gráfico de Historial Mensual */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-black text-gray-800 dark:text-white mb-8 tracking-tight">Evolución de Facturación Mensual</h3>
          <div className="flex items-end justify-between h-48 gap-4 px-4">
              {stats.trendMonths.map(m => (
                  <div key={m.key} className="flex-1 flex flex-col items-center group">
                      <div className="w-full relative flex items-end justify-center h-40">
                          <div 
                              className="w-full max-w-[60px] bg-indigo-500/20 group-hover:bg-indigo-500/40 rounded-t-lg transition-all duration-500 relative"
                              style={{ height: `${(m.total / maxMonthRevenue) * 100}%` }}
                          >
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
                                  ${m.total.toLocaleString()}
                              </div>
                          </div>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-tighter">{m.label}</span>
                  </div>
              ))}
          </div>
      </div>

      {/* Tabla de Proyección de Compras */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30">
              <div>
                  <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">Plan de Reposición por Velocidad</h3>
                  <p className="text-xs text-gray-500 font-medium italic">Stock Actual vs. Ventas del periodo seleccionado</p>
              </div>
          </div>
          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas {stats.daysInRange}d</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Cobertura</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black text-teal-600 uppercase tracking-widest">Sugerencia Compra (30d)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stats.projectionData.map((p) => {
                          const isCritical = p.daysRemaining <= 7;
                          const isWarning = p.daysRemaining <= 15;
                          
                          let statusClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
                          if (isCritical) statusClass = "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 animate-pulse";
                          else if (isWarning) statusClass = "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";

                          return (
                              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-3">
                                          <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover border border-gray-100 dark:border-gray-600" alt="" />
                                          <div>
                                              <div className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</div>
                                              <div className="text-[10px] text-gray-400 font-mono uppercase">{p.sku}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{p.unitsSold}</span>
                                      <p className="text-[9px] text-gray-400 uppercase font-medium">unidades</p>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-sm text-gray-700 dark:text-gray-300">
                                      {p.currentStock}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${statusClass}`}>
                                          {p.daysRemaining === Infinity ? 'Inactivo' : `${Math.floor(p.daysRemaining)} Días`}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                      {p.suggested30Days > 0 ? (
                                          <div className="flex flex-col items-end">
                                              <span className="text-sm font-black text-teal-600 dark:text-teal-400">Pedir {Math.ceil(p.suggested30Days)}</span>
                                              <span className="text-[9px] text-gray-400 uppercase">Para 30 días de stock</span>
                                          </div>
                                      ) : (
                                          <span className="text-xs text-emerald-500 font-bold italic">Abastecido</span>
                                      )}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>

      <DateRangePicker 
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          initialStartDate={uiStartDate}
          initialEndDate={uiEndDate}
          onApply={handleApplyDates}
      />
    </div>
  );
};
