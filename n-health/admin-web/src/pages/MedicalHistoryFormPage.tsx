// ==================== MEDICAL HISTORY FORM PAGE - PRODUCTION COMPLETE ====================

import React, { useState, useEffect } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

interface MedicalHistoryFormPageProps {
  userId: string;
  onSuccess?: () => void;
}

export const MedicalHistoryFormPage: React.FC<MedicalHistoryFormPageProps> = ({ userId, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    medicalHistory: '',
    familyHistory: '',
    lifestyle: {
      smoking: false,
      alcohol: false,
      exercise: 'none',
      diet: 'balanced',
      stressLevel: 5,
    },
  });

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/patient/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data.data);
      setFormData({
        medicalHistory: data.data.medicalHistory || '',
        familyHistory: data.data.familyHistory || '',
        lifestyle: data.data.lifestyle || {
          smoking: false,
          alcohol: false,
          exercise: 'none',
          diet: 'balanced',
          stressLevel: 5,
        },
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/patient/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save');
      setSuccess('Medical history updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical History</h1>
        <p className="text-gray-600 mb-6">Maintain your complete medical background</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X size={20} />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-green-700">✓ {success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          {/* MEDICAL HISTORY SECTION */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Medical Conditions</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              List any chronic conditions, past surgeries, or ongoing treatments
            </label>
            <textarea
              value={formData.medicalHistory}
              onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
              placeholder="E.g., Type 2 Diabetes (diagnosed 2015), Hypertension (on medication), Appendectomy (2010)"
              className="w-full h-40 border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
            />
          </section>

          {/* FAMILY HISTORY SECTION */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Family Medical History</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diseases that run in your family
            </label>
            <textarea
              value={formData.familyHistory}
              onChange={(e) => setFormData({ ...formData, familyHistory: e.target.value })}
              placeholder="E.g., Father: Heart disease, Mother: Diabetes, Sister: Breast cancer"
              className="w-full h-40 border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
            />
          </section>

          {/* LIFESTYLE SECTION */}
          <section className="border-t pt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Lifestyle Information</h2>

            {/* SMOKING */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.lifestyle.smoking}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, smoking: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-gray-700 font-medium">I currently smoke or have smoked</span>
              </label>
            </div>

            {/* ALCOHOL */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.lifestyle.alcohol}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, alcohol: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-gray-700 font-medium">I consume alcohol regularly</span>
              </label>
            </div>

            {/* EXERCISE */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Exercise Frequency</label>
              <select
                value={formData.lifestyle.exercise}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lifestyle: { ...formData.lifestyle, exercise: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
              >
                <option value="none">None - Sedentary lifestyle</option>
                <option value="light">Light - 1-2 days per week</option>
                <option value="moderate">Moderate - 3-4 days per week</option>
                <option value="vigorous">Vigorous - 5+ days per week</option>
              </select>
            </div>

            {/* DIET */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Diet Type</label>
              <select
                value={formData.lifestyle.diet}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lifestyle: { ...formData.lifestyle, diet: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
              >
                <option value="balanced">Balanced diet</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="keto">Keto/Low-carb</option>
                <option value="paleo">Paleo</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* STRESS LEVEL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Stress Level: <span className="text-blue-600 font-bold">{formData.lifestyle.stressLevel}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.lifestyle.stressLevel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lifestyle: { ...formData.lifestyle, stressLevel: parseInt(e.target.value) },
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Low Stress</span>
                <span>High Stress</span>
              </div>
            </div>
          </section>

          {/* ACTION BUTTONS */}
          <div className="flex gap-4 pt-8 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={loadProfile}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalHistoryFormPage;
