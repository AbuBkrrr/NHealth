# N-Health Local Development Setup - New Features

## 🎯 Features Built

### 1. **Receipt/Invoice OCR**
- **File**: `backend/src/services/OCRService.ts`
- **UI**: `admin-web/src/pages/ReceiptOCRPage.tsx`
- Extract text from receipt images using Tesseract.js
- Parse date, total amount, and line items automatically
- Save extracted data to backend
- Confidence scoring

### 2. **Barcode & Inventory Scanner**
- **File**: `backend/src/services/BarcodeService.ts`
- **UI**: `admin-web/src/pages/BarcodeScannerPage.tsx`
- Generate barcodes (CODE128, EAN13, etc) for SKUs
- Generate QR codes for inventory tracking
- Real-time inventory tracking (add/remove items)
- Low stock alerts
- Batch inventory import

### 3. **Offline Support**
- **File**: `backend/src/services/OfflineService.ts`
- Uses Dexie.js (IndexedDB wrapper)
- Queue operations when offline
- Auto-sync when back online
- Storage stats and monitoring
- Network status detection

### 4. **Native Desktop App (Electron)**
- **File**: `backend/src/main.ts` (Electron main process)
- **File**: `backend/src/preload.ts` (IPC bridge)
- OCR processing on desktop
- Barcode generation
- Offline-first architecture
- File dialogs
- Auto-updates ready

---

## 📦 Installation & Setup

### Prerequisites
```bash
Node.js 20+
npm 10+
```

### 1. Install Dependencies

Backend:
```bash
cd backend
npm install
```

Admin Web:
```bash
cd admin-web
npm install
```

### 2. Database Setup

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Run Development Server

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd admin-web
npm run dev
```

### 4. Access Web App
```
http://localhost:5173
```

---

## 🖥️ Desktop App Development

### Run Desktop App (Electron)

```bash
cd backend
npm run electron
```

This will:
1. Build TypeScript
2. Launch Electron with dev tools
3. Load your Vite dev server (http://localhost:5173)

### Build Desktop App

```bash
npm run electron:build
```

Creates:
- `dist/N-Health Setup.exe` (Windows installer)
- `dist/N-Health.exe` (Portable)

---

## 🧪 Test Each Feature Locally

### Test OCR

1. Go to `/receipt-ocr` in web app
2. Upload a receipt image or take a photo
3. Click "Extract Text"
4. Review parsed data (date, total, items)
5. Click "Save Receipt"

**Desktop App**: Uses Electron IPC for faster processing

### Test Barcode Scanner

1. Go to `/barcode-scanner`
2. **Generate**: Enter SKU → Click "Generate Barcode" / "Generate QR"
3. **Download** the generated image
4. **Track**: Scan barcode (or enter manually) → Qty → Add/Remove
5. **Alerts**: Check low stock items

### Test Offline Support

1. Open DevTools (F12)
2. Go to Network tab
3. Set to "Offline" mode
4. Try to save a receipt or track inventory
5. You'll see "Queued" status
6. Go back "Online"
7. Data automatically syncs

**Desktop App**: Detects network automatically

### Test Desktop App Features

```javascript
// In Electron dev console, you can call:

// OCR
await window.nhealth.ocr.extractBase64(base64String)
await window.nhealth.ocr.saveReceipt(result)

// Barcode
await window.nhealth.barcode.generate('SKU123')
await window.nhealth.barcode.generateQR('data')
await window.nhealth.barcode.track('BARCODE', 5, 'add')

// Offline
await window.nhealth.offline.getPending()
await window.nhealth.offline.sync()
await window.nhealth.offline.getStats()

// File Dialog
await window.nhealth.dialog.selectFile()
await window.nhealth.dialog.selectDirectory()
```

---

## 🔌 Backend API Endpoints (Ready to Implement)

### OCR
```
POST /api/ocr/extract
  body: { imagePath or base64 }
  returns: OCRResult

POST /api/receipts
  body: { extractedText, confidence, receiptData }
  returns: Receipt
```

### Barcode
```
POST /api/barcode/generate
  body: { sku, format }
  returns: { barcode (base64) }

POST /api/barcode/generate-qr
  body: { data }
  returns: { qr (base64) }

POST /api/inventory/track
  body: { barcode, quantity, action }
  returns: InventoryUpdate

GET /api/inventory/alerts
  returns: InventoryItem[]

POST /api/inventory/batch-import
  body: { items[] }
  returns: ImportResult
```

### Offline
```
GET /api/sync/status
  returns: { pending, synced, lastSync }
```

---

## 📝 Database Schema (Prisma)

Add to `backend/prisma/schema.prisma`:

```prisma
model Receipt {
  id          String    @id @default(cuid())
  extractedText String
  confidence  Float
  date        DateTime?
  total       Float?
  items       Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
  userId      String
}

model InventoryItem {
  id          String    @id @default(cuid())
  sku         String    @unique
  barcode     String    @unique
  name        String
  quantity    Int
  price       Float
  reorderLevel Int
  lastUpdated DateTime  @updatedAt
}

model InventoryLog {
  id        String    @id @default(cuid())
  itemId    String
  action    String    // "add", "remove", "scanned"
  quantity  Int
  timestamp DateTime  @default(now())
}
```

---

## 🚀 Next Steps

1. **Implement Backend Routes**
   - Create controllers in `backend/src/controllers/`
   - Create routes in `backend/src/routes/`
   - Wire services to routes

2. **Add Database Models**
   - Update Prisma schema
   - Run migrations

3. **Connect Frontend to Backend**
   - Replace API calls with real endpoints
   - Remove axios mock responses

4. **Test Integration**
   - OCR → Receipt → Database
   - Barcode → Inventory → Database
   - Offline queue → Sync

5. **Build & Deploy**
   - Backend to Render
   - Admin-web to Vercel
   - Desktop app as `.exe`

---

## 📚 Library Docs

- [Tesseract.js](https://github.com/naptha/tesseract.js) - OCR
- [BWIP-JS](https://github.com/metafloor/bwip-js) - Barcode generation
- [Dexie](https://dexie.org/) - IndexedDB
- [Electron](https://www.electronjs.org/) - Desktop app
- [Electron Builder](https://www.electron.build/) - Packaging

---

## 💡 Tips

- OCR works best with clear, well-lit images
- Barcode scanner can be enhanced with `html5-qrcode` library
- Offline mode uses browser's IndexedDB (persists across sessions)
- Desktop app runs same code as web app via Electron
- All services are singleton patterns (reusable across app)

---

Run `git push` when ready to commit all changes!
