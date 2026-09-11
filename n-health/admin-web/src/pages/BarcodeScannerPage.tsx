import React, { useState } from 'react';
import axios from 'axios';

interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  reorderLevel: number;
}

export const BarcodeScannerPage: React.FC = () => {
  const [scannedCode, setScannedCode] = useState<string>('');
  const [generatedBarcode, setGeneratedBarcode] = useState<string>('');
  const [generatedQR, setGeneratedQR] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [sku, setSku] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  const handleGenerateBarcode = async () => {
    if (!sku) {
      setError('Enter a SKU');
      return;
    }

    setLoading(true);
    try {
      if (window.nhealth?.barcode) {
        const response = await window.nhealth.barcode.generate(sku, 'code128');
        if (response.success) {
          setGeneratedBarcode(response.data);
        } else {
          setError(response.error);
        }
      } else {
        const response = await axios.post('/api/barcode/generate', { sku });
        setGeneratedBarcode(response.data.barcode);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!sku) {
      setError('Enter a SKU');
      return;
    }

    setLoading(true);
    try {
      if (window.nhealth?.barcode) {
        const response = await window.nhealth.barcode.generateQR(sku);
        if (response.success) {
          setGeneratedQR(response.data);
        } else {
          setError(response.error);
        }
      } else {
        const response = await axios.post('/api/barcode/generate-qr', { data: sku });
        setGeneratedQR(response.data.qr);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackInventory = async (action: 'add' | 'remove') => {
    if (!scannedCode) {
      setError('Scan or enter a barcode');
      return;
    }

    setLoading(true);
    try {
      if (window.nhealth?.barcode) {
        const response = await window.nhealth.barcode.track(scannedCode, quantity, action);
        if (response.success) {
          setScannedCode('');
          setQuantity(1);
          setError(`Inventory updated: ${action} ${quantity} unit(s)`);
        } else {
          setError(response.error);
        }
      } else {
        await axios.post('/api/inventory/track', { barcode: scannedCode, quantity, action });
        setScannedCode('');
        setQuantity(1);
        setError(`Inventory updated: ${action} ${quantity} unit(s)`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAlerts = async () => {
    setLoading(true);
    try {
      if (window.nhealth?.barcode) {
        const response = await axios.get('/api/inventory/alerts');
        setAlerts(response.data);
      } else {
        const response = await axios.get('/api/inventory/alerts');
        setAlerts(response.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Barcode & Inventory Scanner</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">📸 Quick Scan</h2>
          <input
            type="text"
            placeholder="Scan or enter barcode..."
            value={scannedCode}
            onChange={(e) => setScannedCode(e.target.value)}
            className="w-full border p-2 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          <div className="mb-3">
            <label className="block text-sm font-semibold mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleTrackInventory('add')}
              disabled={loading}
              className="bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              ➕ Add
            </button>
            <button
              onClick={() => handleTrackInventory('remove')}
              disabled={loading}
              className="bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              ➖ Remove
            </button>
          </div>
        </div>

        {/* Generate Section */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">🏷️ Generate</h2>
          <input
            type="text"
            placeholder="Enter SKU..."
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full border p-2 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleGenerateBarcode}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 mb-2"
          >
            Generate Barcode
          </button>

          <button
            onClick={handleGenerateQR}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            Generate QR Code
          </button>
        </div>

        {/* Alerts Section */}
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">🚨 Low Stock Alerts</h2>
          <button
            onClick={handleCheckAlerts}
            disabled={loading}
            className="w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700 disabled:bg-gray-400 mb-3"
          >
            Check Alerts
          </button>

          {alerts.length > 0 && (
            <div className="text-sm max-h-48 overflow-y-auto">
              {alerts.map((item) => (
                <div key={item.sku} className="border-b pb-2 mb-2">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-red-600">Stock: {item.quantity} / {item.reorderLevel}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generated Codes */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {generatedBarcode && (
          <div className="border rounded-lg p-6 bg-white text-center">
            <h3 className="font-bold mb-3">Generated Barcode</h3>
            <img
              src={`data:image/png;base64,${generatedBarcode}`}
              alt="Generated Barcode"
              className="mx-auto"
            />
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${generatedBarcode}`;
                link.download = `barcode-${sku}.png`;
                link.click();
              }}
              className="mt-3 bg-blue-600 text-white py-1 px-4 rounded hover:bg-blue-700"
            >
              Download
            </button>
          </div>
        )}

        {generatedQR && (
          <div className="border rounded-lg p-6 bg-white text-center">
            <h3 className="font-bold mb-3">Generated QR Code</h3>
            <img
              src={`data:image/png;base64,${generatedQR}`}
              alt="Generated QR"
              className="mx-auto w-48 h-48"
            />
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${generatedQR}`;
                link.download = `qr-${sku}.png`;
                link.click();
              }}
              className="mt-3 bg-purple-600 text-white py-1 px-4 rounded hover:bg-purple-700"
            >
              Download
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-blue-100 text-blue-800 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerPage;
