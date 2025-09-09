import { readExcelData } from "../../lib/excel";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await readExcelData();
    // Ensure numeric fields and calculate totals
    const formattedData = data.map(row => ({
      date: row.date || new Date().toISOString(),
      claimedSol: Number(row.claimedSol) || 0,
      airdroppedSol: Number(row.airdroppedSol) || 0,
    }));
    const totalClaimed = formattedData.reduce((sum, row) => sum + row.claimedSol, 0);
    const totalAirdropped = formattedData.reduce((sum, row) => sum + row.airdroppedSol, 0);
    res.status(200).json({ rows: formattedData, totalClaimed, totalAirdropped });
  } catch (error) {
    console.error("Error in /api/dashboard:", error.message);
    res.status(500).json({ error: `Failed to fetch dashboard data: ${error.message}`, rows: [], totalClaimed: 0, totalAirdropped: 0 });
  }
}