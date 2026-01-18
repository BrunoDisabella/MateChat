
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Product, Sale, Expense, TransactionType, CashBoxTransaction, View, ProductFailure } from './types.ts';
import { useProducts } from './hooks/useProducts.ts';
import { useSales } from './hooks/useSales.ts';
import { useExpenses } from './hooks/useExpenses.ts';
import { useAdCosts } from './hooks/useAdCosts.ts';
import { useCashBox } from './hooks/useCashBox.ts';
import { useShippingMethods } from './hooks/useShippingMethods.ts';
import { useFailures } from './hooks/useFailures.ts';
import { Header } from './components/Header.tsx';
import { ProductList } from './components/ProductList.tsx';
import { SaleList } from './components/SaleList.tsx';
import { ExpenseList } from './components/ExpenseList.tsx';
import { Modal } from './components/Modal.tsx';
import { ProductForm } from './components/ProductForm.tsx';
import { SaleForm } from './components/SaleForm.tsx';
import { ExpenseForm } from './components/ExpenseForm.tsx';
import { FailureForm } from './components/FailureForm.tsx';
import { CashBoxTransactionForm } from './components/CashBoxTransactionForm.tsx';
import { SalesSummary } from './components/SalesSummary.tsx';
import { Tabs } from './components/Tabs.tsx';
import { HomeIcon, BoxIcon, ReceiptIcon, CurrencyDollarIcon, DownloadIcon, CogIcon, NoteIcon, CalculatorIcon, HeartIcon, SearchIcon, ArchiveIcon, TruckIcon, AlertTriangleIcon, ChartBarIcon, CheckCircleIcon } from './components/icons.tsx';
import { Console } from './components/Console.tsx';
import { Logger } from './lib/logger.ts';
import { ConfirmationModal } from './components/ConfirmationModal.tsx';
import { AddStockForm } from './components/AddStockForm.tsx';
import { IntegrationsPage } from './components/IntegrationsPage.tsx';
import { NotesPage } from './components/NotesPage.tsx';
import { CalculatorPage } from './components/CalculatorPage.tsx';
import { NatashaNotesPage } from './components/NatashaNotesPage.tsx';
import { ShippingMethodsPage } from './components/ShippingMethodsPage.tsx';
import { FailuresPage } from './components/FailuresPage.tsx';
import { MetricsPage } from './components/MetricsPage.tsx';
import { InvoicingPage } from './components/InvoicingPage.tsx';
import { getBackendUrl } from './lib/settings.ts';

