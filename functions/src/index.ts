import * as admin from "firebase-admin";

admin.initializeApp();

export { setUserRole } from "./auth/setUserRole";
export { processInventoryTx } from "./inventory/processInventoryTx";
export { writeAuditLog } from "./audit/writeAuditLog";
