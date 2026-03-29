# 새한화장품 통합 경영관리 시스템 - 개발 마스터 가이드

> 이 파일은 프로젝트의 모든 맥락을 담고 있다. 모든 코드 생성, 수정, 리팩토링 시 이 파일을 참조하라.

---

## 1. 프로젝트 개요

새한화장품(새한화장품/Sae-Han Cosmetics)의 모든 업무를 하나의 웹 플랫폼에서 통합 관리하는 시스템.
이젬코 CEP(화장품 MES)의 화장품 특화 기능 + 이카운트 ERP의 범용 경영관리 기능을 합친 자체 시스템이다.
쇼핑몰 연동은 제외한다.

- **회사 규모**: 최대 50명 동시 사용, 생산탱크 10개, 생산라인 10개
- **월 예산**: 50,000원 이내
- **개발자**: 1인 (CEO 본인, Claude Code 활용)
- **개발 기간**: 약 14~18개월 (7 Phase)

---

## 2. 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| Frontend | React 18+ / TypeScript / Tailwind CSS | Vite 빌드 |
| 상태관리 | Zustand | persist 사용 시 민감 데이터 제외 |
| 라우팅 | React Router v6 | |
| Backend/DB | Firebase Blaze Plan | Firestore, Auth, Cloud Functions, Storage |
| Firebase 리전 | asia-northeast3 (서울) | 한국 로컬 리전 |
| Hosting | Netlify | Preview Deploy 활용 |
| 저울 연동 | Electron + Node.js | AND FG-150KAL-H (RS232C → USB) |
| IDE | VS Code + Claude Code | |
| 버전관리 | Git + GitHub | |

---

## 3. 프로젝트 구조

