const ExcelJS = require("exceljs");
const fs = require("fs").promises;

async function appendToExcel(date, claimed, airdropped) {
  const workbook = new ExcelJS.Workbook();
  const filePath = "/tmp/dashboard_data.xlsx";
  try {
    if (await fs.access(filePath).then(() => true).catch(() => false)) {
      await workbook.xlsx.readFile(filePath);
    }
    let sheet = workbook.getWorksheet("Data");
    if (!sheet) {
      sheet = workbook.addWorksheet("Data");
      sheet.addRow(["Date", "Fees Claimed (SOL)", "Airdrops Sent (SOL)"]);
    }
    sheet.addRow([date.toISOString(), claimed, airdropped]);
    await workbook.xlsx.writeFile(filePath);
  } catch (error) {
    throw new Error(`Error writing to Excel: ${error.message}`);
  }
}

async function readExcelData() {
  const filePath = "/tmp/dashboard_data.xlsx";
  try {
    if (!(await fs.access(filePath).then(() => true).catch(() => false))) {
      return { data: [], totalClaimed: 0, totalAirdropped: 0, lastUpdated: null };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet("Data");
    if (!sheet) {
      return { data: [], totalClaimed: 0, totalAirdropped: 0, lastUpdated: null };
    }
    const data = [];
    let totalClaimed = 0;
    let totalAirdropped = 0;
    let lastUpdated = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const rowData = {
        Date: row.getCell(1).value,
        "Fees Claimed (SOL)": row.getCell(2).value || 0,
        "Airdrops Sent (SOL)": row.getCell(3).value || 0,
      };
      totalClaimed += rowData["Fees Claimed (SOL)"];
      totalAirdropped += rowData["Airdrops Sent (SOL)"];
      if (!lastUpdated || new Date(rowData.Date) > new Date(lastUpdated)) {
        lastUpdated = rowData.Date;
      }
      data.push(rowData);
    });
    return { data, totalClaimed, totalAirdropped, lastUpdated };
  } catch (error) {
    throw new Error(`Error reading dashboard data: ${error.message}`);
  }
}

module.exports = {
  appendToExcel,
  readExcelData,
};