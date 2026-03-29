import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { writeAuditLogInternal } from "../audit/writeAuditLog";

const ROLE_LEVELS: Record<string, number> = {
  ceo: 3,
  researcher: 2,
  prod_manager: 2,
  warehouse: 2,
  purchaser: 2,
  sales: 2,
  accountant: 2,
  staff: 1,
};

/**
 * CEO만 호출 가능. 대상 사용자에게 역할과 모듈 접근 권한을 부여한다.
 * Firebase Custom Claims에 role, level, modules를 설정한다.
 */
export const setUserRole = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    // CEO만 역할 변경 가능
    if (request.auth.token.role !== "ceo") {
      throw new HttpsError("permission-denied", "CEO만 역할을 변경할 수 있습니다.");
    }

    const { targetUid, role, modules } = request.data as {
      targetUid: string;
      role: string;
      modules: string[];
    };

    if (!targetUid || !role) {
      throw new HttpsError("invalid-argument", "targetUid와 role은 필수입니다.");
    }

    const level = ROLE_LEVELS[role];
    if (level === undefined) {
      throw new HttpsError("invalid-argument", `유효하지 않은 역할입니다: ${role}`);
    }

    // Custom Claims 설정
    await admin.auth().setCustomUserClaims(targetUid, {
      role,
      level,
      modules: modules ?? [],
    });

    // 감사 로그 기록
    await writeAuditLogInternal({
      event: "ROLE_CHANGED",
      userId: request.auth.uid,
      userEmail: request.auth.token.email ?? "",
      userName: request.auth.token.name ?? "",
      targetCollection: "users",
      targetDocId: targetUid,
      details: { newRole: role, modules },
    });

    return { success: true, role, level, modules };
  }
);
