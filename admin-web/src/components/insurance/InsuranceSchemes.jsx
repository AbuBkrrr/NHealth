import React, { useState, useEffect } from 'react';
import axios from 'axios';

const InsuranceSchemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/insurance/schemes')
      .then(res => {
        setSchemes(res.data.schemes);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading insurance plans...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Insurance Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schemes.map(scheme => (
          <div key={scheme.id} className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold">{scheme.name}</h3>
            <p className="text-gray-600">{scheme.provider}</p>
            <p className="mt-2 text-sm">{scheme.description}</p>
            <div className="mt-4 flex justify-between">
              <span>Premium: ₦{scheme.annualPremium}</span>
              <span>Coverage: ₦{scheme.annualCoverageLimit}</span>
            </div>
            <button className="mt-4 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
              Enroll Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsuranceSchemes;
