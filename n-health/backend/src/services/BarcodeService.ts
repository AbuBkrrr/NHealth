import jsbarcode from 'jsbarcode';
import * as bwipjs from 'bwip-js';

interface BarcodeData {
  code: string;
  type: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'QR' | string;
  format: string;
  rawValue: string;
}

interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  reorderLevel: number;
}

export class BarcodeService {
  private static instance: BarcodeService;

  private constructor() {}

  static getInstance(): BarcodeService {
    if (!BarcodeService.instance) {
      BarcodeService.instance = new BarcodeService();
    }
    return BarcodeService.instance;
  }

  /**
   * Parse barcode from image
   */
  async parseBarcodeFromImage(imagePath: string): Promise<BarcodeData> {
    try {
      // This would use a barcode detection library like jsQR or pino-barcode
      // For now, returning a placeholder that can be extended
      throw new Error('Barcode detection requires external library integration');
    } catch (error) {
      console.error('Barcode parsing failed:', error);
      throw error;
    }
  }

  /**
   * Generate barcode for SKU
   */
  async generateBarcode(
    sku: string,
    options: { format?: string; width?: number; height?: number } = {}
  ): Promise<string> {
    try {
      const format = options.format || 'code128';
      const bwipOptions: any = {
        bcid: format,
        text: sku,
        scale: 3,
        height: options.height || 15,
        includetext: true,
        textxalign: 'center',
      };

      const png = await bwipjs.toBuffer(bwipOptions);
      return png.toString('base64');
    } catch (error) {
      console.error('Barcode generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for inventory tracking
   */
  async generateQRCode(
    data: string,
    options: { size?: number } = {}
  ): Promise<string> {
    try {
      const qrOptions = {
        bcid: 'qrcode',
        text: data,
        scale: 8,
        size: options.size || 10,
      };

      const png = await bwipjs.toBuffer(qrOptions);
      return png.toString('base64');
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw error;
    }
  }

  /**
   * Track inventory item by barcode
   */
  async trackInventory(barcode: string, quantity: number = 1, action: 'add' | 'remove' | 'update' = 'add') {
    try {
      // This would call the backend API to update inventory
      const response = await fetch('/api/inventory/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          quantity,
          action,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Inventory tracking failed');
      return response.json();
    } catch (error) {
      console.error('Inventory tracking failed:', error);
      throw error;
    }
  }

  /**
   * Batch import inventory from CSV with barcodes
   */
  async importInventoryBatch(csvData: string[]): Promise<InventoryItem[]> {
    try {
      const items: InventoryItem[] = [];

      for (const row of csvData) {
        const [sku, name, quantity, price, reorderLevel] = row.split(',');
        
        items.push({
          sku: sku.trim(),
          name: name.trim(),
          quantity: parseInt(quantity),
          price: parseFloat(price),
          reorderLevel: parseInt(reorderLevel),
        });
      }

      // Send to backend for batch processing
      const response = await fetch('/api/inventory/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) throw new Error('Batch import failed');
      return response.json();
    } catch (error) {
      console.error('Batch import failed:', error);
      throw error;
    }
  }

  /**
   * Get inventory alert for low stock
   */
  async checkInventoryAlerts(): Promise<InventoryItem[]> {
    try {
      const response = await fetch('/api/inventory/alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    } catch (error) {
      console.error('Failed to check inventory alerts:', error);
      throw error;
    }
  }
}

export default BarcodeService.getInstance();