```
saehan-erp/
├── CLAUDE.md                    ← 이 파일
├── src/
│   ├── App.tsx                  # 앱 진입점
│   ├── main.tsx                 # Vite 엔트리
│   ├── components/
│   │   ├── layout/              # MainLayout, Sidebar, Header, Footer
│   │   ├── ui/                  # Button, Input, Modal, Table, Select, Badge, Card 등
│   │   └── guards/              # AuthGuard, RoleGuard, ModuleGuard
│   ├── features/                # ★ 모듈별 디렉토리 (아래 모듈 목록 참조)
│   │   ├── auth/                # 로그인, 회원가입, 세션관리
│   │   ├── master/              # 기초 마스터 (품목/거래처/창고/계정과목)
│   │   ├── inventory/           # [B] 재고관리 WMS
│   │   ├── production/          # [C] 생산관리 MES + [D] 생산계획 MPS
│   │   ├── rnd/                 # [A] R&D 처방관리
│   │   ├── purchasing/          # [E] 구매관리 + [F] MRP
│   │   ├── quality/             # [G] 품질관리 QC/CGMP
│   │   ├── sales/               # [I] 영업/판매
│   │   ├── crm/                 # [J] 거래처/CRM/A/S
│   │   ├── cost/                # [H] 생산원가관리
│   │   ├── outsourcing/         # [P] 외주관리
│   │   ├── accounting/          # [K] 회계 + [L] 세무 + [M] 계좌/카드
│   │   ├── hr/                  # [N] 인사/급여
│   │   ├── equipment/           # [O] 설비관리
│   │   ├── approval/            # [Q] 전자결재
│   │   ├── groupware/           # [R] 그룹웨어 + [S] 메신저
│   │   ├── contract/            # [T] 전자계약
│   │   ├── dashboard/           # [U] 대시보드/경영자보고서
│   │   └── scale/               # [V] 저울 연동
│   ├── hooks/                   # useAuth, useFirestore, useSessionManager 등
│   ├── services/                # Firebase 서비스 래퍼
│   │   ├── firebase.ts          # Firebase 초기화 (apiKey 등)
│   │   ├── auth.service.ts      # 로그인/로그아웃/세션
│   │   ├── firestore.service.ts # CRUD 공통 함수
│   │   └── audit.service.ts     # 감사 로그 호출
│   ├── stores/                  # Zustand 스토어
│   ├── types/                   # TypeScript 타입/인터페이스
│   ├── utils/                   # 유틸리티 (포맷터, 검증, 암호화 등)
│   └── constants/               # 역할, 상수, 에러코드
├── functions/                   # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts             # 함수 export
│   │   ├── auth/                # setUserRole, revokeSession
│   │   ├── inventory/           # processInventoryTx (재고 입출고)
│   │   ├── approval/            # processApproval (전자결재)
│   │   ├── formula/             # encryptFormula, decryptFormula
│   │   ├── audit/               # writeAuditLog
│   │   ├── backup/              # dailyBackup (스케줄)
│   │   └── security/            # 암호화, 세션검증
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules              # Firestore 보안 규칙
├── storage.rules                # Storage 보안 규칙
├── firestore.indexes.json       # 복합 인덱스
├── firebase.json                # Firebase 프로젝트 설정
├── netlify.toml                 # Netlify 배포 + 보안 헤더
├── .env.local                   # 환경변수 (Git 제외)
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 4. 전체 모듈 목록 (22개)

| 코드 | 모듈명 | Phase | 핵심 기능 |
|------|--------|-------|-----------|
| A | R&D / 처방관리 | 2 | 처방 작성/버전관리, 전성분표, 성분 한도/금지/알러젠 자동 검증, 제품표준서 |
| B | 재고관리 (WMS) | 1 | 입출고, 창고별 재고, LOT/시리얼 추적, 바코드, 재고실사, 수불부, 안전재고, FIFO |
| C | 생산관리 (MES) | 2 | BOM, 작업지시서, 공정흐름, 칭량POP, 제조POP, 충진포장 모니터링, 생산실적 |
| D | 생산계획 (MPS) | 2 | 기준생산계획, 스케줄링, 용량계획, 납기일 기반 계획 |
| E | 구매관리 | 3 | 발주서, 견적요청, 구매입고, 발주계획, 거래처 평가 |
| F | MRP (자재소요량) | 3 | BOM 기반 소요량 산출, 자동 발주 추천, 리드타임 관리 |
| G | 품질관리 (QC/CGMP) | 3 | 수입/공정/출하 검사, CGMP 문서, ISO 22716, 부적합/CAPA, LOT 추적 |
| H | 생산원가관리 | 4 | 재료비/노무비/경비 집계, 제품별 원가 산출, 원가 분석 |
| I | 영업/판매관리 | 4 | 견적서, 주문서, 판매출고, 거래명세서, 미수금, 매출계획, Invoice/P.L. |
| J | 거래처/CRM | 4 | 거래처 통합관리, 거래이력, 고객등급, 연락기록, A/S 접수/처리 |
| K | 회계/재무관리 | 5 | 전표입력(일반/매출/매입), 재무상태표, 손익계산서, 자금관리, 경영자보고서 |
| L | 세무관리 | 5 | 부가세 신고, 원천세, 전자세금계산서, 홈택스 연동 준비 |
| M | 계좌/카드 연동 | 5 | 은행계좌 내역 조회, 카드 매입/매출, 회계 전표 자동 반영 |
| N | 인사/급여관리 | 6 | 사원정보, 급여계산/대장, 4대보험, 연말정산, 근태관리(출퇴근/휴가/연차) |
| O | 설비관리 | 6 | 설비대장, 예방정비 계획, 고장이력, 가동률 모니터링 |
| P | 외주관리 | 4 | 외주 발주/입고, 외주 단가, 외주 품질관리 |
| Q | 전자결재 | 6 | 결재선 설정, 기안/승인/반려, 처방확정/구매승인/출하승인 등 ERP 연동 |
| R | 그룹웨어 | 7 | 게시판(공지/자유/부서별), 업무공유, 일정관리(캘린더), 프로젝트관리, 파일공유 |
| S | 메신저 | 7 | 1:1/그룹 대화, 대화이력 검색, ERP 알림 연동 |
| T | 전자계약 | 6 | 계약서 템플릿, 전자서명, 계약이력/만료알림 |
| U | 대시보드 | 7 | KPI, 매출/생산/재고 실시간 현황, 위젯 기반 맞춤 대시보드, 모바일 대시보드 |
| V | 저울 연동 | 7 | Electron App, RS232C→USB 시리얼 통신, 칭량 데이터 자동 전송 |

---

## 5. Phase별 개발 순서

### Phase 1: 기반 구축 + 재고관리 (8~10주)
**목표**: 시스템 기초 + 보안 체계 + 재고 실무 적용

1. Firebase 프로젝트 설정 (Auth, Firestore, Functions, Storage)
2. **보안 기반 (최우선)**
   - RBAC: Firebase Custom Claims 기반 역할/모듈 권한
   - Firestore 보안 규칙: deny-all 기본, 컬렉션별 세밀한 규칙
   - 감사 로그 시스템 (auditLogs - Cloud Functions에서만 기록)
   - 세션 타임아웃: **8시간** (28800초) 미활동 시 자동 로그아웃
   - CEO 계정 MFA 활성화
3. UI 프레임워크 (레이아웃, 네비게이션, 권한별 메뉴)
4. 기초 마스터 CRUD (items, partners, warehouses, users)
5. 재고관리 (WMS)
   - 입출고 처리 (Cloud Functions Transaction만 허용)
   - 창고별 재고 조회, 수불부
   - LOT/시리얼 번호 관리, 유효기한, FIFO
   - 바코드 생성/스캔 (JsBarcode, html5-qrcode)
   - 안전재고 알림
6. Netlify 배포 + 보안 헤더 (CSP, HSTS, X-Frame-Options)
7. Firestore 일일 자동 백업 (Cloud Scheduler, 매일 새벽 3시)

### Phase 2: 생산관리 + R&D (10~12주)
**목표**: 화장품 제조 핵심 프로세스

1. R&D 처방관리 [A]
   - 처방 작성/수정/버전관리
   - 원료 마스터 (INCI명, CAS No.)
   - **성분 검증**: 금지성분 검출, 배합한도 검증, EU 알러젠 81종 자동 검증
   - 전성분표 자동 생성 (함량순 정렬)
   - 제품표준서 생성
   - **처방 데이터 AES-256 암호화** (Cloud Functions + Google Secret Manager)
2. 생산관리 [C]
   - BOM(자재명세서) 등록/관리
   - 작업지시서 생성/발행
   - 공정흐름 정의
   - 칭량POP (수동입력, Phase 7에서 저울 연동)
   - 제조POP, 충진/포장 실적
   - 공정별 진행현황 모니터링
3. 생산계획 [D]
   - 기준생산계획(MPS) 수립
   - 생산 스케줄링, 용량계획

### Phase 3: 구매 + MRP + 품질관리 (8~10주)
**목표**: 원자재 조달 + 품질 보증 체계

1. 구매관리 [E]: 발주서, 견적요청, 구매입고, 거래처 평가
2. MRP [F]: BOM 기반 소요량 산출, 자동 발주 추천, 리드타임
3. 품질관리 [G]: 수입/공정/출하 검사, CGMP 문서, ISO 22716, 부적합/CAPA
4. LOT 추적: 원료LOT → 벌크LOT → 완제품LOT 연결

### Phase 4: 영업/판매 + 원가관리 (8~10주)
**목표**: 매출 활동 + 원가 분석

1. 영업/판매 [I]: 견적서, 주문, 판매출고, 거래명세서, 미수금, 출하, Invoice/P.L.
2. CRM [J]: 거래처 통합관리, 거래이력, A/S 접수/처리
3. 생산원가 [H]: 재료비(BOM), 노무비, 경비 → 제품별 원가
4. 외주관리 [P]: 외주 발주/입고/단가/품질

### Phase 5: 회계/세무/재무 (8~10주)
**목표**: 재무회계 + 세무 + 금융 연동

1. 회계 [K]: 전표, 재무상태표, 손익계산서, 자금관리, 경영자보고서
2. 세무 [L]: 부가세/원천세 신고 자료, 전자세금계산서, 홈택스 준비
3. 계좌/카드 [M]: 은행 내역 조회, 카드 내역, 회계 전표 자동 반영

### Phase 6: 인사/급여 + 설비 + 전자결재 (8~10주)
**목표**: 내부 관리 프로세스

1. 인사/급여 [N]: 사원정보, 급여, 4대보험, 연말정산, 근태
2. 설비관리 [O]: 설비대장, 예방정비, 고장이력, 가동률
3. 전자결재 [Q]: 결재선, 기안/승인/반려, ERP 연동결재
4. 전자계약 [T]: 계약서 템플릿, 전자서명, 이력관리

### Phase 7: 그룹웨어 + 대시보드 + 저울 (8~10주)
**목표**: 협업 도구 + 종합 대시보드 + 하드웨어 연동

1. 그룹웨어 [R]: 게시판, 업무공유, 캘린더, 프로젝트관리, 파일공유
2. 메신저 [S]: 1:1/그룹 대화, ERP 알림 연동
3. 대시보드 [U]: KPI, 실시간 현황, 위젯 기반, 모바일 대시보드
4. 저울 연동 [V]: Electron App, RS232C 시리얼 통신, 칭량 데이터 자동 수집

---

## 6. 보안 아키텍처 (모든 Phase에 적용)

### 6.1 절대 원칙
- Firestore 보안 규칙: **deny-all 기본**, 필요한 권한만 개방
- 개발 중이라도 `allow read, write: if true` **절대 사용 금지**
- 재고/회계 등 핵심 데이터 변경은 **Cloud Functions에서만** (클라이언트 직접 쓰기 차단)
- `dangerouslySetInnerHTML` **절대 사용 금지** (서식 필요 시 DOMPurify)
- 서비스 계정 키, .env 파일은 **절대 Git 커밋 금지**

### 6.2 RBAC (역할 기반 접근 제어)
Firebase Custom Claims 기반. CEO만 역할을 부여할 수 있다.

| 역할 | 모듈 접근 | 레벨 |
|------|-----------|------|
| ceo | 전체 | 3 (admin) |
| researcher | rnd, quality | 2 (editor) |
| prod_manager | production, inventory, quality, equipment | 2 |
| warehouse | inventory | 2 |
| purchaser | purchasing, inventory, mrp | 2 |
| sales | sales, crm, inventory(읽기) | 2 |
| accountant | accounting, tax, banking, payroll, hr | 2 |
| staff | groupware, messenger, schedule | 1 (viewer) |

### 6.3 데이터 보호
- **처방 데이터** (formulas.composition): AES-256-GCM 암호화 (Cloud Functions에서 처리, 키는 Google Secret Manager)
- **개인정보** (주민번호, 계좌번호): 암호화 저장 + 화면 마스킹 (예: 930101-1******)
- **회계 전표**: 확정(isLocked) 후 수정/삭제 불가 → 수정 필요 시 역분개
- **감사 로그**: Cloud Functions에서만 기록, 클라이언트 쓰기/수정/삭제 불가

### 6.4 세션 관리
- 타임아웃: **8시간** (28800초) 미활동 시 자동 로그아웃
- 로그아웃 시 Zustand 상태 전체 초기화
- 로그인/로그아웃 이벤트 감사 로그 기록

### 6.5 Netlify 보안 헤더
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Content-Security-Policy = "default-src 'self'; script-src 'self' https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net; style-src 'self' 'unsafe-inline';"
```

