import Papa from 'papaparse';
import { userInventoryStore } from '../db/userInventoryStore.ts';
import { datasetManager } from '../db/datasetManager.ts';
import { mysqlService } from '../db/mysqlClient.ts';
import { GoogleGenAI, Type } from '@google/genai';

export interface ImportedDatasetSummary {
  sourceType: 'mysql' | 'csv' | 'pdf';
  fileName: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  importedAt: string;
  metadata?: {
    totalUnits?: number;
    totalValue?: number;
    detectedCategories?: string[];
    detectedBrands?: string[];
    notes?: string;
  };
}

export interface ImportPreviewResult {
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

class FileImporterManager {
  private currentSummary: ImportedDatasetSummary | null = null;
  private activeSourceType: 'mysql' | 'csv' | 'pdf' = 'mysql';

  // Sample CSV datasets ready for 1-click loading if user explicitly chooses
  public readonly sampleDatasets = {
    ecommerce: `product_id,brand,name,category,size,price,stock_quantity,sku,rating
1,Nike,Nike Air Pegasus 40,Footwear,10.5,130,45,NK-PEG-40,4.8
2,Adidas,Adidas Ultraboost Light,Footwear,10.0,180,32,AD-UB-01,4.9
3,Sony,Sony WH-1000XM5 Noise Cancelling,Electronics,Standard,398,18,SN-WH5-01,4.9
4,Bose,Bose QuietComfort 45,Electronics,Standard,329,24,BS-QC45,4.7
5,Levi,Levi's 501 Original Fit Jeans,Apparel,32x32,79,65,LV-501-BL,4.6
6,Nike,Nike Dri-FIT Legend Fitness Tee,Apparel,L,28,140,NK-DF-LG,4.5
7,Van Heusen,Van Heusen Regular Fit Dress Shirt,Apparel,16.5,45,55,VH-DRS-01,4.4
8,Apple,Apple AirPods Pro (2nd Gen),Electronics,Standard,249,15,AP-AIR-02,4.9
9,Puma,Puma Suede Classic Retro,Footwear,9.5,75,28,PM-SUE-01,4.3
10,Levi,Levi's Sherpa Trucker Jacket,Apparel,XL,128,20,LV-SHR-01,4.8
11,Adidas,Adidas Essentials 3-Stripes Hoodie,Apparel,M,65,40,AD-ESS-01,4.6
12,Sony,Sony LinkBuds S Wireless,Electronics,Standard,198,30,SN-LB-01,4.5`,

    retail_apparel: `t_shirt_id,brand,color,size,price,stock_quantity
1,Nike,White,XS,25,42
2,Nike,White,S,28,18
3,Nike,White,M,30,65
4,Nike,White,L,32,40
5,Nike,White,XL,35,9
6,Nike,Black,XS,24,15
7,Nike,Black,S,27,33
8,Nike,Black,M,30,85
9,Nike,Black,L,32,50
10,Nike,Black,XL,34,14
11,Levi,White,S,35,22
12,Levi,White,M,38,45
13,Levi,White,L,40,30
14,Levi,Black,S,36,25
15,Levi,Black,M,39,60
16,Van Heusen,Blue,S,42,18
17,Van Heusen,Blue,M,45,35
18,Van Heusen,Blue,L,48,22
19,Adidas,Red,M,32,28
20,Adidas,Blue,L,34,19`,

    supplier_invoice: `item_code,item_description,supplier,unit_price,quantity_ordered,total_cost
INV-101,Cotton Crewneck Performance Tee,Textile Pro Ltd,18.50,150,2775.00
INV-102,Fleece Heavyweight Pullover,Atlas Garments,34.00,80,2720.00
INV-103,Denim Straight Leg Trousers,Pacific Brands,42.00,60,2520.00
INV-104,Running Athletic Mesh Shorts,Apex Sportswear,21.00,110,2310.00
INV-105,Waterproof Breathable Windbreaker,Summit Gear,55.00,45,2475.00`
  };

