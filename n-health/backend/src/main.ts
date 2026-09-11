import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import OCRService from '../services/OCRService';
import BarcodeService from '../services/BarcodeService';
import OfflineService from '../services/OfflineService';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../../admin-web/dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when app is ready
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// =========================
// IPC Handlers for OCR
// =========================

ipcMain.handle('ocr:extract-receipt', async (event, imagePath: string) => {
  try {
    const result = await OCRService.extractReceiptText(imagePath);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('ocr:extract-base64', async (event, base64: string) => {
  try {
    const result = await OCRService.extractFromBase64(base64);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('ocr:save-receipt', async (event, ocrResult: any, metadata: any) => {
  try {
    const result = await OCRService.saveReceipt(ocrResult, metadata);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// IPC Handlers for Barcode
// =========================

ipcMain.handle('barcode:generate', async (event, sku: string, format: string) => {
  try {
    const barcode = await BarcodeService.generateBarcode(sku, { format });
    return { success: true, data: barcode };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('barcode:generate-qr', async (event, data: string) => {
  try {
    const qrcode = await BarcodeService.generateQRCode(data);
    return { success: true, data: qrcode };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('barcode:track', async (event, barcode: string, quantity: number, action: string) => {
  try {
    const result = await BarcodeService.trackInventory(barcode, quantity, action as any);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// IPC Handlers for Offline
// =========================

ipcMain.handle('offline:queue-operation', async (event, type: string, data: any, endpoint: string) => {
  try {
    const id = await OfflineService.queueOperation(type as any, data, endpoint);
    return { success: true, id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('offline:get-pending', async (event) => {
  try {
    const pending = await OfflineService.getPendingOperations();
    return { success: true, data: pending };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('offline:sync', async (event) => {
  try {
    await OfflineService.syncOfflineData();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('offline:is-online', (event) => {
  return OfflineService.isCurrentlyOnline();
});

ipcMain.handle('offline:stats', async (event) => {
  try {
    const stats = await OfflineService.getStorageStats();
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// File Dialog Handlers
// =========================

ipcMain.handle('dialog:select-file', async (event, filters: any) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:select-directory', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  return result.canceled ? null : result.filePaths[0];
});
