import React, { useState, useMemo } from 'react';
import { ProductFailure } from '../types.ts';
import { AlertTriangleIcon, TrashIcon, SearchIcon, SyncIcon } from './icons.tsx';
import { ConfirmationModal } from './ConfirmationModal.tsx';

interface FailuresPageProps {
    failures: ProductFailure[];
    isLoading: boolean;
    onDeleteFailure: (id: string) => Promise<void>;
}

export const FailuresPage: React.FC<FailuresPageProps> = ({ failures, isLoading, onDeleteFailure }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const filteredFailures = useMemo(() => {
        if (!searchTerm) return failures;
        const term = searchTerm.toLowerCase();
        return failures.filter(f => 
            f.product_name.toLowerCase().includes(term) ||
            f.product_sku.toLowerCase().includes(term) ||
            f.reason.toLowerCase().includes(term)
        );
    }, [failures, searchTerm]);

    const totalLoss = useMemo(() => {
        return failures.reduce((acc, f) => acc + (f.product_cost * f.quantity) + f.shipping_cost, 0);
    }, [failures]);

    const confirmDelete = async () => {
        if (deleteId) {
            await onDeleteFailure(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <AlertTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registro de Fallas y Devoluciones</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Productos descontados del stock por daños o devoluciones.</p>
                    </div>
                </div>
                
                <div className="text-right bg-red-50 dark:bg-red-900/10 px-6 py-3 rounded-lg border border-red-100 dark:border-red-900/30 w-full md:w-auto">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pérdida Total Acumulada</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400 font-mono">
                        ${totalLoss.toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full pl-10 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Buscar por producto o motivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="text-center py-12"><SyncIcon className="w-8 h-8 text-gray-400 animate-spin mx-auto" /></div>
            ) : filteredFailures.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">No hay registros de fallas.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto / Color</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cant.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Motivo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pérdida ($)</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredFailures.map((failure) => (
                                <tr key={failure.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(failure.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{failure.product_name}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            {failure.product_sku} 
                                            {failure.variant && <span className="bg-gray-100 dark:bg-gray-700 px-1 rounded border dark:border-gray-600 font-bold">{failure.variant}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-red-600">
                                        {failure.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {failure.reason}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                                        ${((failure.product_cost * failure.quantity) + failure.shipping_cost).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <button onClick={() => setDeleteId(failure.id)} className="text-gray-400 hover:text-red-600 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Eliminar Registro de Falla"
                message="Esta acción NO devolverá las unidades al stock automáticamente. ¿Continuar?"
            />
        </div>
    );
};