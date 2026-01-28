const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelPath = path.join(__dirname, '..', 'docs', 'SRA-checklist[12892].xlsm');

console.log('Reading Excel file...');

try {
  // Only read sheet names first
  const workbook = XLSX.readFile(excelPath, { bookSheets: true });
  console.log('\nSheet names:', workbook.SheetNames);
  console.log('Total sheets:', workbook.SheetNames.length);

  // Now read full file
  const fullWorkbook = XLSX.readFile(excelPath);

  // Pick first sheet with "balans" or first non-empty sheet
  const targetSheet = fullWorkbook.SheetNames.find(n => n.toLowerCase().includes('balans')) || fullWorkbook.SheetNames[0];
  console.log('\nAnalyzing sheet:', targetSheet);

  const sheet = fullWorkbook.Sheets[targetSheet];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('Total rows:', data.length);

  // Show first 10 rows
  console.log('\n=== FIRST 10 ROWS ===');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`\nRow ${i}:`);
    data[i].forEach((cell, idx) => {
      const val = String(cell).trim();
      if (val) console.log(`  [${idx}]: ${val.substring(0, 80)}`);
    });
  }

  // Find rows with i+d
  console.log('\n=== SEARCHING FOR i+d ===');
  const idRows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j]).trim();
      if (cell === 'i+d' || cell === 'i + d') {
        idRows.push({ row: i, col: j, sample: row.slice(0, 6) });
        break;
      }
    }
  }
  console.log(`Found ${idRows.length} rows with i+d`);

  if (idRows.length > 0) {
    console.log('\nSample i+d rows:');
    idRows.slice(0, 5).forEach(r => {
      console.log(`Row ${r.row}, col ${r.col}:`, r.sample.map(c => String(c).substring(0,30)));
    });
  }

} catch (error) {
  console.error('Error:', error.message);
}
