import { useEffect, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';

export default function Home() {
  const [data, setData] = useState([]);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [totalAirdropped, setTotalAirdropped] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/dashboard');
      const { data, totalClaimed, totalAirdropped, lastUpdated } = response.data;
      setData(data);
      setTotalClaimed(totalClaimed);
      setTotalAirdropped(totalAirdropped);
      setLastUpdated(lastUpdated);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <Head>
        <title>Airdrop Dashboard</title>
        <meta name="description" content="Solana Airdrop Dashboard" />
      </Head>
      <main className="w-full max-w-4xl bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Solana Airdrop Dashboard</h1>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-blue-800">Total Fees Claimed</h2>
                <p className="text-2xl font-bold text-blue-600">{totalClaimed.toFixed(6)} SOL</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-green-800">Total Airdrops Sent</h2>
                <p className="text-2xl font-bold text-green-600">{totalAirdropped.toFixed(6)} SOL</p>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mb-4">
                Last Updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 text-left text-gray-700">Date</th>
                    <th className="px-4 py-2 text-left text-gray-700">Fees Claimed (SOL)</th>
                    <th className="px-4 py-2 text-left text-gray-700">Airdrops Sent (SOL)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">{new Date(row.Date).toLocaleString()}</td>
                      <td className="px-4 py-2">{row['Fees Claimed (SOL)'].toFixed(6)}</td>
                      <td className="px-4 py-2">{row['Airdrops Sent (SOL)'].toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}