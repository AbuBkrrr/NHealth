import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BloodRequestList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/donations/blood/requests')
      .then(res => {
        setRequests(res.data.requests);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleDonate = async (requestId, quantity) => {
    try {
      await axios.post(/api/donations/blood/requests//donate, { quantity });
      alert('Thank you for donating blood!');
      // Refresh list
      window.location.reload();
    } catch (error) {
      alert('Donation failed: ' + error.response?.data?.error);
    }
  };

  if (loading) return <div>Loading blood requests...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🩸 Blood Donation Requests</h1>
      {requests.map(req => {
        const progress = (req.quantityDonated / req.quantityNeeded) * 100;
        return (
          <div key={req.id} className="bg-white shadow-md rounded-lg p-4 mb-4 border-l-4 border-red-500">
            <div className="flex justify-between">
              <h3 className="text-lg font-semibold">{req.patient?.name || 'Patient'}</h3>
              <span className="text-sm font-bold text-red-500">{req.bloodType}</span>
            </div>
            <p className="text-sm text-gray-500">{req.location}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: ${Math.min(progress, 100)}% }} />
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>{req.quantityDonated} donated</span>
              <span>{req.quantityNeeded} needed</span>
            </div>
            {req.status === 'open' && (
              <button onClick={() => handleDonate(req.id, 1)} className="mt-3 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                Donate 1 Unit
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BloodRequestList;