---

## 7. Firestore 컬렉션 맵 (43개)

### 공통/인증
- `users` — 사용자 프로필 (role, modules는 Custom Claims에)
- `auditLogs` — 감사 로그 (CEO만 읽기, Cloud Functions만 쓰기)

### [A] R&D / 처방관리
- `ingredients` — 원료 마스터 (INCI명, CAS No., 알러젠 여부, 한도/금지)
- `formulas` — 처방 데이터 (composition은 AES-256 암호화)
- `formulaVerifications` — 성분 검증 결과
- `productStandards` — 제품표준서

### [B] 재고관리
- `items` — 품목 마스터
- `inventory` — 재고 데이터 (Cloud Functions만 쓰기)
- `inventoryTransactions` — 입출고 트랜잭션 (Cloud Functions만 쓰기)
- `warehouses` — 창고 마스터

### [C][D] 생산관리/계획
- `boms` — BOM (자재명세서)
- `workOrders` — 작업지시서
- `productionRecords` — 생산 실적
- `productionPlans` — 생산계획 (MPS)

### [E][F] 구매/MRP
- `purchaseOrders` — 발주서/구매주문
- `purchaseReceipts` — 구매 입고
- `mrpResults` — MRP 산출 결과

### [G] 품질관리
- `qualityInspections` — 품질검사 기록
- `cgmpDocuments` — CGMP 문서/일탈/CAPA

