
import React, { useState, useCallback } from 'react';
import { Product } from '../types.ts';
import { Modal } from './Modal.tsx';
import { Logger } from '../lib/logger.ts';
import { UploadIcon } from './icons.tsx';

interface ImportedAdCost {
    productId: string;
    totalAdCost: number;
    startDate: string;
    endDate: string;
}

interface AdCostImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (costs: ImportedAdCost[]) => void;
  products: Product[];
}

// This regex splits a string by commas, but ignores commas inside double quotes.
const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*[^"]*$)/;

export const AdCostImportModal: React.FC<AdCostImportModalProps> = ({ isOpen, onClose, onImport, products }) => {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setFileContent('');
    setFileName(null);
    setIsProcessing(false);
    setIsDragging(false);
  }, []);

  const processFile = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith('text/csv') && !file.name.endsWith('.csv')) {
      Logger.error("Archivo no válido. Por favor, selecciona un archivo CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
      setFileName(file.name);
    };
    reader.onerror = () => {
        Logger.error("No se pudo leer el archivo seleccionado.");
    }
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0] || null);
  };
  
  const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>, dragging: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(dragging);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
      handleDragEvents(e, false);
      processFile(e.dataTransfer.files?.[0] || null);
  };

  const handleImport = useCallback(() => {
    setIsProcessing(true);
    if (!fileContent.trim()) {
      Logger.error("El archivo CSV está vacío o no ha sido seleccionado.");
      setIsProcessing(false);
      return;
    }

    try {
      const lines = fileContent.trim().split('\n');
      if (lines.length < 2) {
        Logger.error("Los datos CSV no son válidos. Se requiere al menos una cabecera y una fila de datos.");
        setIsProcessing(false);
        return;
      }
      
      const headerLine = lines.shift()!;
      const headers = headerLine.split(csvSplitRegex).map(h => h.trim().replace(/"/g, ''));

      const adSetNameIndex = headers.indexOf("Nombre del conjunto de anuncios");
      const adCostIndex = headers.indexOf("Importe gastado (UYU)");
      const startDateIndex = headers.indexOf("Inicio del informe");
      const endDateIndex = headers.indexOf("Fin del informe");

      if (adSetNameIndex === -1 || adCostIndex === -1 || startDateIndex === -1 || endDateIndex === -1) {
        Logger.error("Columnas requeridas no encontradas. Asegúrate de que existan: 'Nombre del conjunto de anuncios', 'Importe gastado (UYU)', 'Inicio del informe', y 'Fin del informe'.");
        setIsProcessing(false);
        return;
      }
      
      const costsByProduct: { [productId: string]: { totalAdCost: number, startDate: string, endDate: string } } = {};

      lines.forEach((line, index) => {
        const values = line.split(csvSplitRegex).map(v => v.replace(/"/g, '').trim());
        if (values.length < headers.length) {
          Logger.warn(`La línea ${index + 2} del CSV parece estar malformada y será ignorada.`);
          return;
        }

        const adSetName = values[adSetNameIndex];
        const costString = values[adCostIndex];
        const startDate = values[startDateIndex];
        const endDate = values[endDateIndex];
        const cost = parseFloat(costString);
        
        if (isNaN(cost)) {
           Logger.warn(`Costo no válido ('${costString}') en la línea ${index + 2}. Se saltará esta entrada.`);
           return;
        }
        
        const foundProduct = products.find(p => adSetName.includes(p.sku));
        
        if (foundProduct) {
          if (!costsByProduct[foundProduct.id]) {
            costsByProduct[foundProduct.id] = { totalAdCost: 0, startDate, endDate };
          }
          costsByProduct[foundProduct.id].totalAdCost += cost;
          // Asumimos que el rango de fechas es el mismo para todo el informe
          costsByProduct[foundProduct.id].startDate = startDate;
          costsByProduct[foundProduct.id].endDate = endDate;
        }
      });
      
      const result: ImportedAdCost[] = Object.entries(costsByProduct).map(([productId, data]) => ({
        productId,
        ...data
      }));

      if (result.length === 0) {
        Logger.warn("No se encontraron productos coincidentes en el CSV. Verifica que los SKUs de tus productos existan en los nombres de los conjuntos de anuncios.");
      } else {
        onImport(result);
      }
      
      resetState();
      onClose();

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      Logger.error("Ocurrió un error al procesar el CSV.", {}, err);
    } finally {
      setIsProcessing(false);
    }
  }, [fileContent, products, onImport, onClose, resetState]);
  
  const handleCancel = () => {
    resetState();
    onClose();
  };


  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Importar Gastos de Anuncios desde CSV">
      <div className="space-y-4">
        <div>
          <label 
              htmlFor="csv-upload" 
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors
                          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
              onDragOver={(e) => handleDragEvents(e, true)}
              onDragLeave={(e) => handleDragEvents(e, false)}
              onDrop={handleDrop}
          >
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <span className="relative rounded-md font-medium text-blue-600 dark:text-blue-500 hover:text-blue-500">
                  <span>Sube un archivo</span>
                </span>
                <p className="pl-1">o arrastra y suelta</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Solo archivos CSV</p>
              {fileName && <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">{fileName}</p>}
            </div>
            <input id="csv-upload" name="csv-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv,text/csv" />
          </label>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            El sistema buscará las columnas "Nombre del conjunto de anuncios" y "Importe gastado (UYU)" para asociar los costos a los productos por su SKU.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="py-2 px-4 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600"
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:ring-teal-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-teal-600 dark:hover:bg-teal-700 focus:outline-none dark:focus:ring-teal-800 disabled:opacity-50"
            disabled={isProcessing || !fileContent}
          >
            {isProcessing ? 'Procesando...' : 'Importar Gastos'}
          </button>
        </div>
      </div>
    </Modal>
  );
};