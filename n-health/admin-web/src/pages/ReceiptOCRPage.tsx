import React, { useState } from 'react';
import axios from 'axios';

interface OCRResult {
  text: string;
  confidence: number;
  receiptData?: {
    date?: string;
    total?: number;
    items?: Array<{ name: string; price: number; quantity: number }>;
  };
}

export const ReceiptOCRPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = async () => {
    if (!selectedImage) {
      setError('Please select an image');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      // For desktop app, use Electron IPC
      if (window.nhealth?.ocr) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          const response = await window.nhealth.ocr.extractBase64(base64);
          if (response.success) {
            setResult(response.data);
          } else {
            setError(response.error);
          }
          setLoading(false);
        };
        reader.readAsDataURL(selectedImage);
      } else {
        // For web app, use API
        const response = await axios.post('/api/ocr/extract', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setResult(response.data);
      }
    } catch (err) {
      setError((err as Error).message || 'OCR processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReceipt = async () => {
    if (!result) return;

    try {
      if (window.nhealth?.ocr) {
        await window.nhealth.ocr.saveReceipt(result, {
          uploadedAt: new Date().toISOString(),
        });
      } else {
        await axios.post('/api/receipts', result);
      }
      setSelectedImage(null);
      setPreview('');
      setResult(null);
      setError('Receipt saved successfully!');
    } catch (err) {
      setError((err as Error).message || 'Failed to save receipt');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Receipt OCR Scanner</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <label className="block mb-4">
            <span className="text-lg font-semibold">Upload Receipt Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="mt-2 w-full"
            />
          </label>

          {preview && (
            <div className="mb-4">
              <img src={preview} alt="Preview" className="w-full rounded-lg" />
            </div>
          )}

          <button
            onClick={handleCapture}
            disabled={!selectedImage || loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Extract Text'}
          </button>
        </div>

        {/* Results Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          {error && <div className="text-red-600 mb-4">{error}</div>}

          {result && (
            <div>
              <h2 className="text-xl font-bold mb-4">Extracted Data</h2>

              {result.receiptData && (
                <div className="mb-4">
                  {result.receiptData.date && (
                    <p>
                      <strong>Date:</strong> {result.receiptData.date}
                    </p>
                  )}
                  {result.receiptData.total && (
                    <p>
                      <strong>Total:</strong> ${result.receiptData.total.toFixed(2)}
                    </p>
                  )}

                  {result.receiptData.items && result.receiptData.items.length > 0 && (
                    <div className="mt-4">
                      <strong>Items:</strong>
                      <table className="w-full mt-2 text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left">Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.receiptData.items.map((item, i) => (
                            <tr key={i} className="border-b">
                              <td>{item.name}</td>
                              <td className="text-center">{item.quantity}</td>
                              <td className="text-right">${item.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 text-sm text-gray-600">
                <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
              </div>

              <button
                onClick={handleSaveReceipt}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 mt-4"
              >
                Save Receipt
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Raw Text Display */}
      {result && (
        <div className="mt-6 bg-white border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-2">Raw OCR Text</h3>
          <div className="bg-gray-100 p-3 rounded max-h-48 overflow-y-auto text-sm font-mono">
            {result.text}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptOCRPage;
