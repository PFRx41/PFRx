import { useState, useEffect } from "react";
import Pusher from "pusher-js";

export default function Dashboard() {
  const [data, setData] = useState({ rows: [], totalClaimed: 0, totalAirdropped: 0 });
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Environment variables for token address and social links
  const displayContractAddress = process.env.NEXT_PUBLIC_DISPLAY_CONTRACT_ADDRESS || "coming soon";
  const twitterLink = process.env.NEXT_PUBLIC_TWITTER || "#";
  const dexscreenerLink = process.env.NEXT_PUBLIC_DEXSCREENER || "#";
  const pumpfunLink = process.env.NEXT_PUBLIC_PUMPFUN || "#";

  useEffect(() => {
    // Load dark mode from localStorage
    let savedDarkMode = false;
    try {
      savedDarkMode = localStorage.getItem("darkMode") === "true";
    } catch (err) {
      console.error("Error accessing localStorage:", err);
    }
    setDarkMode(savedDarkMode);
    document.documentElement.classList.toggle("dark", savedDarkMode);
    console.log(`Initial dark mode: ${savedDarkMode}`);

    // Fetch initial dashboard data
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const result = await res.json();
        setData({
          rows: Array.isArray(result.rows) ? result.rows : [],
          totalClaimed: Number(result.totalClaimed) || 0,
          totalAirdropped: Number(result.totalAirdropped) || 0,
        });
        setError(null);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setData({ rows: [], totalClaimed: 0, totalAirdropped: 0 });
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      forceTLS: true,
    });
    const channel = pusher.subscribe("airdrop-channel");
    channel.bind("dashboard-update", newData => {
      setData({
        rows: Array.isArray(newData.rows) ? newData.rows : [],
        totalClaimed: Number(newData.totalClaimed) || 0,
        totalAirdropped: Number(newData.totalAirdropped) || 0,
      });
      setError(null);
    });

    // Cleanup Pusher on unmount
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    try {
      localStorage.setItem("darkMode", newDarkMode);
    } catch (err) {
      console.error("Error saving darkMode to localStorage:", err);
    }
    document.documentElement.classList.toggle("dark", newDarkMode);
    console.log(`Toggled dark mode to: ${newDarkMode}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold">Solana Airdrop Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                {darkMode ? (
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                ) : (
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                )}
              </svg>
              {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-2">Token Address</h2>
          <p className="text-lg font-mono break-all text-blue-600 dark:text-blue-400">
            {displayContractAddress}
          </p>
          <div className="flex gap-4 mt-4">
            <a
              href={twitterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-400 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-500 dark:hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Twitter
            </a>
            <a
              href={dexscreenerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zm-2-8H7v-2h10v2zm0 4H7v-2h10v2z" />
              </svg>
              Dexscreener
            </a>
            <a
              href={pumpfunLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
              </svg>
              Pump.fun
            </a>
          </div>
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading...</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-2">Total Fees Claimed (SOL)</h2>
            <p className="text-3xl font-mono text-blue-600 dark:text-blue-400">
              {(data.totalClaimed || 0).toFixed(6)}
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-2">Total Airdrops Sent (SOL)</h2>
            <p className="text-3xl font-mono text-blue-600 dark:text-blue-400">
              {(data.totalAirdropped || 0).toFixed(6)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Airdrop History</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Claimed SOL</th>
                    <th className="p-3 text-left">Airdropped SOL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && !loading && (
                    <tr>
                      <td colSpan="3" className="p-3 text-center text-gray-500 dark:text-gray-400">
                        No airdrop data available
                      </td>
                    </tr>
                  )}
                  {data.rows.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="p-3">{new Date(row.date).toLocaleString()}</td>
                      <td className="p-3 font-mono">{(row.claimedSol || 0).toFixed(6)}</td>
                      <td className="p-3 font-mono">{(row.airdroppedSol || 0).toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}