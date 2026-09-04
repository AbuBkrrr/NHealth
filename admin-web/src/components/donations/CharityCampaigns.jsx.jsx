import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CharityCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/donations/fund/campaigns')
      .then(res => {
        setCampaigns(res.data.campaigns);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading campaigns...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🎗️ Charity Campaigns</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold">{campaign.name}</h3>
            <p className="text-gray-600">{campaign.description}</p>
            <div className="mt-4">
              <div>Target: ₦{campaign.targetAmount.toLocaleString()}</div>
              <div>Raised: ₦{campaign.raisedAmount.toLocaleString()}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(campaign.raisedAmount / campaign.targetAmount) * 100}%` }} />
              </div>
            </div>
            <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Donate Now</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharityCampaigns;