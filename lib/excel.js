const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");
const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function appendToExcel(date, claimed, airdropped) {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), "dashboard_data.xlsx");
  const s3Key = "dashboard_data.xlsx";

  try {
    // Download from S3 if exists
    try {
      const s3Data = await s3.getObject({ Bucket: process.env.AWS_S3_BUCKET, Key: s3Key }).promise();
      await fs.writeFile(filePath, s3Data.Body);
      await workbook.xlsx.readFile(filePath);
    } catch (error) {
      if (error.code !== "NoSuchKey") {
        throw new Error(`Error downloading from S3: ${error.message}`);
      }
    }

    let sheet = workbook.getWorksheet("Data");
    if (!sheet) {
      sheet = workbook.addWorksheet("Data");
      sheet.addRow(["Date", "Fees Claimed (SOL)", "Airdrops Sent (SOL)"]);
    }
    sheet.addRow([date.toISOString(), claimed, airdropped]);
    await workbook.xlsx.writeFile(filePath);

    // Upload to S3
    const fileContent = await fs.readFile(filePath);
    await s3.upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }).promise();
  } catch (error) {
    throw new Error(`Error writing to Excel: ${error.message}`);
  }
}

async function readExcelData() {
  const filePath = path.join(process.cwd(), "dashboard_data.xlsx");
  const s3Key = "dashboard_data.xlsx";

  try {
    // Download from S3 if exists
    try {
      const s3Data = await s3.getObject({ Bucket: process.env.AWS_S3_BUCKET, Key: s3Key }).promise();
      await fs.writeFile(filePath, s3Data.Body);
    } catch (error) {
      if (error.code !== "NoSuchKey") {
        throw new Error(`Error downloading from S3: ${error.message}`);
      }
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