### [H] 원가관리
- `costRecords` — 원가 집계

### [I] 영업/판매
- `salesOrders` — 견적서/주문서/판매전표
- `salesShipments` — 출하 기록
- `receivables` — 미수금/수금

### [J] CRM
- `partners` — 거래처/고객 마스터
- `contactLogs` — 연락/활동 기록
- `serviceRequests` — A/S 접수/처리

### [K][L][M] 회계/세무
- `journalEntries` — 회계 전표 (확정 후 수정 불가)
- `accounts` — 계정과목 마스터
- `taxReports` — 세무 신고 자료
- `taxInvoices` — 전자세금계산서
- `bankTransactions` — 계좌/카드 거래 내역

### [N] 인사/급여
- `employees` — 사원 정보 (민감정보 암호화)
- `payrolls` — 급여 계산/대장
- `attendance` — 근태 기록

### [O] 설비관리
- `equipment` — 설비 대장
- `maintenanceLogs` — 정비/고장 이력

### [P] 외주관리
- `outsourcingOrders` — 외주 발주/입고

### [Q] 전자결재
- `approvalFlows` — 결재선 정의
- `approvalRequests` — 결재 문서 (Cloud Functions에서 상태 변경)

### [R][S] 그룹웨어/메신저
- `posts` — 게시판 글
- `messages` — 메신저 대화
- `schedules` — 일정/캘린더

