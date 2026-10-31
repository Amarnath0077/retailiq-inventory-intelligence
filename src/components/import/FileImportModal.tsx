import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  Database,
  Table as TableIcon
} from 'lucide-react';
import { apiFetch } from '../../utils/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { saveUserDataset } from '../../utils/persistentStorage.ts';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  isDatabaseConnected?: boolean;
}

interface PreviewData {
  valid: boolean;
  fileType: 'csv' | 'pdf';
  fileName: string;
  totalRows: number;
  columns: string[];
  previewRows: Record<string, any>[];
  calculatedMetrics: {
    totalUnits: number;
    totalValue: number;
    averagePrice: number;
    sampleBrands: string[];
  };
  records: Record<string, any>[];
  warnings?: string[];
  error?: string;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  isDatabaseConnected = false
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [saveToDb, setSaveToDb] = useState(isDatabaseConnected);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setErrorNotice(null);
    setIsValidating(false);
    setIsConfirming(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    setErrorNotice(null);
    setPreviewData(null);

    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');

    if (!isCsv && !isPdf) {
      setErrorNotice('Unsupported file format. Please upload a .csv or .pdf file.');
      return;
    }

    const type: 'csv' | 'pdf' = isCsv ? 'csv' : 'pdf';
    setFileType(type);
    setFile(selectedFile);
    setIsValidating(true);

    try {
      let content = '';
      if (type === 'csv') {
        content = await selectedFile.text();
      } else {
        // PDF to Base64
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read PDF file'));
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await apiFetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType: type,
          content,
          fileName: selectedFile.name
        })
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrorNotice(data.error || 'The file could not be parsed as valid inventory data.');
      } else {
        setPreviewData(data);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error processing the file. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.records || previewData.records.length === 0) return;

    setIsConfirming(true);
    setErrorNotice(null);

    try {
      const res = await apiFetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType: previewData.fileType,
          fileName: previewData.fileName,
          records: previewData.records,
          saveToDatabase: saveToDb && isDatabaseConnected
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Import confirmation failed.');
      }

      // Persist to user-isolated storage to survive serverless container recycles
      if (user?.id) {
        await saveUserDataset({
          userId: user.id,
          fileType: previewData.fileType,
          fileName: previewData.fileName,
          records: previewData.records,
          importedAt: new Date().toISOString(),
          summary: data.summary
        });
      }

      // Success: trigger reload and close
      onImportSuccess();
      handleClose();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to save imported records.');
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Import Inventory Data</h2>
              <p className="text-xs text-slate-500">Extract and validate stock records from CSV or PDF files</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Error Message */}
          {errorNotice && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <span className="font-semibold">Import Error: </span>
                {errorNotice}
              </div>
            </div>
          )}

          {/* Upload / Drag & Drop Area */}
          {!previewData && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragging 
                  ? 'border-indigo-600 bg-indigo-50/50' 
                  : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/70'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              
              {isValidating ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Validating & analyzing inventory records...
                  </p>
                  <p className="text-xs text-slate-500">
                    {fileType === 'pdf' ? 'Running structured document extraction with Gemini...' : 'Parsing CSV rows, headers and SKUs...'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Click to browse or drag and drop your file here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports CSV spreadsheets and PDF inventory reports / supplier invoices
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-[11px] shadow-2xs">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> .CSV
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-[11px] shadow-2xs">
                      <FileText className="w-3.5 h-3.5 text-purple-600" /> .PDF
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation & Preview Section */}
          {previewData && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* File Info & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                    {previewData.fileType === 'csv' ? (
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{previewData.fileName}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {previewData.totalRows} valid rows extracted · {previewData.columns.length} columns detected
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validation Passed
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Warnings if any */}
              {previewData.warnings && previewData.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Warnings:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {previewData.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Calculated Metrics Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Total SKUs / Items
                  </span>
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {previewData.totalRows.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Calculated Units
                  </span>
                  <span className="text-2xl font-bold font-mono text-blue-600">
                    {previewData.calculatedMetrics.totalUnits.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Total Valuation
                  </span>
                  <span className="text-2xl font-bold font-mono text-emerald-600">
                    ${previewData.calculatedMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Data Preview (First {Math.min(10, previewData.previewRows.length)} rows)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Ready to commit to inventory</span>
                </div>

                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 sticky top-0 font-medium">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product / Name</th>
                        <th className="py-2 px-3">Brand</th>
                        <th className="py-2 px-3">Category/Color</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {previewData.previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-900 truncate max-w-[180px]">
                            {row.name || row.product_name || `Item ${idx + 1}`}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600">
                            {row.brand || 'Unbranded'}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-500">
                            {row.color || row.category || 'Standard'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-800">
                            ${Number(row.price || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">
                            {Number(row.stock_quantity || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Database Save Option */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToDb && isDatabaseConnected}
                    disabled={!isDatabaseConnected}
                    onChange={(e) => setSaveToDb(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      Persist imported records to connected MySQL database
                    </span>
                    <span className="text-slate-500 block mt-0.5 leading-relaxed">
                      {isDatabaseConnected
                        ? 'Creates or updates the "products" table in your connected database.'
                        : 'Connect a database first in Settings or Dashboard to enable persistent database storage.'}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={isConfirming}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {previewData ? (
            <button
              onClick={handleConfirmImport}
              disabled={isConfirming}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Records...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Import ({previewData.totalRows} SKUs)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isValidating}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Select File to Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
