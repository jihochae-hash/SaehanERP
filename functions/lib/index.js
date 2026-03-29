"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = exports.processInventoryTx = exports.setUserRole = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
var setUserRole_1 = require("./auth/setUserRole");
Object.defineProperty(exports, "setUserRole", { enumerable: true, get: function () { return setUserRole_1.setUserRole; } });
var processInventoryTx_1 = require("./inventory/processInventoryTx");
Object.defineProperty(exports, "processInventoryTx", { enumerable: true, get: function () { return processInventoryTx_1.processInventoryTx; } });
var writeAuditLog_1 = require("./audit/writeAuditLog");
Object.defineProperty(exports, "writeAuditLog", { enumerable: true, get: function () { return writeAuditLog_1.writeAuditLog; } });
//# sourceMappingURL=index.js.map