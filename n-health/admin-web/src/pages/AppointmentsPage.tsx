// ==================== APPOINTMENTS MANAGEMENT PAGE - PRODUCTION COMPLETE ====================

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Phone, Video, MessageSquare, Trash2, Edit2, AlertCircle } from 'lucide-react';

interface AppointmentsPageProps {
  userId: string;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    doctorId: '',
    dateTime: '',
    consultationType: 'in-person',
    reason: '',
    prepInstructions: '',
  });

  useEffect(() => {
    loadAppointments();
  }, [filter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      let url = '/api/patient/appointments';
      if (filter !== 'all') {
        url += `?status=${filter === 'upcoming' ? 'scheduled,confirmed' : filter}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) throw new Error('Failed to load appointments');
      const data = await res.json();
      setAppointments(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    try {
      const res = await fetch('/api/patient/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) throw new Error('Failed to book appointment');
      setShowBookModal(false);
      setBookingData({
        doctorId: '',
        dateTime: '',
        consultationType: 'in-person',
        reason: '',
        prepInstructions: '',
      });
      loadAppointments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReschedule = async (appointmentId: string) => {
    const newDate = prompt('Enter new date and time (YYYY-MM-DD HH:MM):');
    if (!newDate) return;

    try {
      const res = await fetch(`/api/patient/appointments/${appointmentId}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ newDateTime: new Date(newDate) }),
      });

      if (!res.ok) throw new Error('Failed to reschedule');
      loadAppointments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const res = await fetch(`/api/patient/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason: 'Cancelled by patient' }),
      });

      if (!res.ok) throw new Error('Failed to cancel');
      loadAppointments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Appointments</h1>
            <p className="text-gray-600 mt-2">View, book, and manage your medical appointments</p>
          </div>
          <button
            onClick={() => setShowBookModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Book Appointment
          </button>
        </div>

        {error && <ErrorAlert message={error} />}

        {/* FILTER TABS */}
        <div className="flex gap-4 mb-6">
          {(['all', 'upcoming', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* APPOINTMENTS LIST */}
        <div className="space-y-4">
          {appointments.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">No appointments found</p>
            </div>
          ) : (
            appointments.map((apt: any) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                onReschedule={handleReschedule}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>

        {/* BOOK APPOINTMENT MODAL */}
        {showBookModal && (
          <BookAppointmentModal
            bookingData={bookingData}
            setBookingData={setBookingData}
            onBook={handleBookAppointment}
            onClose={() => setShowBookModal(false)}
          />
        )}
      </div>
    </div>
  );
};

// ==================== COMPONENTS ====================

const AppointmentCard = ({ appointment, onReschedule, onCancel }: any) => {
  const appointmentDate = new Date(appointment.dateTime);
  const isUpcoming = appointmentDate > new Date();
  const consultationIcon = appointment.consultationType === 'video' ? Video : 
                          appointment.consultationType === 'phone' ? Phone :
                          appointment.consultationType === 'chat' ? MessageSquare :
                          MapPin;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Dr. {appointment.doctorId || 'Healthcare Provider'}
            </h3>
            <p className="text-gray-600 mb-4">{appointment.reason}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar size={18} className="text-blue-600" />
                <span>{appointmentDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Clock size={18} className="text-blue-600" />
                <span>{appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                {React.createElement(consultationIcon, { size: 18, className: 'text-blue-600' })}
                <span className="capitalize">{appointment.consultationType}</span>
              </div>
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  appointment.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
              </div>
            </div>

            {appointment.videoCallLink && (
              <a href={appointment.videoCallLink} className="text-blue-600 hover:underline font-medium text-sm">
                Join Video Call →
              </a>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-2 ml-4">
            {isUpcoming && (
              <>
                <button
                  onClick={() => onReschedule(appointment.id)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Reschedule"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => onCancel(appointment.id)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {appointment.prepInstructions && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-2">Preparation Instructions:</p>
            <p className="text-sm text-gray-600">{appointment.prepInstructions}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const BookAppointmentModal = ({ bookingData, setBookingData, onBook, onClose }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Book Appointment</h2>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Doctor ID"
          value={bookingData.doctorId}
          onChange={(e) => setBookingData({ ...bookingData, doctorId: e.target.value })}
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
        />

        <input
          type="datetime-local"
          value={bookingData.dateTime}
          onChange={(e) => setBookingData({ ...bookingData, dateTime: e.target.value })}
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
        />

        <select
          value={bookingData.consultationType}
          onChange={(e) => setBookingData({ ...bookingData, consultationType: e.target.value })}
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
        >
          <option value="in-person">In-Person</option>
          <option value="video">Video Call</option>
          <option value="phone">Phone Call</option>
          <option value="chat">Chat</option>
        </select>

        <textarea
          placeholder="Reason for visit"
          value={bookingData.reason}
          onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
          className="w-full h-24 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600 resize-none"
        />

        <div className="flex gap-4 pt-4">
          <button
            onClick={onBook}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Book
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const ErrorAlert = ({ message }: any) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
    <AlertCircle className="text-red-600" size={20} />
    <span className="text-red-700">{message}</span>
  </div>
);

export default AppointmentsPage;
