import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { writeAuditLogInternal } from "../audit/writeAuditLog";

const db = admin.firestore();

interface InventoryTxData {
  type: "incoming" | "outgoing" | "transfer" | "adjustment_plus" | "adjustment_minus" | "return";
  itemId: string;
  warehouseId: string;
  quantity: number;
  lotNo?: string;
  incomingType?: string;
  outgoingType?: string;
  referenceNo?: string;
  referenceType?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  expiryDate?: string;
  manufactureDate?: string;
  notes?: string;
}

/**
 * 재고 입출고 트랜잭션 처리 (Firestore Transaction)
 * inventory, inventoryTransactions 컬렉션은 클라이언트 쓰기가 차단되어 있어
 * 반드시 이 Cloud Function을 통해야 한다.
 */
export const processInventoryTx = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const data = request.data as InventoryTxData;

    // 기본 검증
    if (!data.type || !data.itemId || !data.warehouseId || !data.quantity) {
      throw new HttpsError("invalid-argument", "type, itemId, warehouseId, quantity는 필수입니다.");
    }
    if (data.quantity <= 0) {
      throw new HttpsError("invalid-argument", "수량은 0보다 커야 합니다.");
    }

    // 품목/창고 정보 조회
    const [itemSnap, warehouseSnap] = await Promise.all([
      db.collection("items").doc(data.itemId).get(),
      db.collection("warehouses").doc(data.warehouseId).get(),
    ]);

    if (!itemSnap.exists) {
      throw new HttpsError("not-found", "품목을 찾을 수 없습니다.");
    }
    if (!warehouseSnap.exists) {
      throw new HttpsError("not-found", "창고를 찾을 수 없습니다.");
    }

    const item = itemSnap.data()!;
    const warehouse = warehouseSnap.data()!;

    // LOT번호 자동 생성 (입고 시 미입력이면)
    const lotNo = data.lotNo || generateLotNo(data.type, item.code);

    // Firestore Transaction으로 재고 처리
    await db.runTransaction(async (tx) => {
      // 재고 문서 키: itemId_warehouseId_lotNo
      const inventoryKey = `${data.itemId}_${data.warehouseId}_${lotNo}`;
      const inventoryRef = db.collection("inventory").doc(inventoryKey);
      const inventorySnap = await tx.get(inventoryRef);

      let currentQty = 0;
      if (inventorySnap.exists) {
        currentQty = inventorySnap.data()!.quantity ?? 0;
      }

      // 입/출 수량 계산
      let newQty: number;
      if (data.type === "incoming" || data.type === "adjustment_plus" || data.type === "return") {
        newQty = currentQty + data.quantity;
      } else if (data.type === "outgoing" || data.type === "adjustment_minus") {
        newQty = currentQty - data.quantity;
        if (newQty < 0) {
          throw new HttpsError("failed-precondition", `재고가 부족합니다. 현재: ${currentQty}, 요청: ${data.quantity}`);
        }
      } else {
        throw new HttpsError("invalid-argument", `지원하지 않는 트랜잭션 유형: ${data.type}`);
      }

      // 재고 문서 업데이트 또는 생성
      const inventoryData = {
        itemId: data.itemId,
        itemCode: item.code,
        itemName: item.name,
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        lotNo,
        quantity: newQty,
        unit: item.unit,
        expiryDate: data.expiryDate ?? null,
        manufactureDate: data.manufactureDate ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth!.uid,
      };

      if (inventorySnap.exists) {
        tx.update(inventoryRef, inventoryData);
      } else {
        tx.set(inventoryRef, {
          ...inventoryData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: request.auth!.uid,
        });
      }

      // 트랜잭션 이력 기록
      const txRef = db.collection("inventoryTransactions").doc();
      tx.set(txRef, {
        type: data.type,
        itemId: data.itemId,
        itemCode: item.code,
        itemName: item.name,
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        lotNo,
        quantity: data.quantity,
        unit: item.unit,
        incomingType: data.incomingType ?? null,
        outgoingType: data.outgoingType ?? null,
        referenceNo: data.referenceNo ?? null,
        referenceType: data.referenceType ?? null,
        fromWarehouseId: data.fromWarehouseId ?? null,
        toWarehouseId: data.toWarehouseId ?? null,
        notes: data.notes ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth!.uid,
      });
    });

    // 감사 로그
    const auditEvent = data.type === "incoming" ? "INVENTORY_IN"
      : data.type === "outgoing" ? "INVENTORY_OUT"
      : "INVENTORY_ADJUST";

    await writeAuditLogInternal({
      event: auditEvent,
      userId: request.auth.uid,
      userEmail: request.auth.token.email ?? "",
      userName: request.auth.token.name ?? "",
      targetCollection: "inventory",
      targetDocId: `${data.itemId}_${data.warehouseId}_${lotNo}`,
      details: {
        type: data.type,
        itemCode: item.code,
        itemName: item.name,
        warehouseName: warehouse.name,
        lotNo,
        quantity: data.quantity,
      },
    });

    return { success: true, lotNo };
  }
);

/**
 * LOT번호 자동 생성: YYMMDD-구분-순번
 */
function generateLotNo(type: string, itemCode: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = type === "incoming" ? "IN" : type === "outgoing" ? "OT" : "AD";
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${yy}${mm}${dd}-${prefix}-${itemCode}-${seq}`;
}