function App() {
  const { products, addProduct, updateProduct, deleteProduct, fetchProducts, addStockEntry } = useProducts();
  const { sales, addSale, updateSale, deleteSale, isLoadingSales, salesError, setSalesDateRange, fetchSales } = useSales(products);
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const { adCostRecords, addAdCostRecord } = useAdCosts();
  const { balance: cashBoxBalance, transactions: cashBoxTransactions, addTransaction: addCashBoxTransaction, deleteTransaction: deleteCashBoxTransaction } = useCashBox();
  const { shippingMethods } = useShippingMethods();
  const { failures, isLoading: isLoadingFailures, addFailure, deleteFailure } = useFailures();
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isFailureModalOpen, setIsFailureModalOpen] = useState(false);
  const [isCashBoxModalOpen, setIsCashBoxModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForStockAdd, setProductForStockAdd] = useState<Product | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [activeView, setActiveView] = useState<View>('summary');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [cashBoxTransactionType, setCashBoxTransactionType] = useState<TransactionType>('ingreso');
  const [confirmationState, setConfirmationState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [isAuthHandled, setIsAuthHandled] = useState(false);
  
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    if (isAuthHandled) return;

    const handleMercadoLibreCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const verifierFromState = urlParams.get('state');

      if (!code || !verifierFromState) {
        setIsAuthHandled(true);
        return;
      }
      
      Logger.info("🔐 Código de autorización detectado. Iniciando intercambio...");

      try {
        const backendUrl = getBackendUrl();
        const exchangeUrl = `${backendUrl.replace(/\/$/, '')}/api/mercadolibre/auth/exchange-code`;
        const redirectUri = `${window.location.origin}${window.location.pathname}`;

        const response = await fetch(exchangeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: verifierFromState,
            redirectUri: redirectUri
          })
        });
      
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      
        const data = await response.json();
        sessionStorage.setItem('ML_CONNECTED_STATUS', 'true');
        
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('code');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, document.title, cleanUrl.toString());
      
      } catch (error) {
        const fetchError = error instanceof Error ? error : new Error(String(error));
        Logger.error("❌ Falló el intercambio de código por token.", { error: fetchError.message }, fetchError);
        sessionStorage.removeItem('ML_CONNECTED_STATUS');
      } finally {
        setIsAuthHandled(true);
      }
    };

    handleMercadoLibreCallback();
  }, [isAuthHandled]);


  const combinedExpenses = useMemo(() => {
    const regularExpenses = expenses.map(e => ({
      ...e,
      source: 'expense' as const,
    }));

    const cashBoxOutflows = cashBoxTransactions
      .filter(t => t.type === 'egreso')
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        category: 'Egreso de Caja' as const,
        createdAt: t.created_at,
        source: 'cashbox' as const,
      }));

    return [...regularExpenses, ...cashBoxOutflows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [expenses, cashBoxTransactions]);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const lowerTerm = productSearchTerm.toLowerCase();
    return products.filter(product =>
        product.name.toLowerCase().includes(lowerTerm) ||
        product.sku.toLowerCase().includes(lowerTerm)
    );
  }, [products, productSearchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === '0') {
            e.preventDefault();
            setIsConsoleOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    const currentTab = window.location.hash.replace('#', '');
    if (['summary', 'products', 'sales', 'expenses', 'integrations', 'notes', 'calculator', 'natasha', 'shipping', 'failures', 'metrics', 'billing'].includes(currentTab)) {
        setActiveView(currentTab as View);
    } else {
        setActiveView('summary');
    }

    const handleHashChange = () => {
        const hash = window.location.hash.replace('#', '');
        if (['summary', 'products', 'sales', 'expenses', 'integrations', 'notes', 'calculator', 'natasha', 'shipping', 'failures', 'metrics', 'billing'].includes(hash)) {
            setActiveView(hash as View);
        }
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleSetActiveView = (view: View) => {
    setActiveView(view);
    window.location.hash = view;
  };

  const handleAddProductClick = useCallback(() => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  }, []);

  const handleRecordSaleClick = useCallback(() => {
    setEditingSale(null);
    setIsSaleModalOpen(true);
  }, []);

  const handleAddExpenseClick = useCallback(() => {
    setIsExpenseModalOpen(true);
  }, []);

  const handleAddFailureClick = useCallback(() => {
    setIsFailureModalOpen(true);
  }, []);

  const handleEditProductClick = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  }, []);

  const handleAddStockClick = useCallback((product: Product) => {
    setProductForStockAdd(product);
    setIsAddStockModalOpen(true);
  }, []);
  
  const handleDeleteProduct = useCallback((productId: string) => {
    setConfirmationState({
      isOpen: true,
      title: 'Eliminar Producto',
      message: '¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.',
      onConfirm: () => {
        deleteProduct(productId)
      },
    });
  }, [deleteProduct]);

  const handleEditSaleClick = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setIsSaleModalOpen(true);
  }, []);

  const handleDeleteSaleClick = useCallback((saleId: string) => {
    setConfirmationState({
        isOpen: true,
        title: 'Eliminar Venta',
        message: 'Esta acción restaurará el stock de los productos correspondientes. ¿Estás seguro de que quieres continuar?',
        onConfirm: async () => {
            const success = await deleteSale(saleId);
            if (success) {
                await fetchProducts();
            }
        },
    });
  }, [deleteSale, fetchProducts]);
  
  const handleDeleteExpenseClick = useCallback((expenseId: string) => {
    setConfirmationState({
      isOpen: true,
      title: 'Eliminar Gasto',
      message: '¿Estás seguro de que quieres eliminar este gasto? Esta acción no se puede deshacer.',
      onConfirm: () => {
        deleteExpense(expenseId);
      },
    });
  }, [deleteExpense]);

  const handleDeleteCashBoxTransaction = useCallback((transactionId: string) => {
    setConfirmationState({
        isOpen: true,
        title: 'Eliminar Movimiento de Caja',
        message: '¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer.',
        onConfirm: () => {
            deleteCashBoxTransaction(transactionId);
        },
    });
  }, [deleteCashBoxTransaction]);

  const handleDeleteFromExpenseList = useCallback((id: string, source: 'expense' | 'cashbox') => {
    if (source === 'expense') {
      handleDeleteExpenseClick(id);
    } else {
      handleDeleteCashBoxTransaction(id);
    }
  }, [handleDeleteExpenseClick, handleDeleteCashBoxTransaction]);

  const handleAddIncomeClick = useCallback(() => {
    setCashBoxTransactionType('ingreso');
    setIsCashBoxModalOpen(true);
  }, []);

  const handleAddOutcomeClick = useCallback(() => {
    setCashBoxTransactionType('egreso');
    setIsCashBoxModalOpen(true);
  }, []);

  const handleCloseModals = useCallback(() => {
    setIsProductModalOpen(false);
    setIsSaleModalOpen(false);
    setIsExpenseModalOpen(false);
    setIsCashBoxModalOpen(false);
    setIsAddStockModalOpen(false);
    setIsFailureModalOpen(false);
    setEditingProduct(null);
    setEditingSale(null);
    setProductForStockAdd(null);
    setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  }, []);

  const handleProductFormSubmit = useCallback(async (productData: Omit<Product, 'id' | 'created_at'>) => {
    if (editingProduct) {
      await updateProduct({ ...productData, id: editingProduct.id, created_at: editingProduct.created_at });
    } else {
      const { cost, quantity, ...rest } = productData;
      await addProduct({
          ...rest,
          initialCost: cost,
          initialQuantity: quantity
      });
    }
    handleCloseModals();
  }, [addProduct, updateProduct, editingProduct, handleCloseModals]);
  
  const handleAddStockSubmit = useCallback(async (productId: string, quantity: number, unitCost: number, variantName?: string) => {
    await addStockEntry(productId, quantity, unitCost, variantName);
    handleCloseModals();
  }, [addStockEntry, handleCloseModals]);

  const handleSaleFormSubmit = useCallback(async (saleData: Omit<Sale, 'id'>) => {
    let success = false;
    if (editingSale) {
      const result = await updateSale(editingSale.id, { ...saleData, id: editingSale.id }, products);
      success = !!result;
    } else {
      const result = await addSale(saleData, products);
      success = !!result;
    }
    
    if (success) {
      await fetchProducts();
      handleCloseModals();
    }
  }, [addSale, updateSale, products, editingSale, handleCloseModals, fetchProducts]);

  const handleExpenseFormSubmit = useCallback((expenseData: Omit<Expense, 'id'>) => {
    addExpense(expenseData);
    handleCloseModals();
  }, [addExpense, handleCloseModals]);

  const handleFailureFormSubmit = useCallback(async (data: Omit<ProductFailure, 'id' | 'created_at'>) => {
    const success = await addFailure(data);
    if (success) {
      await fetchProducts();
    }
    handleCloseModals();
  }, [addFailure, handleCloseModals, fetchProducts]);

  const handleCashBoxFormSubmit = useCallback((transactionData: Omit<CashBoxTransaction, 'id' | 'created_at'>) => {
    addCashBoxTransaction(transactionData);
    handleCloseModals();
  }, [addCashBoxTransaction, handleCloseModals]);

  const handleExportCSV = useCallback(() => {
    if (products.length === 0) {
      Logger.warn("No hay productos para exportar.");
      return;
    }

    const escapeCsvValue = (value: string | number | null | undefined): string => {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['Nombre del Producto', 'SKU'];
    const csvRows = [
      headers.join(','),
      ...products.map(product => 
        [
          escapeCsvValue(product.name),
          escapeCsvValue(product.sku)
        ].join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'productos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [products]);

  const TABS = [
    { id: 'summary', name: 'Resumen', icon: HomeIcon },
    { id: 'metrics', name: 'Métricas', icon: ChartBarIcon },
    { id: 'billing', name: 'Fac. Local', icon: CheckCircleIcon }, // Nueva pestaña
    { id: 'products', name: 'Productos', icon: BoxIcon },
    { id: 'sales', name: 'Ventas', icon: ReceiptIcon },
    { id: 'failures', name: 'Fallas', icon: AlertTriangleIcon }, 
    { id: 'expenses', name: 'Gastos', icon: CurrencyDollarIcon },
    { id: 'shipping', name: 'Envíos', icon: TruckIcon },
    { id: 'calculator', name: 'Calculadora', icon: CalculatorIcon },
    { id: 'notes', name: 'Notas', icon: NoteIcon },
    { id: 'natasha', name: 'Notas Natasha', icon: HeartIcon },
    { id: 'integrations', name: 'Integraciones', icon: CogIcon },
  ];

  const renderContent = () => {
    if (!isAuthHandled) {
        return (
             <div className="flex flex-col items-center justify-center p-8 text-center">
                <CogIcon className="w-12 h-12 text-gray-400 animate-spin" />
                <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
                    Inicializando aplicación...
                </p>
            </div>
        );
    }

    switch (activeView) {
      case 'summary':
        return (
          <SalesSummary
            sales={sales}
            isLoadingSales={isLoadingSales}
            salesError={salesError}
            expenses={expenses}
            products={products}
            failures={failures} 
            adCostHistory={adCostRecords}
            onAdCostImport={addAdCostRecord}
            cashBoxBalance={cashBoxBalance}
            cashBoxTransactions={cashBoxTransactions}
            onAddIncome={handleAddIncomeClick}
            onAddOutcome={handleAddOutcomeClick}
            onDeleteTransaction={handleDeleteCashBoxTransaction}
            onDateRangeChange={setSalesDateRange}
          />
        );
      case 'metrics':
        return (
          <MetricsPage 
            sales={sales}
            expenses={expenses}
            products={products}
            failures={failures}
            onDateRangeChange={setSalesDateRange}
            isLoading={isLoadingSales}
          />
        );
      case 'billing':
        return (
          <InvoicingPage 
            sales={sales}
            onSaleInvoiced={() => fetchSales(products)}
          />
        );
      case 'products':
        const totalStockValue = products.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
        const totalStockCount = products.reduce((sum, p) => sum + p.quantity, 0);

        return (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                 <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
                     <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Costo Total del Inventario</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalStockValue.toFixed(2)}</p>
                     </div>
                     <CurrencyDollarIcon className="w-10 h-10 text-blue-100 dark:text-blue-900/50" />
                 </div>
                 <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border-l-4 border-indigo-500 flex items-center justify-between">
                     <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unidades en Stock</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalStockCount}</p>
                     </div>
                     <ArchiveIcon className="w-10 h-10 text-indigo-100 dark:text-indigo-900/50" />
                 </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <BoxIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario de Productos</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                     <div className="relative flex-grow sm:flex-grow-0 min-w-[250px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            placeholder="Buscar producto o SKU..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 whitespace-nowrap"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                </div>
            </div>
            <ProductList 
                products={filteredProducts} 
                onEdit={handleEditProductClick} 
                onDelete={handleDeleteProduct} 
                onAddStock={handleAddStockClick}
            />
          </div>
        );
      case 'sales':
        return (
             <SaleList 
                sales={sales} 
                onEdit={handleEditSaleClick} 
                onDelete={handleDeleteSaleClick} 
                isLoading={isLoadingSales}
             />
        );
      case 'failures':
        return (
            /* FIX: Se elimina 'products={products}' ya que FailuresPage no lo recibe en sus props */
            <FailuresPage 
                failures={failures} 
                isLoading={isLoadingFailures} 
                onDeleteFailure={deleteFailure} 
            />
        );
      case 'expenses':
        return <ExpenseList expenses={combinedExpenses} onDelete={handleDeleteFromExpenseList} />;
      case 'shipping':
        return <ShippingMethodsPage sales={sales} />; 
      case 'notes':
        return <NotesPage />;
      case 'natasha':
        return <NatashaNotesPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'calculator':
        return <CalculatorPage />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header 
        onAddProduct={handleAddProductClick}
        onRecordSale={handleRecordSaleClick}
        onAddExpense={handleAddExpenseClick}
        onAddFailure={handleAddFailureClick}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
         <Tabs
          tabs={TABS}
          activeTab={activeView}
          setActiveTab={(id) => handleSetActiveView(id as View)}
        />
        <div className="mt-8">
            {renderContent()}
        </div>
      </main>

      <Modal 
        isOpen={isProductModalOpen} 
        onClose={handleCloseModals}
        title={editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
      >
        <ProductForm 
          onSubmit={handleProductFormSubmit}
          onCancel={handleCloseModals}
          initialData={editingProduct}
        />
      </Modal>

      <Modal
        isOpen={isSaleModalOpen}
        onClose={handleCloseModals}
        title={editingSale ? 'Editar Venta' : 'Registrar Nueva Venta'}
      >
        <SaleForm
          products={products}
          shippingMethods={shippingMethods}
          onSubmit={handleSaleFormSubmit}
          onCancel={handleCloseModals}
          initialData={editingSale}
        />
      </Modal>

       <Modal
        isOpen={isExpenseModalOpen}
        onClose={handleCloseModals}
        title="Agregar Gasto Operativo"
      >
        <ExpenseForm
          onSubmit={handleExpenseFormSubmit}
          onCancel={handleCloseModals}
        />
      </Modal>

      <Modal
        isOpen={isFailureModalOpen}
        onClose={handleCloseModals}
        title="Registrar Nueva Falla"
      >
        <FailureForm 
            products={products}
            onSubmit={handleFailureFormSubmit}
            onCancel={handleCloseModals}
        />
      </Modal>

      <Modal
        isOpen={isCashBoxModalOpen}
        onClose={handleCloseModals}
        title={cashBoxTransactionType === 'ingreso' ? 'Registrar Ingreso en Caja' : 'Registrar Egreso de Caja'}
      >
        <CashBoxTransactionForm
          onSubmit={handleCashBoxFormSubmit}
          onCancel={handleCloseModals}
          transactionType={cashBoxTransactionType}
        />
      </Modal>

      <Modal
        isOpen={isAddStockModalOpen && !!productForStockAdd}
        onClose={handleCloseModals}
        title={`Agregar Stock a "${productForStockAdd?.name}"`}
      >
        {productForStockAdd && (
          <AddStockForm
            product={productForStockAdd}
            onSubmit={handleAddStockSubmit}
            onCancel={handleCloseModals}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={handleCloseModals}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
      />

      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
    </div>
  );
}

export default App;
