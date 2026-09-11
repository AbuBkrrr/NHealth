import React, { useState } from 'react';
import axios from 'axios';

export const OnboardingFlow: React.FC<{ userId: string; role: string; onComplete: () => void }> = ({
  userId,
  role,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const steps = {
    patient: [
      'Medical History',
      'Allergies',
      'Current Medications',
      'Emergency Contact',
      'Insurance Details',
      'Profile Photo',
    ],
    doctor: [
      'License Verification',
      'Specialization',
      'Consultation Fee',
      'Available Hours',
      'Professional Bio',
      'Profile Photo',
      'Bank Details',
    ],
    pharmacy: [
      'Pharmacy Details',
      'License Verification',
      'Operating Hours',
      'Delivery Setup',
      'Bank Details',
    ],
  };

  const currentSteps = steps[role as keyof typeof steps] || [];
  const progress = (currentStep / currentSteps.length) * 100;

  const handleNext = async () => {
    setLoading(true);
    try {
      // Validate current step data
      if (!formData[currentStep]) {
        throw new Error('Please fill in all required fields');
      }

      // If last step, submit all data
      if (currentStep === currentSteps.length) {
        const endpoint = `/api/onboarding/${role}/complete`;
        await axios.post(endpoint, formData);
        onComplete();
      } else {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [currentStep]: { ...formData[currentStep], [field]: value },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to N-Health</h1>
          <p className="text-gray-600">Complete your profile to get started</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white rounded-lg p-6 shadow-md">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">
              Step {currentStep} of {currentSteps.length}
            </span>
            <span className="text-sm font-semibold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex justify-between">
          {currentSteps.map((step, i) => (
            <div
              key={i}
              className={`flex-1 text-center pb-2 border-b-2 ${
                i + 1 <= currentStep ? 'border-blue-600' : 'border-gray-300'
              }`}
            >
              <div
                className={`inline-block w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 ${
                  i + 1 <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {i + 1}
              </div>
              <p className="text-xs text-gray-600 hidden sm:block">{step}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <RenderStepContent
            role={role}
            step={currentStep}
            data={formData[currentStep]}
            onChange={handleInputChange}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : currentStep === currentSteps.length ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== STEP CONTENT ====================

const RenderStepContent = ({
  role,
  step,
  data = {},
  onChange,
}: {
  role: string;
  step: number;
  data: any;
  onChange: (field: string, value: any) => void;
}) => {
  if (role === 'patient') {
    return <PatientStepContent step={step} data={data} onChange={onChange} />;
  } else if (role === 'doctor') {
    return <DoctorStepContent step={step} data={data} onChange={onChange} />;
  } else if (role === 'pharmacy') {
    return <PharmacyStepContent step={step} data={data} onChange={onChange} />;
  }
  return null;
};

// ==================== PATIENT ONBOARDING ====================

const PatientStepContent = ({
  step,
  data,
  onChange,
}: {
  step: number;
  data: any;
  onChange: (field: string, value: any) => void;
}) => {
  switch (step) {
    case 1:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Medical History</h2>
          <textarea
            placeholder="Describe any past or chronic health conditions..."
            value={data?.history || ''}
            onChange={(e) => onChange('history', e.target.value)}
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none h-32"
          />
        </div>
      );
    case 2:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Allergies</h2>
          <input
            type="text"
            placeholder="Enter allergies (comma-separated)"
            value={data?.allergies || ''}
            onChange={(e) => onChange('allergies', e.target.value)}
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-600 mt-2">Example: Penicillin, Nuts, Dairy</p>
        </div>
      );
    case 3:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Current Medications</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Medication name"
              value={data?.medName || ''}
              onChange={(e) => onChange('medName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Dosage (e.g., 500mg)"
              value={data?.dosage || ''}
              onChange={(e) => onChange('dosage', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Frequency (e.g., Twice daily)"
              value={data?.frequency || ''}
              onChange={(e) => onChange('frequency', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          </div>
        </div>
      );
    case 4:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Emergency Contact</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Full name"
              value={data?.contactName || ''}
              onChange={(e) => onChange('contactName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={data?.contactPhone || ''}
              onChange={(e) => onChange('contactPhone', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <select
              value={data?.relationship || ''}
              onChange={(e) => onChange('relationship', e.target.value)}
              className="w-full border p-3 rounded-lg"
            >
              <option>Select relationship</option>
              <option>Spouse</option>
              <option>Parent</option>
              <option>Sibling</option>
              <option>Friend</option>
            </select>
          </div>
        </div>
      );
    case 5:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Insurance Details</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Insurance provider"
              value={data?.provider || ''}
              onChange={(e) => onChange('provider', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="NHIS number"
              value={data?.nhisNumber || ''}
              onChange={(e) => onChange('nhisNumber', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          </div>
        </div>
      );
    case 6:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Profile Photo</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onChange('photo', e.target.files?.[0])}
            className="w-full border p-3 rounded-lg"
          />
        </div>
      );
  }
};

// ==================== DOCTOR ONBOARDING ====================

const DoctorStepContent = ({
  step,
  data,
  onChange,
}: {
  step: number;
  data: any;
  onChange: (field: string, value: any) => void;
}) => {
  switch (step) {
    case 1:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">License Verification</h2>
          <input
            type="text"
            placeholder="MDCN/PCN License number"
            value={data?.licenseNumber || ''}
            onChange={(e) => onChange('licenseNumber', e.target.value)}
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-600 mt-2">Your license will be verified with regulatory bodies</p>
        </div>
      );
    case 2:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Specialization</h2>
          <select
            value={data?.specialization || ''}
            onChange={(e) => onChange('specialization', e.target.value)}
            className="w-full border p-3 rounded-lg"
          >
            <option>Select specialization</option>
            <option>General Practice</option>
            <option>Cardiology</option>
            <option>Pediatrics</option>
            <option>Surgery</option>
            <option>Psychiatry</option>
            <option>Dermatology</option>
          </select>
        </div>
      );
    case 3:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Consultation Fee</h2>
          <div className="flex items-center">
            <span className="text-2xl mr-2">₦</span>
            <input
              type="number"
              placeholder="0"
              value={data?.fee || ''}
              onChange={(e) => onChange('fee', e.target.value)}
              className="flex-1 border p-3 rounded-lg"
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">Per consultation</p>
        </div>
      );
    case 4:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Available Hours</h2>
          <p className="text-sm text-gray-600 mb-4">Add your working days and hours</p>
          {/* Would use a scheduling component here */}
          <input type="text" placeholder="Add availability..." className="w-full border p-3 rounded-lg" />
        </div>
      );
    case 5:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Professional Bio</h2>
          <textarea
            placeholder="Tell patients about your experience..."
            value={data?.bio || ''}
            onChange={(e) => onChange('bio', e.target.value)}
            className="w-full border p-3 rounded-lg resize-none h-32"
          />
        </div>
      );
    case 6:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Profile Photo</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onChange('photo', e.target.files?.[0])}
            className="w-full border p-3 rounded-lg"
          />
        </div>
      );
    case 7:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Bank Details</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Account name"
              value={data?.accountName || ''}
              onChange={(e) => onChange('accountName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Account number"
              value={data?.accountNumber || ''}
              onChange={(e) => onChange('accountNumber', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Bank name"
              value={data?.bankName || ''}
              onChange={(e) => onChange('bankName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          </div>
        </div>
      );
  }
};

// ==================== PHARMACY ONBOARDING ====================

const PharmacyStepContent = ({
  step,
  data,
  onChange,
}: {
  step: number;
  data: any;
  onChange: (field: string, value: any) => void;
}) => {
  switch (step) {
    case 1:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pharmacy Details</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Pharmacy name"
              value={data?.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Address"
              value={data?.address || ''}
              onChange={(e) => onChange('address', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={data?.phone || ''}
              onChange={(e) => onChange('phone', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          </div>
        </div>
      );
    case 2:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">License Verification</h2>
          <input
            type="text"
            placeholder="NAFDAC License number"
            value={data?.licenseNumber || ''}
            onChange={(e) => onChange('licenseNumber', e.target.value)}
            className="w-full border p-3 rounded-lg"
          />
          <p className="text-sm text-gray-600 mt-2">Your license will be verified with NAFDAC</p>
        </div>
      );
    case 3:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Operating Hours</h2>
          <p className="text-sm text-gray-600 mb-4">When are you open?</p>
          {/* Scheduling component would go here */}
          <input type="text" placeholder="Add hours..." className="w-full border p-3 rounded-lg" />
        </div>
      );
    case 4:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Delivery Setup</h2>
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={data?.deliveryEnabled || false}
              onChange={(e) => onChange('deliveryEnabled', e.target.checked)}
              className="mr-3"
            />
            <span>Enable delivery service</span>
          </label>
          {data?.deliveryEnabled && (
            <input
              type="number"
              placeholder="Delivery radius (km)"
              value={data?.radius || ''}
              onChange={(e) => onChange('radius', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          )}
        </div>
      );
    case 5:
      return (
        <div>
          <h2 className="text-2xl font-bold mb-4">Bank Details</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Account name"
              value={data?.accountName || ''}
              onChange={(e) => onChange('accountName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Account number"
              value={data?.accountNumber || ''}
              onChange={(e) => onChange('accountNumber', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="text"
              placeholder="Bank name"
              value={data?.bankName || ''}
              onChange={(e) => onChange('bankName', e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
          </div>
        </div>
      );
  }
};

export default OnboardingFlow;