### [T] 전자계약
- `contracts` — 계약서

### [U] 대시보드
- `dashboardConfigs` — 위젯 설정

---

## 8. Firestore 보안 규칙 템플릿

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ===== 공통 함수 =====
    function isAuth() { return request.auth != null; }
    function isCeo() { return request.auth.token.role == 'ceo'; }
    function hasModule(m) { return isCeo() || (m in request.auth.token.modules); }
    function isLevel(min) { return request.auth.token.level >= min; }
    function isOwner(uid) { return request.auth.uid == uid; }

    // ===== 기본: 모든 접근 차단 =====
    match /{document=**} { allow read, write: if false; }

    // 새 컬렉션 추가 시 반드시 여기에 규칙을 작성할 것.
    // 최소 권한 원칙: 필요한 역할에게만 필요한 동작(read/create/update/delete)을 허용.
    // Cloud Functions에서만 쓰는 컬렉션은 allow write: if false;

    // ===== 사용자 =====
    match /users/{userId} {
      allow get: if isAuth() && (isOwner(userId) || isCeo());
      allow list: if isAuth() && isCeo();
      allow update: if isAuth() && isOwner(userId)
        && !request.resource.data.diff(resource.data)
          .affectedKeys().hasAny(['role','level','modules']);
      allow create, delete: if false;
    }

    // ===== 마스터 (items, partners, warehouses, accounts) =====
    match /items/{id} {
      allow read: if isAuth();
      allow create, update: if isAuth() && isLevel(2) && hasModule('inventory');
      allow delete: if isCeo();
    }
    match /partners/{id} {
      allow read: if isAuth();
      allow create, update: if isAuth() && isLevel(2);
      allow delete: if isCeo();
    }
    match /warehouses/{id} {
      allow read: if isAuth();
      allow write: if isAuth() && hasModule('inventory') && isLevel(2);
    }

    // ===== Cloud Functions 전용 (클라이언트 쓰기 차단) =====
    match /inventory/{id} {
      allow read: if isAuth() && hasModule('inventory');
      allow write: if false;
    }
    match /inventoryTransactions/{id} {
      allow read: if isAuth() && hasModule('inventory');
      allow write: if false;
    }
    match /auditLogs/{id} {
      allow read: if isCeo();
      allow write: if false;
    }
    match /approvalRequests/{id} {
      allow read: if isAuth();
      allow write: if false; // Cloud Functions에서만 상태 변경
    }
    match /journalEntries/{id} {
      allow read: if isAuth() && hasModule('accounting');
      allow create: if isAuth() && hasModule('accounting') && isLevel(2);
      allow update: if isAuth() && hasModule('accounting') && isLevel(2)
        && !resource.data.isLocked;
      allow delete: if false;
    }

    // ===== 처방 (R&D 전용 + 암호화) =====
    match /formulas/{id} {
      allow read: if isAuth() && hasModule('rnd');
      allow create, update: if isAuth() && hasModule('rnd') && isLevel(2);
      allow delete: if false;
    }

    // ===== 급여 (경리 + 본인만) =====
    match /payrolls/{id} {
      allow read: if isAuth() &&
        (hasModule('payroll') || resource.data.employeeId == request.auth.uid);
      allow write: if isAuth() && hasModule('payroll') && isLevel(2);
    }
    match /employees/{id} {
      allow get: if isAuth() && (id == request.auth.uid || hasModule('hr'));
      allow list: if isAuth() && hasModule('hr');
      allow write: if isAuth() && hasModule('hr') && isLevel(2);
    }

    // Phase별로 새 컬렉션 추가 시 위 패턴을 따를 것.
  }
}
```

---

## 9. Cloud Functions 필수 목록

| 함수명 | 트리거 | 역할 |
|--------|--------|------|
| setUserRole | onCall | CEO만 호출. 사용자에게 역할/모듈 부여 |
| processInventoryTx | onCall | 재고 입출고 처리 (Transaction) |
| processApproval | onCall | 전자결재 상태 변경 |
| encryptFormula | onCall | 처방 데이터 암호화 후 저장 |
| decryptFormula | onCall | 처방 데이터 복호화 후 반환 |
| writeAuditLog | 내부 함수 | 감사 로그 기록 (다른 함수에서 호출) |
| dailyBackup | pubsub.schedule | 매일 새벽 3시 Firestore 전체 백업 |
| checkSafetyStock | Firestore trigger | 재고가 안전재고 이하로 떨어지면 알림 |
| generateLotNo | 내부 함수 | LOT 번호 자동 생성 (YYMMDD-구분-순번) |
| calculateMRP | onCall | MRP 자재 소요량 산출 |
| calculateCost | onCall | 제품별 원가 산출 |

---

## 10. 주요 업무 흐름 (모듈 간 연동)

### 수주 → 출하 흐름
견적서[I] → 주문접수[I] → 생산계획[D] → MRP[F] → 구매발주[E] → 원료입고+수입검사[B,G] → 작업지시[C] → 칭량[C] → 제조[C] → 충진포장[C] → 출하검사[G] → 판매출고[I] → 거래명세서/세금계산서[I,L] → 미수금[I] → 수금[I] → 회계전표[K]

### R&D → 생산 흐름
처방작성[A] → 성분검증[A] → 처방확정(전자결재)[Q] → 제품표준서[A] → BOM등록[C] → 작업지시[C]

### 생산 → 원가 흐름
BOM 재료비[C] + 작업시간 노무비 + 설비 경비[O] → 제품별 원가[H] → 회계전표[K] → 손익계산서[K]

### 전자결재 연동 포인트
- 처방 확정: A → Q
- 구매/발주 승인: E → Q (일정 금액 이상)
- 품질 판정: G → Q (부적합, CAPA)
- 출하 승인: I → Q
- 외주 발주 승인: P → Q

---

## 11. 코딩 컨벤션

### 파일/폴더
- 컴포넌트: PascalCase (예: `InventoryList.tsx`)
- 훅: camelCase, use 접두사 (예: `useInventory.ts`)
- 서비스: camelCase, .service 접미사 (예: `auth.service.ts`)
- 타입: PascalCase, 인터페이스는 I 접두사 생략 (예: `Item`, `Partner`)
- 상수: UPPER_SNAKE_CASE (예: `SESSION_TIMEOUT`)

### React
- 함수형 컴포넌트만 사용 (클래스 컴포넌트 금지)
- 상태관리: Zustand (React Context 최소화)
- 데이터 페칭: @tanstack/react-query (직접 useEffect fetch 지양)
- 폼 관리: react-hook-form + zod 유효성 검증

### TypeScript
- `any` 타입 사용 금지 → `unknown` 사용 후 타입 가드
- 모든 Firestore 문서에 대응하는 타입 정의 필수
- enum 대신 `as const` 사용

### 스타일
- Tailwind CSS만 사용 (인라인 style, CSS 모듈 지양)
- 반응형: mobile-first (`sm:`, `md:`, `lg:`)

### 주석
- 한국어 주석 사용
- 복잡한 비즈니스 로직에는 반드시 주석 작성
- JSDoc 형식으로 함수 설명

### Git
- 커밋 메시지: `[모듈코드] 작업내용` (예: `[B] 재고 입출고 Cloud Function 구현`)
- 브랜치: `phase1/inventory`, `phase2/rnd` 등

---

## 12. .gitignore

```
# Firebase 키 (절대 커밋 금지)
serviceAccountKey.json
**/serviceAccountKey*.json
*.key

