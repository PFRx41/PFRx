import { useEffect, useState } from "react";
import Pusher from "pusher-js";
import Head from "next/head";

export default function Home() {
  const [data, setData] = useState({ data: [], totalClaimed: 0, totalAirdropped: 0, lastUpdated: null });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize Pusher with error handling
    let pusher;
    try {
      if (!process.env.NEXT_PUBLIC_PUSHER_KEY || !process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
        throw new Error("Pusher configuration missing");
      }
      pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
        useTLS: true,
      });
      const channel = pusher.subscribe("airdrop-channel");
      channel.bind("dashboard-update", (newData) => {
        setData(newData);
        setError(null);
      });
      channel.bind("pusher:subscription_error", (err) => {
        console.error("Pusher subscription error:", err);
        setError("Failed to subscribe to real-time updates");
      });
    } catch (err) {
      console.error("Pusher initialization error:", err.message);
      setError("Real-time updates unavailable");
    }

    // Load dark mode preference from localStorage
    const savedTheme = localStorage.getItem("theme");
    console.log("Loaded theme from localStorage:", savedTheme);
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
      console.log("Applied dark mode on mount");
    }

    // Fetch initial data
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch((error) => {
        console.error("Error fetching dashboard data:", error);
        setError("Failed to load dashboard data");
      });

    return () => {
      if (pusher) {
        pusher.unsubscribe("airdrop-channel");
        pusher.disconnect();
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      console.log("Toggling dark mode to:", newMode ? "dark" : "light");
      if (newMode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return newMode;
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-4">
      <Head>
        <title>Airdrop Dashboard</title>
      </Head>
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Airdrop Dashboard</h1>
          <button
            onClick={toggleDarkMode}
            className="px-4 py-2 bg-blue-500 dark:bg-blue-700 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-800 transition"
          >
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-200 dark:bg-gray-700 rounded">
            <h2 className="text-lg font-semibold">Total Fees Claimed (SOL)</h2>
            <p className="text-2xl">{data.totalClaimed.toFixed(6)}</p>
          </div>
          <div className="p-4 bg-gray-200 dark:bg-gray-700 rounded">
            <h2 className="text-lg font-semibold">Total Airdrops Sent (SOL)</h2>
            <p className="text-2xl">{data.totalAirdropped.toFixed(6)}</p>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Last Updated</h2>
          <p>{data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "No data yet"}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Airdrop History</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-600">
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Fees Claimed (SOL)</th>
                  <th className="border p-2">Airdrops Sent (SOL)</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, index) => (
                  <tr key={index} className="odd:bg-white even:bg-gray-100 dark:odd:bg-gray-800 dark:even:bg-gray-700">
                    <td className="border p-2">{new Date(row.Date).toLocaleString()}</td>
                    <td className="border p-2">{row["Fees Claimed (SOL)"].toFixed(6)}</td>
                    <td className="border p-2">{row["Airdrops Sent (SOL)"].toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}