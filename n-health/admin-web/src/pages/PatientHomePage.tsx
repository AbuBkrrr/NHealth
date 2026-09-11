// ==================== PATIENT HOME PAGE - PRODUCTION COMPLETE ====================

import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Pill, Heart, TrendingUp, Plus } from 'lucide-react';

interface PatientHomePageProps {
  userId: string;
}

export const PatientHomePage: React.FC<PatientHomePageProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [vitals, setVitals] = useState<any>(null);
  const [allergies, setAllergies] = useState([]);
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => {
    loadPatientData();
  }, [userId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [profileRes, appointmentsRes, medicationsRes, allergiesRes, healthRecordsRes] = await Promise.all([
        fetch(`/api/patient/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`/api/patient/appointments/upcoming`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`/api/patient/medications`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`/api/patient/allergies`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`/api/patient/health-records`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);

      const profileData = await profileRes.json();
      const appointmentsData = await appointmentsRes.json();
      const medicationsData = await medicationsRes.json();
      const allergiesData = await allergiesRes.json();
      const healthRecordsData = await healthRecordsRes.json();

      if (!profileRes.ok) throw new Error(profileData.error || 'Failed to load profile');

      setProfile(profileData.data);
      setUpcomingAppointments(appointmentsData.data || []);
      setMedications(medicationsData.data || []);
      setAllergies(allergiesData.data || []);
      setRecentRecords((healthRecordsData.data || []).slice(0, 3));
      setVitals(profileData.data?.vitals);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load patient data:', err);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Welcome back, {profile?.firstName}! 👋</h1>
          <p className="text-gray-600 mt-2">Your health overview and quick access to services</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Upcoming Appointments" value={upcomingAppointments.length} icon={Calendar} color="blue" />
          <StatCard title="Active Medications" value={medications.length} icon={Pill} color="green" />
          <StatCard title="Allergies" value={allergies.length} icon={AlertCircle} color="red" />
          <StatCard title="Heart Rate" value={`${vitals?.pulse || '--'} bpm`} icon={Heart} color="purple" />
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - APPOINTMENTS & MEDICATIONS */}
          <div className="lg:col-span-2 space-y-6">
            {/* UPCOMING APPOINTMENTS */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar size={24} className="text-blue-600" />
                  Upcoming Appointments
                </h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Plus size={18} /> Book
                </button>
              </div>

              {upcomingAppointments.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No upcoming appointments</p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 3).map((apt: any) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              )}
            </div>

            {/* MEDICATIONS */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Pill size={24} className="text-green-600" />
                  Current Medications
                </h2>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
                  <Plus size={18} /> Add
                </button>
              </div>

              {medications.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No active medications</p>
              ) : (
                <div className="space-y-2">
                  {medications.slice(0, 3).map((med: any) => (
                    <MedicationRow key={med.id} medication={med} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - VITALS & ALERTS */}
          <div className="space-y-6">
            {/* VITALS PANEL */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Heart size={22} className="text-red-600" />
                Latest Vitals
              </h3>
              <div className="space-y-3">
                <VitalRow label="Weight" value={`${vitals?.weight || '--'} kg`} />
                <VitalRow label="BP" value={vitals?.bloodPressure || '--'} />
                <VitalRow label="Pulse" value={`${vitals?.pulse || '--'} bpm`} />
                <VitalRow label="Temp" value={`${vitals?.temperature || '--'}°C`} />
              </div>
              <button className="w-full mt-4 bg-blue-100 text-blue-700 py-2 rounded-lg hover:bg-blue-200 font-medium">
                Record Vitals
              </button>
            </div>

            {/* ALLERGIES ALERT */}
            {allergies.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-900 mb-2">⚠️ Known Allergies</h3>
                <div className="space-y-1">
                  {allergies.slice(0, 3).map((allergy: string, idx: number) => (
                    <p key={idx} className="text-sm text-red-800">{allergy}</p>
                  ))}
                </div>
              </div>
            )}

            {/* RECENT DOCUMENTS */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Recent Documents</h3>
              {recentRecords.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No recent documents</p>
              ) : (
                <div className="space-y-2">
                  {recentRecords.map((record: any) => (
                    <div key={record.id} className="text-sm p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                      <p className="font-medium text-gray-900">{record.title}</p>
                      <p className="text-gray-500 text-xs">{new Date(record.uploadedDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== COMPONENT HELPERS ====================

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${colorClasses[color as keyof typeof colorClasses]} p-3 rounded-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

const AppointmentCard = ({ appointment }: any) => (
  <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="font-semibold text-gray-900">Dr. {appointment.doctorId}</p>
        <p className="text-sm text-gray-600">{appointment.reason}</p>
        <p className="text-sm text-gray-500 mt-2">
          📅 {new Date(appointment.dateTime).toLocaleDateString()} at{' '}
          {new Date(appointment.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
        appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {appointment.status}
      </span>
    </div>
  </div>
);

const MedicationRow = ({ medication }: any) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div className="flex-1">
      <p className="font-medium text-gray-900">{medication.name}</p>
      <p className="text-sm text-gray-600">{medication.dosage} • {medication.frequency}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-medium text-gray-900">{medication.refillsRemaining} refills</p>
    </div>
  </div>
);

const VitalRow = ({ label, value }: any) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-100">
    <span className="text-gray-600 text-sm">{label}</span>
    <span className="font-semibold text-gray-900">{value}</span>
  </div>
);

export default PatientHomePage;
