import { contextBridge, ipcRenderer } from 'electron';

// Expose OCR functionality
const ocr = {
  extractReceipt: (imagePath: string) => ipcRenderer.invoke('ocr:extract-receipt', imagePath),
  extractBase64: (base64: string) => ipcRenderer.invoke('ocr:extract-base64', base64),
  saveReceipt: (ocrResult: any, metadata: any) =>
    ipcRenderer.invoke('ocr:save-receipt', ocrResult, metadata),
};

// Expose Barcode functionality
const barcode = {
  generate: (sku: string, format?: string) =>
    ipcRenderer.invoke('barcode:generate', sku, format || 'code128'),
  generateQR: (data: string) => ipcRenderer.invoke('barcode:generate-qr', data),
  track: (barcode: string, quantity?: number, action?: string) =>
    ipcRenderer.invoke('barcode:track', barcode, quantity || 1, action || 'add'),
};

// Expose Offline functionality
const offline = {
  queueOperation: (type: string, data: any, endpoint: string) =>
    ipcRenderer.invoke('offline:queue-operation', type, data, endpoint),
  getPending: () => ipcRenderer.invoke('offline:get-pending'),
  sync: () => ipcRenderer.invoke('offline:sync'),
  isOnline: () => ipcRenderer.invoke('offline:is-online'),
  getStats: () => ipcRenderer.invoke('offline:stats'),
};

// Expose file dialog
const dialog = {
  selectFile: (filters?: any) => ipcRenderer.invoke('dialog:select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
};

contextBridge.exposeInMainWorld('nhealth', {
  ocr,
  barcode,
  offline,
  dialog,
  version: '1.0.0',
});

// Type definitions for TypeScript
declare global {
  interface Window {
    nhealth: {
      ocr: typeof ocr;
      barcode: typeof barcode;
      offline: typeof offline;
      dialog: typeof dialog;
      version: string;
    };
  }
}
