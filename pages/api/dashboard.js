const { readExcelData } = require("../../lib/excel");

export default async function handler(req, res) {
  try {
    const { data, totalClaimed, totalAirdropped, lastUpdated } = await readExcelData();
    res.status(200).json({ data, totalClaimed, totalAirdropped, lastUpdated });
  } catch (error) {
    res.status(500).json({ error: `Error reading dashboard data: ${error.message}` });
  }
}