  public getActiveSourceType(): 'mysql' | 'csv' | 'pdf' {
    return this.activeSourceType;
  }

  public getSummary(): ImportedDatasetSummary | null {
    return this.currentSummary;
  }

  /**
   * Validate and generate preview for CSV or PDF without persisting
   */
  public async validateAndPreview(fileType: 'csv' | 'pdf', content: string, fileName: string): Promise<ImportPreviewResult> {
    if (!content || !content.trim()) {
      return {
        valid: false,
        fileType,
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: 'File content is empty.'
      };
    }

    if (fileType === 'csv') {
      return this.previewCSV(content, fileName);
    } else if (fileType === 'pdf') {
      return this.previewPDF(content, fileName);
    } else {
      return {
        valid: false,
        fileType,
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: `Unsupported file type: ${fileType}. Only CSV and PDF files are supported.`
      };
    }
  }

  private previewCSV(csvText: string, fileName: string): ImportPreviewResult {
    const parseResult = Papa.parse<Record<string, any>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    if (parseResult.errors.length > 0 && (!parseResult.data || parseResult.data.length === 0)) {
      return {
        valid: false,
        fileType: 'csv',
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: `CSV parsing error: ${parseResult.errors[0]?.message || 'Invalid CSV structure'}`
      };
    }

    const rows = parseResult.data;
    if (!rows || rows.length === 0) {
      return {
        valid: false,
        fileType: 'csv',
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: 'CSV contains no data rows.'
      };
    }

    const columns = Object.keys(rows[0] || {});
    if (columns.length === 0) {
      return {
        valid: false,
        fileType: 'csv',
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: 'CSV contains no columns or header row.'
      };
    }

    // Identify standard inventory keys
    const brandKey = columns.find(c => /^(brand|supplier|vendor|manufacturer|maker)$/i.test(c)) ||
                     columns.find(c => /brand/i.test(c));
    const priceKey = columns.find(c => /^(price|unit_price|cost|amount|rate|val)$/i.test(c)) ||
                     columns.find(c => /price/i.test(c));
    const qtyKey = columns.find(c => /^(stock_quantity|quantity|stock|units|count|inventory_count)$/i.test(c)) ||
                   columns.find(c => /quantity|stock/i.test(c));
    const nameKey = columns.find(c => /^(name|product_name|item_name|title|description|item_description|product)$/i.test(c)) ||
                    columns.find(c => /name|title|product/i.test(c));
    const catKey = columns.find(c => /^(category|category_name|dept|department|group)$/i.test(c));
    const sizeKey = columns.find(c => /^(size|sku|model|variant|code|item_code)$/i.test(c));
    const idKey = columns.find(c => /^(id|t_shirt_id|product_id|item_id)$/i.test(c));

    const warnings: string[] = [];
    if (!priceKey) warnings.push('No price column detected; prices will default to $0.00.');
    if (!qtyKey) warnings.push('No stock/quantity column detected; quantities will default to 0.');
    if (!brandKey && !nameKey) warnings.push('No product name or brand column detected.');

    const standardizedRecords = rows.map((row, idx) => {
      const rawPrice = priceKey ? Number(row[priceKey]) : 0;
      const price = isNaN(rawPrice) || rawPrice < 0 ? 0 : Math.round(rawPrice * 100) / 100;

      const rawQty = qtyKey ? Number(row[qtyKey]) : 0;
      const stock_quantity = isNaN(rawQty) || rawQty < 0 ? 0 : Math.round(rawQty);

      const brand = brandKey && row[brandKey] ? String(row[brandKey]).trim() : 'Unbranded';
      const name = nameKey && row[nameKey] ? String(row[nameKey]).trim() : (brand !== 'Unbranded' ? `${brand} Item #${idx + 1}` : `Item #${idx + 1}`);
      const color = catKey && row[catKey] ? String(row[catKey]).trim() : 'Standard';
      const size = sizeKey && row[sizeKey] ? String(row[sizeKey]).trim() : 'Standard';
      const id = idKey && row[idKey] ? Number(row[idKey]) : idx + 1;

      return {
        t_shirt_id: isNaN(id) ? idx + 1 : id,
        brand,
        color,
        size,
        price,
        stock_quantity,
        name,
        ...row
      };
    });

    const totalUnits = standardizedRecords.reduce((acc, r) => acc + (Number(r.stock_quantity) || 0), 0);
    const totalValue = Math.round(standardizedRecords.reduce((acc, r) => acc + ((Number(r.price) || 0) * (Number(r.stock_quantity) || 0)), 0) * 100) / 100;
    const averagePrice = standardizedRecords.length > 0 ? Math.round((standardizedRecords.reduce((acc, r) => acc + (Number(r.price) || 0), 0) / standardizedRecords.length) * 100) / 100 : 0;
    const sampleBrands = Array.from(new Set(standardizedRecords.map(r => r.brand).filter(b => b && b !== 'Unbranded'))).slice(0, 5);

    return {
      valid: true,
      fileType: 'csv',
      fileName,
      totalRows: standardizedRecords.length,
      columns,
      previewRows: standardizedRecords.slice(0, 10),
      calculatedMetrics: {
        totalUnits,
        totalValue,
        averagePrice,
        sampleBrands
      },
      records: standardizedRecords,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private async previewPDF(pdfBase64: string, fileName: string): Promise<ImportPreviewResult> {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        valid: false,
        fileType: 'pdf',
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: 'PDF AI extraction requires a valid GEMINI_API_KEY. Please provide a CSV file or configure the API key.'
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a high-precision document extraction engine for RetailIQ.
Analyze this attached PDF document (retail inventory report, supplier invoice, product catalog, or price sheet).
Extract all product items, inventory lines, or merchandise rows as a structured JSON object.

Rules:
1. For each item extract:
   - "brand": string (Brand or Supplier name)
   - "name": string (Item name or description)
   - "category": string (e.g. Apparel, Footwear, Electronics, Supplies)
   - "size": string (e.g. S, M, L, XL or SKU code)
   - "price": number (Unit price)
   - "stock_quantity": number (Quantity in stock, ordered, or delivered)
   - "discount_pct": number (optional discount percentage, default 0)
2. Only extract actual product lines present in the document. Do not invent products that are not mentioned.
3. Return an array of extracted products.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanBase64
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentTitle: { type: Type.STRING },
              totalItemsCount: { type: Type.INTEGER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    brand: { type: Type.STRING },
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    size: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    stock_quantity: { type: Type.INTEGER },
                    discount_pct: { type: Type.NUMBER }
                  },
                  required: ['name', 'price', 'stock_quantity']
                }
              }
            },
            required: ['items']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        return {
          valid: false,
          fileType: 'pdf',
          fileName,
          totalRows: 0,
          columns: [],
          previewRows: [],
          calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
          records: [],
          error: 'Could not detect any inventory product rows in this PDF document. Please verify the document contains product listings with price and quantity, or upload a CSV file.'
        };
      }

