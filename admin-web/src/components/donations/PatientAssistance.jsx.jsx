import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PatientAssistance = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/donations/patient/requests')
      .then(res => {
        setRequests(res.data.requests);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading patient assistance requests...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">👤 Patient Assistance</h1>
      {requests.map(req => (
        <div key={req.id} className="bg-white shadow-md rounded-lg p-4 mb-4 border-l-4 border-yellow-500">
          <h3 className="text-lg font-semibold">{req.patient?.name || 'Patient'}</h3>
          <p className="text-sm text-gray-500">{req.diagnosis}</p>
          <p className="text-sm">Needed: ₦{req.totalCost.toLocaleString()}</p>
          <p className="text-sm">Raised: ₦{req.amountRaised.toLocaleString()}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(req.amountRaised / req.totalCost) * 100}%` }} />
          </div>
          <button className="mt-3 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Donate</button>
        </div>
      ))}
    </div>
  );
};

export default PatientAssistance;