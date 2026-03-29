"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = void 0;
exports.writeAuditLogInternal = writeAuditLogInternal;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const db = admin.firestore();
/**
 * 감사 로그 기록 Cloud Function
 * 클라이언트에서 호출하거나 다른 함수에서 내부적으로 호출한다.
 * auditLogs 컬렉션은 클라이언트 쓰기가 차단되어 있으므로 반드시 이 함수를 통해야 한다.
 */
exports.writeAuditLog = (0, https_1.onCall)({ region: "asia-northeast1" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "인증이 필요합니다.");
    }
    const data = request.data;
    if (!data.event) {
        throw new https_1.HttpsError("invalid-argument", "event는 필수 항목입니다.");
    }
    await db.collection("auditLogs").add({
        event: data.event,
        userId: request.auth.uid,
        userEmail: request.auth.token.email ?? "",
        userName: request.auth.token.name ?? "",
        targetCollection: data.targetCollection ?? null,
        targetDocId: data.targetDocId ?? null,
        details: data.details ?? null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
/**
 * 내부 유틸: 다른 Cloud Functions에서 직접 감사 로그를 기록할 때 사용
 */
async function writeAuditLogInternal(params) {
    await db.collection("auditLogs").add({
        ...params,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=writeAuditLog.js.map