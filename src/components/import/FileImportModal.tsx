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
  Table as TableIcon,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '../../utils/api.ts';

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

      // Success: trigger reload and close
      onImportSuccess();
      handleClose();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to save imported records.');
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-2xl border border-[#E4E5DC] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#252B28]">
        {/* Header */}
        <div className="p-5 border-b border-[#E4E5DC] flex items-center justify-between bg-[#F7F6F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#245C45] text-white flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#252B28]">Import Inventory Data</h2>
              <p className="text-xs text-[#6F756F]">Extract and validate stock records from CSV or PDF files</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-[#7A807A] hover:text-[#252B28] rounded-md hover:bg-[#EAEBE2] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Error Message */}
          {errorNotice && (
            <div className="p-4 bg-[#F9ECEB] border border-[#F0CECA] rounded-md flex items-start gap-3 text-xs text-[#B9473F]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
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
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                isDragging 
                  ? 'border-[#245C45] bg-[#E8EFEA]/40' 
                  : 'border-[#CCDACC] hover:border-[#245C45] hover:bg-[#F7F6F0]'
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
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#245C45]" />
                  <p className="text-sm font-semibold text-[#252B28]">
                    Validating & analyzing inventory records...
                  </p>
                  <p className="text-xs text-[#6F756F]">
                    {fileType === 'pdf' ? 'Running structured document extraction...' : 'Parsing CSV rows and columns...'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-[#E8EFEA] text-[#245C45] flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#252B28]">
                      Click to browse or drag and drop your file here
                    </p>
                    <p className="text-xs text-[#7A807A] mt-1">
                      Supports CSV spreadsheets and PDF inventory reports / supplier invoices
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#555C56]">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-[#E4E5DC]">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#245C45]" /> .CSV
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-[#E4E5DC]">
                      <FileText className="w-3.5 h-3.5 text-[#C66A42]" /> .PDF
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F6F0] rounded-md border border-[#E4E5DC]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-white border border-[#E4E5DC] flex items-center justify-center text-[#245C45]">
                    {previewData.fileType === 'csv' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#252B28]">{previewData.fileName}</h3>
                    <p className="text-xs text-[#6F756F] font-mono">
                      {previewData.totalRows} valid rows extracted · {previewData.columns.length} columns detected
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validation Passed
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-[#6F756F] hover:text-[#252B28] underline px-1 cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Warnings if any */}
              {previewData.warnings && previewData.warnings.length > 0 && (
                <div className="p-3 bg-[#FFF9EB] border border-[#F5E2B3] rounded-md text-xs text-[#8A6116] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Warnings:
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
                <div className="p-3 bg-white rounded-md border border-[#E4E5DC]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A807A] block mb-1">
                    Total SKUs / Items
                  </span>
                  <span className="text-xl font-bold font-mono text-[#252B28]">
                    {previewData.totalRows.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-md border border-[#E4E5DC]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A807A] block mb-1">
                    Calculated Units
                  </span>
                  <span className="text-xl font-bold font-mono text-[#252B28]">
                    {previewData.calculatedMetrics.totalUnits.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-md border border-[#E4E5DC]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A807A] block mb-1">
                    Total Valuation
                  </span>
                  <span className="text-xl font-bold font-mono text-[#245C45]">
                    ${previewData.calculatedMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-[#E4E5DC] rounded-md overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-[#F7F6F0] border-b border-[#E4E5DC] flex items-center justify-between text-xs font-semibold text-[#555C56]">
                  <div className="flex items-center gap-1.5">
                    <TableIcon className="w-3.5 h-3.5 text-[#245C45]" />
                    <span>Data Preview (First {Math.min(10, previewData.previewRows.length)} rows)</span>
                  </div>
                  <span className="text-[11px] text-[#7A807A]">Ready to commit</span>
                </div>

                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] text-[#555C56] border-b border-[#E4E5DC] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product / Name</th>
                        <th className="py-2 px-3">Brand</th>
                        <th className="py-2 px-3">Category/Color</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEBE2] font-mono text-[11px]">
                      {previewData.previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F9FAF6]">
                          <td className="py-1.5 px-3 text-[#7A807A]">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-sans font-medium text-[#252B28] truncate max-w-[180px]">
                            {row.name || row.product_name || `Item ${idx + 1}`}
                          </td>
                          <td className="py-1.5 px-3 font-sans text-[#555C56]">
                            {row.brand || 'Unbranded'}
                          </td>
                          <td className="py-1.5 px-3 font-sans text-[#6F756F]">
                            {row.color || row.category || 'Standard'}
                          </td>
                          <td className="py-1.5 px-3 text-right font-semibold text-[#252B28]">
                            ${Number(row.price || 0).toFixed(2)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-[#245C45]">
                            {Number(row.stock_quantity || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Database Save Option */}
              <div className="p-3.5 bg-[#FAF9F5] border border-[#E4E5DC] rounded-md text-xs space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToDb && isDatabaseConnected}
                    disabled={!isDatabaseConnected}
                    onChange={(e) => setSaveToDb(e.target.checked)}
                    className="mt-0.5 rounded text-[#245C45] focus:ring-[#245C45]"
                  />
                  <div>
                    <span className="font-semibold text-[#252B28] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-[#245C45]" />
                      Persist imported records to connected MySQL database
                    </span>
                    <span className="text-[#6F756F] block mt-0.5">
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
        <div className="p-4 border-t border-[#E4E5DC] bg-[#F7F6F0] flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={isConfirming}
            className="px-4 py-2 text-xs font-semibold text-[#555C56] hover:bg-[#EAEBE2] rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {previewData ? (
            <button
              onClick={handleConfirmImport}
              disabled={isConfirming}
              className="flex items-center gap-2 px-5 py-2 bg-[#245C45] hover:bg-[#1C4A37] text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
              className="px-4 py-2 bg-[#245C45] hover:bg-[#1C4A37] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Select File to Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
