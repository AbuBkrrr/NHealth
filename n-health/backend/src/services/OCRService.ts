import Tesseract from 'tesseract.js';
import axios from 'axios';

interface OCRResult {
  text: string;
  confidence: number;
  data: any;
  receiptData?: {
    date?: string;
    total?: number;
    items?: Array<{ name: string; price: number; quantity: number }>;
  };
}

export class OCRService {
  private static instance: OCRService;

  private constructor() {}

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Extract text from receipt/invoice image
   */
  async extractReceiptText(imagePath: string): Promise<OCRResult> {
    try {
      const result = await Tesseract.recognize(imagePath, 'eng');
      
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        data: result.data,
        receiptData: this.parseReceiptData(result.data.text),
      };
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR processing failed: ${error}`);
    }
  }

  /**
   * Extract text from Base64 image
   */
  async extractFromBase64(base64: string): Promise<OCRResult> {
    try {
      const result = await Tesseract.recognize(base64, 'eng');
      
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        data: result.data,
        receiptData: this.parseReceiptData(result.data.text),
      };
    } catch (error) {
      console.error('OCR extraction from base64 failed:', error);
      throw new Error(`OCR processing failed: ${error}`);
    }
  }

  /**
   * Parse receipt data from extracted text
   */
  private parseReceiptData(text: string) {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Try to extract date
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    const dateMatch = text.match(datePattern);
    
    // Try to extract total/amount
    const amountPattern = /(?:total|amount|sum|subtotal)[\s:]*[\$€£]?([\d,]+\.?\d*)/gi;
    const amounts = [...text.matchAll(amountPattern)];
    const total = amounts.length > 0 ? parseFloat(amounts[amounts.length - 1][1].replace(/,/g, '')) : null;
    
    // Try to extract items
    const items = this.extractItems(text);

    return {
      date: dateMatch ? dateMatch[0] : null,
      total: total,
      items: items,
    };
  }

  /**
   * Extract line items from receipt text
   */
  private extractItems(text: string): Array<{ name: string; price: number; quantity: number }> {
    const items: Array<{ name: string; price: number; quantity: number }> = [];
    
    // Pattern: quantity x item_name ... price
    const itemPattern = /(\d+)\s*x?\s+([a-zA-Z\s]+)\s+([\d,]+\.?\d*)/g;
    let match;
    
    while ((match = itemPattern.exec(text)) !== null) {
      items.push({
        quantity: parseInt(match[1]),
        name: match[2].trim(),
        price: parseFloat(match[3].replace(/,/g, '')),
      });
    }
    
    return items;
  }

  /**
   * Send receipt to backend for storage
   */
  async saveReceipt(ocrResult: OCRResult, metadata: any = {}) {
    try {
      const response = await axios.post('/api/receipts', {
        extractedText: ocrResult.text,
        confidence: ocrResult.confidence,
        receiptData: ocrResult.receiptData,
        metadata,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to save receipt:', error);
      throw error;
    }
  }
}

export default OCRService.getInstance();
