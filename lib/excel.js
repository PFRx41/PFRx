const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const ExcelJS = require("exceljs");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function readExcelData() {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: "dashboard_data.xlsx",
    };
    const command = new GetObjectCommand(params);
    const { Body } = await s3Client.send(command);
    const workbook = new ExcelJS.Workbook();
    const buffer = await streamToBuffer(Body); // Convert stream to buffer
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        rows.push({
          date: row.getCell(1).value || new Date().toISOString(),
          claimedSol: Number(row.getCell(2).value) || 0,
          airdroppedSol: Number(row.getCell(3).value) || 0,
        });
      }
    });
    return rows;
  } catch (error) {
    console.error("Error reading Excel from S3:", error.message);
    return [];
  }
}

async function appendToExcel(date, claimedSol, airdroppedSol) {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: "dashboard_data.xlsx",
    };
    let workbook;
    try {
      const command = new GetObjectCommand(params);
      const { Body } = await s3Client.send(command);
      workbook = new ExcelJS.Workbook();
      const buffer = await streamToBuffer(Body);
      await workbook.xlsx.load(buffer);
    } catch (error) {
      workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Airdrop Data");
      worksheet.columns = [
        { header: "Date", key: "date" },
        { header: "Claimed SOL", key: "claimedSol" },
        { header: "Airdropped SOL", key: "airdroppedSol" },
      ];
    }
    const worksheet = workbook.getWorksheet(1);
    worksheet.addRow({
      date: date || new Date().toISOString(),
      claimedSol: Number(claimedSol) || 0,
      airdroppedSol: Number(airdroppedSol) || 0,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    await s3Client.send(new PutObjectCommand({
      ...params,
      Body: buffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
  } catch (error) {
    console.error("Error appending to Excel in S3:", error.message);
    throw error;
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { readExcelData, appendToExcel };