# 환경변수
.env
.env.local
.env.production

# Firebase
firebase-debug.log
firebase-debug.*.log
.firebase/

# 빌드
node_modules/
dist/
build/
.cache/

# IDE
.vscode/settings.json
*.swp
*.swo
.DS_Store
```

---

## 13. 감사 로그 이벤트

| 이벤트 | 설명 | 보존 |
|--------|------|------|
| LOGIN_SUCCESS | 로그인 성공 | 1년 |
| LOGIN_FAILED | 로그인 실패 | 1년 |
| LOGOUT | 로그아웃 (수동/타임아웃) | 1년 |
| ROLE_CHANGED | 역할 변경 | 영구 |
| INVENTORY_IN | 재고 입고 | 5년 |
| INVENTORY_OUT | 재고 출고 | 5년 |
| INVENTORY_ADJUST | 재고 조정 (실사) | 5년 |
| MASTER_CREATED | 마스터 데이터 생성 | 3년 |
| MASTER_UPDATED | 마스터 데이터 수정 | 3년 |
| MASTER_DELETED | 마스터 데이터 삭제 | 영구 |
| FORMULA_ACCESSED | 처방 데이터 열람 | 영구 |
| FORMULA_MODIFIED | 처방 데이터 수정 | 영구 |
| APPROVAL_CREATED | 결재 기안 | 5년 |
| APPROVAL_APPROVED | 결재 승인 | 5년 |
| APPROVAL_REJECTED | 결재 반려 | 5년 |
| JOURNAL_CREATED | 회계 전표 생성 | 영구 |
| JOURNAL_LOCKED | 회계 전표 확정 | 영구 |

---

## 14. 자주 참조할 외부 사양

- **알러젠 검증**: EU 규정 2023/1545 — 화학물질 54종 + 자연추출물질 27종 = 81종
  - Leave-on: 0.001% 초과 시 표기
  - Rinse-off: 0.01% 초과 시 표기
- **저울**: AND FG-150KAL-H — RS232C 통신, 9600bps, 8bit, None parity, 1 stop bit
- **CGMP**: 식품의약품안전처 화장품 CGMP 해설서 기준
- **ISO 22716**: 화장품 GMP 국제표준

---

## 15. 지시 방법 가이드

Claude Code에 작업을 지시할 때 아래 형식을 따르면 효율적이다:

```
[Phase X] [모듈코드] 작업 내용

예시:
[Phase 1] [B] 재고 입출고 화면을 만들어줘. 
- 입고/출고 탭으로 구분
- 품목은 바코드 스캔 또는 검색으로 선택
- LOT 번호 자동 생성 (입고 시)
- Cloud Function으로 재고 처리
- 처리 완료 시 감사 로그 기록
```

### 작업 단위 권장 크기
- **한 번에 1개 화면 또는 1개 기능**을 지시하라
- 너무 큰 단위 (예: "재고관리 전체 만들어줘")는 피하라
- 화면 → 비즈니스 로직 → Cloud Function → 보안 규칙 순서로 지시하면 좋다

### 지시 전 체크
- [ ] 이 기능에 필요한 Firestore 컬렉션이 위 맵에 있는가?
- [ ] 이 기능의 보안 규칙이 firestore.rules에 반영되었는가?
- [ ] Cloud Functions가 필요한 기능인가? (재고/결재/암호화/감사로그)
- [ ] 어떤 역할이 이 기능을 사용할 수 있는가?