      const extracted = parsed.items;
      const standardizedRecords = extracted.map((p: any, idx: number) => ({
        t_shirt_id: idx + 1,
        brand: p.brand || 'Catalog Product',
        name: p.name || `Product #${idx + 1}`,
        color: p.category || 'Standard',
        size: p.size || 'Standard',
        price: Math.max(0, Number(p.price) || 0),
        stock_quantity: Math.max(0, Number(p.stock_quantity) || 0),
        discount_pct: Number(p.discount_pct) || 0
      }));

      const totalUnits = standardizedRecords.reduce((acc: number, r: any) => acc + r.stock_quantity, 0);
      const totalValue = Math.round(standardizedRecords.reduce((acc: number, r: any) => acc + (r.price * r.stock_quantity), 0) * 100) / 100;
      const averagePrice = standardizedRecords.length > 0 ? Math.round((standardizedRecords.reduce((acc: number, r: any) => acc + r.price, 0) / standardizedRecords.length) * 100) / 100 : 0;
      const sampleBrands = Array.from(new Set(standardizedRecords.map((r: any) => r.brand))).slice(0, 5) as string[];

      return {
        valid: true,
        fileType: 'pdf',
        fileName,
        totalRows: standardizedRecords.length,
        columns: ['brand', 'name', 'color', 'size', 'price', 'stock_quantity'],
        previewRows: standardizedRecords.slice(0, 10),
        calculatedMetrics: {
          totalUnits,
          totalValue,
          averagePrice,
          sampleBrands
        },
        records: standardizedRecords
      };
    } catch (err: any) {
      return {
        valid: false,
        fileType: 'pdf',
        fileName,
        totalRows: 0,
        columns: [],
        previewRows: [],
        calculatedMetrics: { totalUnits: 0, totalValue: 0, averagePrice: 0, sampleBrands: [] },
        records: [],
        error: `PDF extraction error: ${err.message || 'Failed to parse PDF document'}`
      };
    }
  }

  /**
   * Commit verified records to user inventory store, datasetManager, and optionally MySQL
   */
  public async confirmImport(
    userId: string,
    fileType: 'csv' | 'pdf',
    fileName: string,
    records: Record<string, any>[],
    saveToDatabase: boolean = false
  ): Promise<{ summary: ImportedDatasetSummary; savedToDatabase: boolean; dbMessage?: string }> {
    if (!records || records.length === 0) {
      throw new Error('No records to import.');
    }

    // 1. Update user inventory store
    userInventoryStore.setDataSource(
      userId,
      {
        type: fileType,
        name: fileName,
        totalRecords: records.length,
        isLive: false
      },
      records
    );

    // 2. Update dataset manager
    await datasetManager.setDataset(userId, fileType, fileName, records, false);

    // 3. Optional: Save to connected database if requested
    let savedToDatabase = false;
    let dbMessage = '';
    if (saveToDatabase && mysqlService.isLive()) {
      try {
        const insertRes = await mysqlService.insertRecords(records, 'products');
        savedToDatabase = insertRes.success;
        dbMessage = insertRes.success 
          ? `Persisted ${insertRes.insertedCount} records to connected MySQL "products" table.`
          : `Database insertion warning: ${insertRes.message}`;
      } catch (dbErr: any) {
        dbMessage = `Could not save to MySQL: ${dbErr.message}`;
      }
    }

    const columns = Object.keys(records[0] || {});
    const totalUnits = records.reduce((acc, r) => acc + (Number(r.stock_quantity) || 0), 0);
    const totalValue = Math.round(records.reduce((acc, r) => acc + ((Number(r.price) || 0) * (Number(r.stock_quantity) || 0)), 0) * 100) / 100;
    const brands = Array.from(new Set(records.map(r => r.brand).filter(Boolean)));

    const summary: ImportedDatasetSummary = {
      sourceType: fileType,
      fileName,
      rowCount: records.length,
      columns,
      sampleRows: records.slice(0, 5),
      importedAt: new Date().toISOString(),
      metadata: {
        totalUnits,
        totalValue,
        detectedBrands: brands.slice(0, 6) as string[],
        notes: `Imported ${records.length} records from ${fileName}`
      }
    };

    this.currentSummary = summary;
    this.activeSourceType = fileType;

    return {
      summary,
      savedToDatabase,
      dbMessage
    };
  }

  public resetToMySQL(): void {
    this.activeSourceType = 'mysql';
    this.currentSummary = null;
  }
}

export const fileImporterManager = new FileImporterManager();
