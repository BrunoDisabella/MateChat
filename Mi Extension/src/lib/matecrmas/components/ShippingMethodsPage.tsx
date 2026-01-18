import React, { useState, useMemo } from 'react';
import { useShippingMethods } from '../hooks/useShippingMethods.ts';
import { TruckIcon, PlusIcon, PencilIcon, TrashIcon, CurrencyDollarIcon, ReceiptIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';
import { ShippingMethod, Sale } from '../types.ts';

interface ShippingMethodsPageProps {
    sales?: Sale[];
}

export const ShippingMethodsPage: React.FC<ShippingMethodsPageProps> = ({ sales = [] }) => {
    const { shippingMethods, isLoading, addMethod, updateMethod, deleteMethod } = useShippingMethods();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [cost, setCost] = useState('');

    const handleOpenModal = (method?: ShippingMethod) => {
        if (method) {
            setEditingMethod(method);
            setName(method.name);
            setCost(method.cost.toString());
        } else {
            setEditingMethod(null);
            setName('');
            setCost('');
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingMethod(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedCost = parseFloat(cost);
        if (!name || isNaN(parsedCost)) {
            alert("Por favor completa el nombre y un costo válido.");
            return;
        }

        if (editingMethod) {
            await updateMethod(editingMethod.id, name, parsedCost);
        } else {
            await addMethod(name, parsedCost);
        }
        handleCloseModal();
    };

    // Historial de Envíos
    const shippingHistory = useMemo(() => {
        return sales
            .filter(s => s.shippingMethod && s.shippingMethod.trim() !== '')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [sales]);

    return (
        <div className="animate-fade-in-up space-y-8">
            
            {/* Sección 1: Configuración de Métodos */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <TruckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configuración de Métodos</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Define los transportistas y sus costos base para tus cálculos.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Nuevo Método
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Cargando métodos...</div>
                ) : shippingMethods.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400">No hay métodos definidos aún.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Sugerido</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {shippingMethods.map((method) => (
                                    <tr key={method.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {method.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            ${method.cost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleOpenModal(method)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4">
                                                <PencilIcon className="w-5 h-5 inline" />
                                            </button>
                                            <button onClick={() => deleteMethod(method.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                                <TrashIcon className="w-5 h-5 inline" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Sección 2: Historial de Envíos */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                    <ReceiptIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Historial de Envíos Realizados</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Registro de todas las ventas que incluyeron logística.</p>
                    </div>
                </div>

                {shippingHistory.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                        <TruckIcon className="mx-auto h-12 w-12 text-gray-300" />
                        <p className="mt-2 text-gray-500 dark:text-gray-400">No hay registros de ventas con envío.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Detalle Venta</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Método</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cant.</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Costo Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {shippingHistory.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(sale.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                                            <span className="block font-medium">{sale.items.length} productos</span>
                                            <span className="text-xs text-gray-500 truncate">{sale.items.map(i => i.name).join(', ')}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                            {sale.shippingMethod}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                                            {sale.shippingQuantity || 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white font-mono">
                                            ${(sale.shippingCost || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingMethod ? 'Editar Método de Envío' : 'Agregar Método de Envío'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nombre</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Ej: Agencia Central, Cadete, etc."
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Costo ($)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
                            </div>
                            <input
                                type="number"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="0.00"
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Este es el costo que asumes tú por el envío.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};