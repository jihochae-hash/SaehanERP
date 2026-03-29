const XLSX = require('xlsx');
const admin = require('../functions/node_modules/firebase-admin');
const serviceAccount = require('C:/Users/gioho/Desktop/saehanerp key/saehanerp-firebase-adminsdk-fbsvc-830ac0fe8a.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const typeMap = {
  '제품': 'finished', '원자재': 'raw_material', '부자재': 'sub_material',
  '충진품': 'filling', '벌크': 'bulk', '상품': 'merchandise', '기타': 'other'
};
const procureMap = { '생산': 'production', '구매': 'purchase', '사급': 'supplied', '개발': 'development' };
const unitMap = { 'EA': 'ea', 'kg': 'kg', 'g': 'g', '매': 'ea' };

async function uploadItems() {
  const wb = XLSX.readFile('품목등록정보.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const data = rows.slice(2).filter(r => r[1]);

  console.log('품목 업로드 대상:', data.length, '건');

  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const chunk = data.slice(i, i + batchSize);

    for (const row of chunk) {
      const code = String(row[1] || '').trim();
      if (!code) continue;
      const safeId = code.replace(/[\/\\]/g, '_');

      const doc = {
        code,
        name: row[6] ? String(row[6]).trim() : '',
        type: typeMap[String(row[2] || '').trim()] || 'other',
        unit: unitMap[String(row[8] || 'EA').trim()] || 'ea',
        specification: row[7] ? String(row[7]).trim() : null,
        customerAbbr: row[3] ? String(row[3]).trim() : null,
        customerName: row[4] ? String(row[4]).trim() : null,
        serial: row[5] ? Number(row[5]) : null,
        procurementType: procureMap[String(row[9] || '').trim()] || null,
        formType: row[10] ? String(row[10]).trim() : null,
        formTypeName: row[11] ? String(row[11]).trim() : null,
        rawMaterialSub: row[12] ? String(row[12]).trim() : null,
        subMaterialType: row[13] ? String(row[13]).trim() : null,
        subMaterialTypeName: row[14] ? String(row[14]).trim() : null,
        isBaseBulk: row[15] === true || row[15] === 'TRUE',
        subCode: row[16] ? String(row[16]).trim() : null,
        unitQuantity: row[17] ? Number(row[17]) : null,
        requiresLotTracking: true,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'import',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'import',
      };

      batch.set(db.collection('items').doc(safeId), doc);
    }

    await batch.commit();
    console.log('품목:', Math.min(i + batchSize, data.length), '/', data.length);
  }
  console.log('품목 업로드 완료!');
}

async function uploadBOM() {
  const wb = XLSX.readFile('전체BOM.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const data = rows.slice(1).filter(r => r[0] && r[2]);

  console.log('BOM 업로드 대상:', data.length, '행');

  // 제품코드별로 그룹핑
  const bomMap = new Map();
  for (const row of data) {
    const productCode = String(row[0]).trim();
    const productName = String(row[1] || '').trim();
    if (!bomMap.has(productCode)) {
      bomMap.set(productCode, { productCode, productName, items: [] });
    }
    bomMap.get(productCode).items.push({
      itemCode: String(row[2]).trim(),
      itemName: String(row[3] || '').trim(),
      unit: String(row[4] || 'ea').trim() || 'ea',
      quantity: Number(row[5]) || 0,
      procurementType: String(row[6] || '').trim(),
      lossRate: 0,
    });
  }

  console.log('BOM 제품수:', bomMap.size, '건');

  const entries = Array.from(bomMap.values());
  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + batchSize);

    for (const bom of chunk) {
      const safeId = bom.productCode.replace(/[\/\\]/g, '_');
      const doc = {
        productItemId: safeId,
        productItemCode: bom.productCode,
        productItemName: bom.productName,
        baseQuantity: 1,
        baseUnit: 'ea',
        items: bom.items.map(item => ({
          itemId: item.itemCode.replace(/[\/\\]/g, '_'),
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit || 'ea',
          quantity: item.quantity,
          lossRate: 0,
          notes: item.procurementType || null,
        })),
        version: 1,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'import',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'import',
      };

      batch.set(db.collection('boms').doc(safeId), doc);
    }

    await batch.commit();
    console.log('BOM:', Math.min(i + batchSize, entries.length), '/', entries.length);
  }
  console.log('BOM 업로드 완료!');
}

async function main() {
  await uploadItems();
  await uploadBOM();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
