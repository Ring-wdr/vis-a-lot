// 기본 시나리오. 데이터 플랫폼(FD)·디자인 시스템(DX) 두 그룹의 4주치 업무를 만든다.
// 모든 시각은 now 기준으로 계산하고, 난수는 고정 씨앗이라 같은 now면 같은 행이 나온다.
// 분포(docs/feed-prototype-spec.md 시드 표)는 아래 POSTS 표가 정하고 seed.test.ts가 확인한다.

import type { PostFormat, PostStatus } from "../db";
import { localDay } from "../time";
import { createRandom } from "./random";
import type { SnapshotRow, SnapshotTables } from "./snapshot";
import {
  chartThumbnail,
  codeThumbnail,
  imageThumbnail,
  videoThumbnail,
} from "./thumbnails";

const SEED = 20261023;
const MIN = 60_000;
const HOUR = 60 * MIN;

// 사용자: u1 FD 관리자(화면이 먼저 고르는 사용자), u2 DX 관리자, u3 시스템 관리자, u4~u8 멤버
const USERS = [
  ["u1", "김지훈", "jihoon.kim"],
  ["u2", "이서연", "seoyeon.lee"],
  ["u3", "박민수", "minsu.park"],
  ["u4", "최유진", "yujin.choi"],
  ["u5", "정하늘", "haneul.jung"],
  ["u6", "강도현", "dohyun.kang"],
  ["u7", "윤소영", "soyoung.yoon"],
  ["u8", "한재원", "jaewon.han"],
] as const;
const USER_NAME = new Map<string, string>(
  USERS.map(([id, name]) => [id, name]),
);
const USER_EMAIL = new Map<string, string>(
  USERS.map(([id, , mail]) => [id, `${mail}@example.com`]),
);

type GroupKey = "FD" | "DX";
const GROUPS = {
  FD: {
    id: "g_fd",
    name: "데이터 플랫폼",
    description:
      "설비·품질·생산 데이터를 모으고 대시보드와 리포트로 내보내는 팀",
    isPrivate: false,
    createdBy: "u1",
    admin: "u1",
    members: ["u2", "u4", "u5", "u6", "u7", "u8"],
    teams: ["수집·파이프라인", "분석·리포트"],
  },
  DX: {
    id: "g_dx",
    name: "디자인 시스템",
    description: "사내 대시보드용 컴포넌트·차트 가이드를 만드는 비공개 그룹",
    isPrivate: true,
    createdBy: "u2",
    admin: "u2",
    members: ["u1", "u5", "u6"],
    teams: ["컴포넌트", "시각화 가이드"],
  },
} as const;

const POST_TYPES = [
  ["bug", "버그", "#e5484d"],
  ["feature", "기능", "#3e63dd"],
  ["question", "질문", "#f5a524"],
  ["data", "데이터 요청", "#12a594"],
  ["worklog", "업무 기록", "#8e4ec6"],
] as const;
type TypeKey = (typeof POST_TYPES)[number][0];

const groupMembers = (g: GroupKey): string[] => [
  GROUPS[g].admin,
  ...GROUPS[g].members,
];

const S = {
  U: "unresolved",
  P: "in_progress",
  R: "in_review",
  S: "resolved",
  H: "on_hold",
  X: "cancelled",
} as const satisfies Record<string, PostStatus>;
const F = {
  i: "image",
  c: "chart",
  k: "code",
  v: "video",
} as const satisfies Record<string, PostFormat>;
const T = {
  B: "bug",
  F: "feature",
  Q: "question",
  D: "data",
  W: "worklog",
} as const satisfies Record<string, TypeKey>;

type PostSpec = {
  group: GroupKey;
  team: 0 | 1;
  type: TypeKey;
  format: PostFormat;
  status: PostStatus;
  title: string;
  author: string;
  assignee: string | null;
  requester: string | null;
  priority: number;
  /** 오늘 기준 기한(일). null이면 기한 없음 */
  due: number | null;
};

// 만든 순서. [그룹, 팀, 유형, 형식, 상태, 제목, 작성자, 담당자, 요청자, 우선순위, 기한]
// 열린 게시물 기한: 지난 것 #5 #10 #13 #21 #37, 이번 주 #23 #26 #30 #31 #35 #39 #47 #51
// u1이 요청자인 검토 중: #31 #43 (FD의 검토 중은 이 둘뿐이라 u1 승인 대기는 2개)
const ROWS: [
  GroupKey,
  0 | 1,
  keyof typeof T,
  keyof typeof F,
  keyof typeof S,
  string,
  string,
  string | null,
  string | null,
  number,
  number | null,
][] = [
  [
    "FD",
    1,
    "W",
    "c",
    "S",
    "8월 설비 가동률 리포트 정리",
    "u4",
    "u4",
    "u1",
    2,
    -20,
  ], // 1
  [
    "FD",
    0,
    "F",
    "c",
    "P",
    "3분기 설비 데이터 파이프라인 이관",
    "u1",
    "u5",
    "u1",
    3,
    12,
  ], // 2
  [
    "FD",
    0,
    "B",
    "k",
    "S",
    "MES 수집 배치가 새벽에 중복 적재됨",
    "u6",
    "u5",
    "u4",
    4,
    -18,
  ], // 3
  ["DX", 0, "F", "c", "P", "차트 컴포넌트 v2 설계", "u2", "u6", "u2", 3, 14], // 4
  [
    "FD",
    1,
    "D",
    "i",
    "P",
    "품질팀 불량 유형별 월간 집계 요청",
    "u7",
    "u4",
    "u7",
    2,
    -3,
  ], // 5
  [
    "FD",
    1,
    "W",
    "i",
    "S",
    "주간 데이터 품질 점검 (9월 4주차)",
    "u8",
    "u8",
    "u1",
    1,
    null,
  ], // 6
  [
    "FD",
    0,
    "F",
    "k",
    "S",
    "Airflow DAG 이관: 설비 이벤트",
    "u5",
    "u5",
    "u1",
    2,
    -10,
  ], // 7
  [
    "FD",
    1,
    "Q",
    "i",
    "X",
    "사출 라인 온도 단위 확인",
    "u6",
    null,
    null,
    1,
    null,
  ], // 8
  [
    "DX",
    0,
    "B",
    "i",
    "R",
    "툴팁이 차트 영역 밖으로 잘림",
    "u5",
    "u5",
    "u2",
    3,
    null,
  ], // 9
  [
    "FD",
    0,
    "F",
    "k",
    "P",
    "MES 수집 에이전트 인증서 갱신",
    "u5",
    "u6",
    "u1",
    4,
    -2,
  ], // 10
  ["FD", 1, "W", "c", "S", "9월 생산 KPI 월간 보고", "u1", "u1", "u1", 2, -14], // 11
  ["FD", 1, "F", "c", "P", "생산 KPI 대시보드 개편", "u1", "u7", "u1", 3, 20], // 12
  [
    "FD",
    1,
    "B",
    "i",
    "P",
    "라인별 OEE 계산에 계획 정지 시간이 포함됨",
    "u4",
    "u7",
    "u4",
    3,
    -5,
  ], // 13
  ["DX", 0, "F", "i", "P", "색상 토큰 정리", "u2", "u1", "u2", 2, 9], // 14
  [
    "FD",
    0,
    "F",
    "i",
    "S",
    "Airflow DAG 이관: 품질 검사 결과",
    "u5",
    "u8",
    "u1",
    2,
    -8,
  ], // 15
  [
    "FD",
    1,
    "D",
    "i",
    "U",
    "원자재 입고 데이터 샘플 요청",
    "u4",
    null,
    "u3",
    1,
    null,
  ], // 16
  [
    "FD",
    1,
    "W",
    "i",
    "S",
    "주간 데이터 품질 점검 (10월 1주차)",
    "u8",
    "u8",
    "u1",
    1,
    null,
  ], // 17
  [
    "FD",
    1,
    "B",
    "i",
    "S",
    "리포트 필터가 저장되지 않음",
    "u7",
    "u6",
    "u7",
    3,
    -9,
  ], // 18
  [
    "DX",
    0,
    "F",
    "i",
    "P",
    "토큰 문서 사이트 검색 개선",
    "u6",
    "u6",
    "u2",
    1,
    null,
  ], // 19
  [
    "FD",
    0,
    "F",
    "k",
    "P",
    "Airflow DAG 이관: 설비 알람",
    "u5",
    "u5",
    "u1",
    2,
    10,
  ], // 20
  [
    "FD",
    0,
    "Q",
    "i",
    "U",
    "설비 마스터의 라인 코드 기준이 두 가지임",
    "u6",
    "u5",
    null,
    2,
    -4,
  ], // 21
  [
    "FD",
    0,
    "B",
    "v",
    "H",
    "라인 3 센서 데이터 적재 누락",
    "u4",
    "u5",
    "u4",
    3,
    null,
  ], // 22
  [
    "FD",
    1,
    "W",
    "c",
    "P",
    "생산계획 대비 실적 쿼리 최적화",
    "u8",
    "u8",
    "u1",
    2,
    4,
  ], // 23
  [
    "FD",
    0,
    "F",
    "i",
    "U",
    "Airflow DAG 이관: 에너지 사용량",
    "u5",
    "u4",
    "u1",
    2,
    15,
  ], // 24
  ["DX", 1, "F", "c", "S", "막대 차트 접근성 패턴", "u6", "u6", "u2", 2, -6], // 25
  [
    "FD",
    1,
    "D",
    "c",
    "P",
    "공정별 수율 추이 데이터 요청",
    "u7",
    "u4",
    "u7",
    3,
    2,
  ], // 26
  [
    "FD",
    1,
    "W",
    "i",
    "S",
    "주간 데이터 품질 점검 (10월 2주차)",
    "u8",
    "u8",
    "u1",
    1,
    null,
  ], // 27
  [
    "FD",
    1,
    "B",
    "i",
    "X",
    "대시보드 필터 초기화 안 됨",
    "u2",
    null,
    "u2",
    2,
    null,
  ], // 28
  [
    "FD",
    1,
    "F",
    "c",
    "S",
    "KPI 대시보드: 라인 비교 차트",
    "u7",
    "u7",
    "u1",
    2,
    -4,
  ], // 29
  [
    "DX",
    0,
    "B",
    "k",
    "R",
    "범례 클릭 시 시리즈 토글이 안 됨",
    "u5",
    "u5",
    "u2",
    3,
    5,
  ], // 30
  ["FD", 0, "W", "k", "R", "검사기 로그 파서 리팩터링", "u6", "u6", "u1", 2, 1], // 31
  [
    "FD",
    1,
    "Q",
    "i",
    "U",
    "주간 보고 기준 요일 문의",
    "u4",
    null,
    null,
    1,
    null,
  ], // 32
  [
    "FD",
    1,
    "F",
    "i",
    "H",
    "외부 협력사 데이터 공유 포털",
    "u2",
    "u1",
    "u3",
    2,
    25,
  ], // 33
  [
    "DX",
    1,
    "W",
    "i",
    "S",
    "디자인 리뷰 회의록 (10월 2주차)",
    "u6",
    "u6",
    "u2",
    1,
    null,
  ], // 34
  [
    "FD",
    0,
    "D",
    "i",
    "U",
    "설비 고장 이력 2년치 추출 요청",
    "u7",
    "u5",
    "u7",
    2,
    3,
  ], // 35
  [
    "FD",
    1,
    "W",
    "c",
    "P",
    "에너지 사용량 이상치 탐지 실험",
    "u4",
    "u4",
    "u1",
    2,
    null,
  ], // 36
  [
    "FD",
    0,
    "B",
    "i",
    "U",
    "야간 배치 실패 알림이 메일로 안 옴",
    "u6",
    "u8",
    "u6",
    3,
    -1,
  ], // 37
  ["DX", 1, "F", "c", "U", "다크 모드 차트 팔레트", "u1", "u5", "u2", 2, null], // 38
  [
    "FD",
    1,
    "F",
    "c",
    "P",
    "KPI 대시보드: 목표 대비 실적 위젯",
    "u7",
    "u4",
    "u1",
    2,
    6,
  ], // 39
  [
    "FD",
    1,
    "W",
    "i",
    "U",
    "주간 데이터 품질 점검 (10월 3주차)",
    "u8",
    "u8",
    "u1",
    1,
    null,
  ], // 40
  ["FD", 0, "W", "i", "P", "설비 데이터 사전 작성", "u5", "u5", "u1", 1, null], // 41
  ["DX", 1, "F", "i", "R", "차트 빈 상태 일러스트", "u6", "u6", "u2", 2, 8], // 42
  [
    "FD",
    1,
    "F",
    "c",
    "R",
    "주간 업무 보고 자동 초안",
    "u4",
    "u4",
    "u1",
    3,
    null,
  ], // 43
  [
    "DX",
    0,
    "Q",
    "i",
    "U",
    "아이콘 사용 가이드 최신본 위치",
    "u5",
    null,
    null,
    0,
    null,
  ], // 44
  ["FD", 1, "W", "c", "U", "10월 생산 KPI 월간 보고", "u1", "u1", "u1", 2, 9], // 45
  [
    "DX",
    0,
    "W",
    "k",
    "U",
    "Storybook 시각 회귀 테스트 도입",
    "u5",
    "u5",
    "u2",
    2,
    null,
  ], // 46
  [
    "FD",
    1,
    "B",
    "k",
    "U",
    "수율 쿼리에서 재작업 건 중복 집계",
    "u4",
    "u6",
    "u4",
    3,
    0,
  ], // 47
  [
    "FD",
    1,
    "D",
    "i",
    "H",
    "자재 소요량 예측용 과거 데이터",
    "u7",
    "u4",
    "u7",
    1,
    null,
  ], // 48
  [
    "FD",
    1,
    "F",
    "i",
    "U",
    "KPI 대시보드: 모바일 레이아웃",
    "u7",
    null,
    "u1",
    1,
    null,
  ], // 49
  ["DX", 0, "Q", "i", "U", "아이콘 크기 기준 문의", "u1", null, null, 0, null], // 50
  [
    "FD",
    0,
    "W",
    "v",
    "P",
    "라인 2 영상 검사 데모 정리",
    "u6",
    "u6",
    "u1",
    2,
    2,
  ], // 51
  [
    "FD",
    0,
    "B",
    "v",
    "U",
    "설비 상세 화면 로딩이 느림",
    "u5",
    "u8",
    "u5",
    2,
    null,
  ], // 52
  [
    "DX",
    1,
    "B",
    "v",
    "H",
    "차트 전환 애니메이션 프레임 드랍",
    "u5",
    "u5",
    "u2",
    2,
    null,
  ], // 53
  [
    "FD",
    1,
    "D",
    "i",
    "U",
    "협력사별 납기 준수율 데이터",
    "u2",
    null,
    "u3",
    2,
    null,
  ], // 54
  [
    "FD",
    1,
    "W",
    "i",
    "U",
    "주간 데이터 품질 점검 (10월 4주차)",
    "u8",
    "u8",
    "u1",
    1,
    13,
  ], // 55
  [
    "FD",
    0,
    "B",
    "v",
    "U",
    "모니터링 화면 영상 스트림 끊김",
    "u6",
    null,
    "u6",
    4,
    null,
  ], // 56
  ["DX", 0, "F", "i", "X", "버튼 그림자 토큰 추가", "u6", null, "u6", 1, null], // 57
  [
    "FD",
    0,
    "W",
    "c",
    "U",
    "설비 가동률 일일 리포트 자동화",
    "u5",
    "u5",
    "u1",
    2,
    null,
  ], // 58
  [
    "DX",
    1,
    "F",
    "k",
    "R",
    "날짜 선택기 키보드 탐색",
    "u5",
    "u6",
    "u5",
    2,
    null,
  ], // 59
  ["FD", 1, "Q", "k", "U", "SQL 템플릿 공유 방법", "u4", null, null, 0, null], // 60
];

export const POSTS: PostSpec[] = ROWS.map(
  ([
    group,
    team,
    type,
    format,
    status,
    title,
    author,
    assignee,
    requester,
    priority,
    due,
  ]) => ({
    group,
    team,
    type: T[type],
    format: F[format],
    status: S[status],
    title,
    author,
    assignee,
    requester,
    priority,
    due,
  }),
);

/** 상위 → 하위 (게시물 번호, 1부터) */
const PARENTS: Record<number, number[]> = {
  2: [7, 15, 20, 24],
  12: [29, 39, 49],
  4: [25, 42, 38],
};
/** [막는 것, 막힌 것] */
const BLOCKS: [number, number][] = [
  [10, 22],
  [14, 38],
];
/** [중복, 원본] */
const DUPLICATES: [number, number][] = [[28, 18]];
/** 보류: 사유, 재개일(오늘 기준 일) */
const HOLDS: Record<number, [string, number]> = {
  22: ["dependency", 1],
  33: ["decision", 7],
  48: ["resource", 10],
  53: ["dependency", 5],
};
const CANCELS: Record<number, string> = {
  8: "out_of_scope",
  28: "duplicate",
  57: "low_priority",
};
/** 반려 뒤 다시 승인된 게시물 */
const REJECTED_ONCE = new Set([3, 18]);
const PINNED = new Set([2, 12, 4]);
/** 체크리스트: [항목, 끝낸 개수] */
const CHECKLISTS: Record<number, [string[], number]> = {
  1: [["가동률 원천 테이블 확인", "라인별 집계 쿼리", "보고서 공유"], 3],
  3: [["중복 키 확인", "배치 잠금 추가", "중복 행 정리", "재발 모니터링"], 4],
  10: [["인증서 발급 요청", "스테이징 교체", "운영 교체", "만료 알림 등록"], 2],
  13: [["계획 정지 코드 정리", "OEE 계산식 수정", "과거 데이터 재계산"], 1],
  23: [["실행 계획 확인", "인덱스 추가", "결과 비교"], 2],
  26: [["공정 목록 확인", "기간·단위 합의", "추출", "품질팀 공유"], 1],
  31: [["파서 모듈 분리", "단위 테스트", "운영 로그로 검증"], 3],
  36: [["기준선 모델", "임계값 실험"], 1],
  43: [["활동 로그 집계", "템플릿 문장", "AI 초안 연결", "미리보기"], 4],
  51: [
    ["영상 편집", "검출 결과 오버레이", "설명 자막", "데모 리허설", "공유"],
    3,
  ],
  30: [["재현", "이벤트 핸들러 수정"], 2],
};
const ATTACHMENTS: [number, "file" | "link", string, string][] = [
  [5, "link", "불량 유형 코드표", "https://example.com/docs/defect-codes"],
  [
    16,
    "file",
    "원자재 입고 샘플.csv",
    "https://example.com/files/raw-material-sample.csv",
  ],
  [
    35,
    "link",
    "설비 고장 이력 테이블 명세",
    "https://example.com/docs/equipment-failure",
  ],
  [25, "link", "WCAG 대비 기준", "https://example.com/docs/contrast"],
];
const FOLLOWS: [string, string][] = [
  ["u1", "u4"],
  ["u1", "u5"],
  ["u4", "u1"],
  ["u7", "u8"],
  ["u2", "u6"],
];

const BODY_TEXT: Record<TypeKey, (title: string) => string> = {
  bug: (t) => `${t}. 재현 조건과 영향 범위를 정리했고, 로그는 댓글로 붙입니다.`,
  feature: (t) =>
    `${t} 작업입니다. 범위와 완료 기준은 체크리스트로 관리합니다.`,
  question: (t) => `${t}에 대해 기준을 알고 계신 분 답변 부탁드립니다.`,
  data: (t) =>
    `${t}. 필요한 기간·컬럼·형식을 적었습니다. 기한 전에 공유 부탁드립니다.`,
  worklog: (t) =>
    `${t} 내용을 기록합니다. 진행 상황과 다음 할 일을 정리했습니다.`,
};

const CODE_SNIPPETS = [
  {
    language: "sql",
    code: "select line_id, date_trunc('day', ts) as d, avg(oee) as oee\nfrom mes.oee_hourly\nwhere ts >= current_date - 7\ngroup by 1, 2\norder by 1, 2;",
  },
  {
    language: "python",
    code: "import pandas as pd\n\ndf = pd.read_parquet('sensor_line3.parquet')\nmissing = df[df['value'].isna()].groupby('sensor_id').size()\nprint(missing.sort_values(ascending=False).head(10))",
  },
  {
    language: "r",
    code: "library(dplyr)\n\nyield <- read.csv('yield.csv') |>\n  group_by(process) |>\n  summarise(rate = mean(good / total))",
  },
] as const;

const COMMENT_TEXTS = [
  "원천 테이블 기준으로 다시 확인해 보겠습니다.",
  "어제 배치 로그 첨부합니다. 02시 이후부터 같은 현상입니다.",
  "범위를 이번 주 안으로 줄이면 기한 맞출 수 있을 것 같아요.",
  "대시보드에 반영된 숫자랑 원천 숫자가 1% 정도 차이 납니다.",
  "품질팀 쪽 요구사항 한 번 더 받아서 정리하겠습니다.",
  "스테이징에서는 정상입니다. 운영 설정 차이로 보입니다.",
  "샘플 결과 공유드려요. 라인 2만 값이 튑니다.",
  "이거 지난달에도 비슷한 이슈 있었던 것 같습니다.",
  "쿼리 실행 시간이 40초에서 6초로 줄었습니다.",
  "차트 색은 디자인 시스템 토큰 기준으로 맞췄습니다.",
  "다음 주 월요일 회의 때 같이 보면 좋겠습니다.",
  "우선순위 높여야 할 것 같아요. 생산팀에서 매일 보는 화면입니다.",
  "테스트 데이터로 확인 완료했습니다.",
  "컬럼 정의서 링크 업데이트했습니다.",
  "담당 바꿔야 하면 말씀 주세요.",
  "임시로 수동 추출해서 드렸습니다. 자동화는 이어서 진행할게요.",
];
const REPLY_TEXTS = [
  "확인했습니다. 감사합니다!",
  "네, 그렇게 진행하면 될 것 같아요.",
  "저도 같은 현상 봤습니다.",
  "그 부분은 제가 볼게요.",
  "좋습니다. 회의 때 다시 얘기해요.",
  "수정 반영했습니다. 다시 한 번 봐주세요.",
  "숫자 맞는 것 확인했습니다.",
  "혹시 기준 날짜가 UTC인가요?",
];
const MENTION_TEXTS = [
  "님 이 부분 확인 부탁드립니다.",
  "님 의견 주시면 반영하겠습니다.",
  "님 권한 요청 승인해 주실 수 있을까요?",
  "님 지난번 기준이랑 같은지 봐주세요.",
];
const REJECT_TEXT =
  "검증 결과가 원천 숫자와 맞지 않아 반려합니다. 수정 후 다시 요청해 주세요.";
const EMOJIS = ["👍", "🎉", "👀", "❤️", "🙏"];

type Planned = {
  t: number;
  kind: string;
  actor: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  comment?: CommentDraft;
  /** 게시물 updated_at에 반영되는 변경인지 */
  touches?: boolean;
};
type CommentDraft = {
  id: string;
  postIndex: number;
  author: string;
  parent: CommentDraft | null;
  text: string;
  mention: string | null;
  t: number;
};

const doc = (content: unknown[]) => ({
  type: "doc",
  content: [{ type: "paragraph", content }],
});

/** 기본 시나리오의 모든 행. now 기준 4주치 */
export function buildDefaultScenario(now: Date): SnapshotTables {
  const random = createRandom(SEED);
  const nowMs = now.getTime();
  /** 시드의 마지막 활동은 지금보다 조금 앞에 둔다 */
  const limit = nowMs - 45 * MIN;
  const today = localDay(now);
  const dayStart = (daysAgo: number) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d.getTime();
  };
  const isoAt = (t: number) => new Date(t).toISOString();

  // 사용자·그룹·팀·유형
  const users = USERS.map(([id, name]) => ({
    id,
    name,
    email: USER_EMAIL.get(id),
    is_admin: id === "u3",
    active: true,
  }));
  const groups: SnapshotRow[] = [];
  const members: SnapshotRow[] = [];
  const teams: SnapshotRow[] = [];
  const postTypes: SnapshotRow[] = [];
  for (const key of ["FD", "DX"] as const) {
    const g = GROUPS[key];
    const lower = key.toLowerCase();
    groups.push({
      id: g.id,
      name: g.name,
      key_prefix: key,
      description: g.description,
      is_private: g.isPrivate,
      next_seq: POSTS.filter((p) => p.group === key).length + 1,
      status_names: {},
      created_by: g.createdBy,
    });
    members.push({ group_id: g.id, user_id: g.admin, role: "admin" });
    for (const u of g.members)
      members.push({ group_id: g.id, user_id: u, role: "member" });
    g.teams.forEach((name, i) => {
      teams.push({ id: `t_${lower}_${i + 1}`, group_id: g.id, name });
    });
    POST_TYPES.forEach(([type, name, color], i) => {
      postTypes.push({
        id: `pt_${lower}_${type}`,
        group_id: g.id,
        name,
        color,
        sort: i,
      });
    });
  }

  // 만든 날: 28일 전부터 어제까지 하루 1~3개 (기본 2개, 7일은 3개, 3일은 1개)
  const perDay = Array.from({ length: 28 }, () => 2);
  const days = random.shuffle(Array.from({ length: 28 }, (_, i) => i));
  for (const i of days.slice(0, 7)) perDay[i] = 3;
  for (const i of days.slice(7, 10)) perDay[i] = 1;
  const createdDaysAgo: number[] = [];
  perDay.forEach((n, i) => {
    for (let k = 0; k < n; k++) createdDaysAgo.push(28 - i);
  });

  // 게시물 기본 행
  const seqs = { FD: 0, DX: 0 };
  const childOf = new Map<number, number>();
  for (const [parent, children] of Object.entries(PARENTS))
    for (const c of children) childOf.set(c, Number(parent));

  // 같은 날 안에서도 번호 순서가 만든 순서가 되게 시각을 정렬한다
  const createdTimes = createdDaysAgo
    .map((d) => dayStart(d) + 9 * HOUR + random.int(0, 8 * 60) * MIN)
    .sort((a, b) => a - b);

  let videoNo = 0;
  let codeNo = 0;
  const posts = POSTS.map((spec, i) => {
    const n = i + 1;
    const seq = ++seqs[spec.group];
    const lower = spec.group.toLowerCase();
    const createdAt = createdTimes[i];
    let thumbnail: string;
    let payload: unknown;
    if (spec.format === "chart") {
      const kind = random.next() < 0.5 ? "bar" : "line";
      const series = Array.from({ length: 8 }, () => random.int(20, 95));
      thumbnail = chartThumbnail(kind, series);
      payload = { kind, series };
    } else if (spec.format === "image") {
      thumbnail = imageThumbnail(random);
      payload = { src: thumbnail };
    } else if (spec.format === "video") {
      thumbnail = videoThumbnail(random);
      payload = { url: `https://example.com/videos/${++videoNo}.mp4` };
    } else {
      thumbnail = codeThumbnail(random);
      payload = CODE_SNIPPETS[codeNo++ % CODE_SNIPPETS.length];
    }
    const others = groupMembers(spec.group).filter(
      (u) => u !== spec.author && u !== spec.assignee && u !== spec.requester,
    );
    const stakeholders = random
      .shuffle(others)
      .slice(0, random.int(0, 2))
      .sort();
    const tags: string[] = [];
    if (spec.title.includes("KPI")) tags.push("KPI");
    if (spec.title.includes("Airflow")) tags.push("airflow");
    if (/대시보드|차트/.test(spec.title)) tags.push("대시보드");
    if (/품질|불량|수율/.test(spec.title)) tags.push("품질");
    if (spec.type === "worklog") tags.push("주간보고");
    return {
      n,
      spec,
      createdAt,
      stakeholders,
      row: {
        id: `p_${lower}_${seq}`,
        group_id: GROUPS[spec.group].id,
        seq,
        key: `${spec.group}-${seq}`,
        team_id: `t_${lower}_${spec.team + 1}`,
        post_type_id: `pt_${lower}_${spec.type}`,
        format: spec.format,
        title: spec.title,
        body: doc([{ type: "text", text: BODY_TEXT[spec.type](spec.title) }]),
        status: spec.status,
        priority: spec.priority,
        progress: 0,
        author_id: spec.author,
        assignee_id: spec.assignee,
        requester_id: spec.requester,
        parent_id: null as string | null,
        due_date: spec.due == null ? null : localDay(now, spec.due),
        hold_until: HOLDS[n] ? localDay(now, HOLDS[n][1]) : null,
        close_reason: HOLDS[n]?.[0] ?? CANCELS[n] ?? null,
        reopen_count: 0,
        thumbnail,
        payload,
        tags,
        pinned_at: PINNED.has(n) ? isoAt(createdAt + 2 * HOUR) : null,
        created_at: isoAt(createdAt),
        updated_at: isoAt(createdAt),
        resolved_at: null as string | null,
        deleted_at: null,
      } satisfies SnapshotRow,
    };
  });
  const postAt = (n: number) => posts[n - 1];
  for (const [child, parent] of childOf)
    postAt(child).row.parent_id = postAt(parent).row.id;

  // 상태 이력: 배정 → 시작 → (완료 요청 → 반려?) → 승인 / 보류 / 취소
  const timelines: Planned[][] = posts.map(() => []);
  posts.forEach((p, i) => {
    const { spec } = p;
    const tl = timelines[i];
    tl.push({
      t: p.createdAt,
      kind: "created",
      actor: spec.author,
      touches: true,
    });
    let t = p.createdAt;
    if (spec.assignee) {
      t += random.int(10, 120) * MIN;
      tl.push({
        t,
        kind: "assignee",
        actor: spec.author,
        field: "assignee",
        oldValue: null,
        newValue: spec.assignee,
        touches: true,
      });
    }
    const approver = spec.requester ?? spec.author;
    const steps: string[] = {
      unresolved: [],
      in_progress: ["start"],
      in_review: ["start", "review"],
      resolved: REJECTED_ONCE.has(p.n)
        ? ["start", "review", "reject", "review", "approve"]
        : ["start", "review", "approve"],
      on_hold: spec.assignee ? ["start", "hold"] : ["hold"],
      cancelled: ["cancel"],
    }[spec.status];
    // 닫힌 게시물은 앞쪽에서 끝내고, 열린 게시물은 최근까지 이어진다
    const end = spec.status === "resolved" ? 0.8 : 0.95;
    const span = limit - t;
    const fractions = steps
      .map(() => 0.08 + random.next() * (end - 0.08))
      .sort((a, b) => a - b);
    let cur: PostStatus = "unresolved";
    const status = (at: number, actor: string, next: PostStatus) => {
      tl.push({
        t: at,
        kind: "status",
        actor,
        field: "status",
        oldValue: cur,
        newValue: next,
        touches: true,
      });
      cur = next;
    };
    steps.forEach((step, k) => {
      const at = t + Math.round(span * fractions[k]);
      const assignee = spec.assignee ?? approver;
      if (step === "start") status(at, assignee, "in_progress");
      else if (step === "review") {
        tl.push({
          t: at,
          kind: "review_requested",
          actor: assignee,
          touches: true,
        });
        status(at + 1000, assignee, "in_review");
      } else if (step === "approve") {
        tl.push({ t: at, kind: "approved", actor: approver, touches: true });
        status(at + 1000, approver, "resolved");
        p.row.resolved_at = isoAt(at + 1000);
      } else if (step === "reject") {
        const comment: CommentDraft = {
          id: "",
          postIndex: i,
          author: approver,
          parent: null,
          text: REJECT_TEXT,
          mention: null,
          t: at,
        };
        tl.push({ t: at, kind: "comment", actor: approver, comment });
        tl.push({
          t: at + 1000,
          kind: "rejected",
          actor: approver,
          touches: true,
        });
        status(at + 2000, approver, "in_progress");
      } else if (step === "hold")
        status(at, spec.assignee ?? spec.author, "on_hold");
      else if (step === "cancel")
        status(at, spec.requester ?? spec.author, "cancelled");
    });
    // 기한 초과 알림(scheduler가 하루 1회 만드는 이벤트)을 기한 다음 날 첫 실행 시각에
    const open = ["unresolved", "in_progress", "in_review"].includes(
      spec.status,
    );
    if (open && spec.due != null && spec.due < 0) {
      const at = dayStart(-spec.due - 1) + MIN;
      if (at < limit)
        tl.push({
          t: at,
          kind: "overdue",
          actor: spec.author,
          field: "due_date",
          newValue: p.row.due_date,
        });
    }
  });

  // 댓글: 위 반려 댓글 + 투표 댓글 1 + 나머지 최상위, 대댓글 40
  const comments: CommentDraft[] = timelines
    .flat()
    .flatMap((e) => (e.comment ? [e.comment] : []));
  const participants = (i: number) => {
    const p = posts[i];
    const set = new Set([
      ...groupMembers(p.spec.group),
      p.spec.author,
      ...(p.spec.requester ? [p.spec.requester] : []),
    ]);
    return [...set];
  };
  const commentTime = (after: number) =>
    after + 30 * MIN + Math.round(random.next() * (limit - after - 60 * MIN));
  const pollPost = 11; // #12 생산 KPI 대시보드 개편
  const pollComment: CommentDraft = {
    id: "",
    postIndex: pollPost,
    author: "u7",
    parent: null,
    text: "대시보드 기본 조회 기간을 정하려고 합니다. 투표 부탁드려요.",
    mention: null,
    t: commentTime(posts[pollPost].createdAt + 6 * HOUR),
  };
  comments.push(pollComment);
  while (comments.length < 80) {
    const i = random.int(0, posts.length - 1);
    comments.push({
      id: "",
      postIndex: i,
      author: random.pick(participants(i)),
      parent: null,
      text: random.pick(COMMENT_TEXTS),
      mention: null,
      t: commentTime(posts[i].createdAt),
    });
  }
  const topLevel = [...comments];
  for (let k = 0; k < 40; k++) {
    const parent = random.pick(topLevel);
    const authors = participants(parent.postIndex).filter(
      (u) => u !== parent.author,
    );
    comments.push({
      id: "",
      postIndex: parent.postIndex,
      author: random.pick(authors),
      parent,
      text: random.pick(REPLY_TEXTS),
      mention: null,
      t:
        parent.t +
        10 * MIN +
        Math.round(random.next() * (limit - parent.t - 10 * MIN)),
    });
  }
  // 멘션 15개: 앞의 6개는 u1을 부른다 (첫 사용자 알림함용)
  let mentions = 0;
  for (const c of random.shuffle(comments)) {
    if (mentions === 15) break;
    if (c.text === REJECT_TEXT || c === pollComment) continue;
    const candidates = participants(c.postIndex)
      .concat(posts[c.postIndex].spec.group === "FD" ? ["u3"] : [])
      .filter((u) => u !== c.author);
    const target =
      mentions < 6
        ? candidates.includes("u1")
          ? "u1"
          : null
        : random.pick(candidates);
    if (!target) continue;
    c.mention = target;
    c.text = random.pick(MENTION_TEXTS);
    mentions++;
  }
  for (const c of comments) {
    if (c.text === REJECT_TEXT) continue; // 이미 타임라인에 있다
    const tl = timelines[c.postIndex];
    tl.push({ t: c.t, kind: "comment", actor: c.author, comment: c });
    if (c.mention)
      tl.push({
        t: c.t + 1000,
        kind: "mention",
        actor: c.author,
        newValue: c.mention,
        comment: c,
      });
  }

  // 게시물마다 시각이 겹치지 않게 정렬하고, 최종 시각을 댓글·게시물에 반영한다
  type Final = Planned & { postIndex: number };
  const allEvents: Final[] = [];
  timelines.forEach((tl, i) => {
    const sorted = tl
      .map((e, order) => ({ e, order }))
      .sort((a, b) => a.e.t - b.e.t || a.order - b.order)
      .map(({ e }) => e);
    let prev = -Infinity;
    let updated = posts[i].createdAt;
    for (const e of sorted) {
      e.t = Math.max(e.t, prev + 1000);
      prev = e.t;
      if (e.kind === "comment" && e.comment) e.comment.t = e.t;
      if (e.touches) updated = e.t;
      allEvents.push({ ...e, postIndex: i });
    }
    posts[i].row.updated_at = isoAt(updated);
  });
  allEvents.sort((a, b) => a.t - b.t || a.postIndex - b.postIndex);
  comments.sort((a, b) => a.t - b.t || a.postIndex - b.postIndex);
  comments.forEach((c, k) => {
    c.id = `c_${String(k + 1).padStart(3, "0")}`;
  });
  const events = allEvents.map((e, k) => ({
    id: `e_${String(k + 1).padStart(4, "0")}`,
    post_id: posts[e.postIndex].row.id,
    actor_id: e.actor,
    kind: e.kind,
    field: e.field ?? null,
    old_value: e.oldValue ?? null,
    new_value: e.newValue ?? null,
    comment_id: e.comment?.id ?? null,
    created_at: isoAt(e.t),
  }));

  const commentRows = comments.map((c) => ({
    id: c.id,
    post_id: posts[c.postIndex].row.id,
    author_id: c.author,
    parent_id: c.parent?.id ?? null,
    body: doc(
      c.mention
        ? [
            {
              type: "mention",
              attrs: { id: c.mention, label: USER_NAME.get(c.mention) },
            },
            { type: "text", text: ` ${c.text}` },
          ]
        : [{ type: "text", text: c.text }],
    ),
    resolved: false,
    pinned: false,
    created_at: isoAt(c.t),
    updated_at: null,
    deleted_at: null,
  }));

  // 반응 60개
  const reactions = new Map<string, SnapshotRow>();
  while (reactions.size < 60) {
    const c = random.pick(comments);
    const user = random.pick(
      participants(c.postIndex).filter((u) => u !== c.author),
    );
    const emoji = random.pick(EMOJIS);
    reactions.set(`${c.id}|${user}|${emoji}`, {
      comment_id: c.id,
      user_id: user,
      emoji,
    });
  }

  // 투표 1개
  const polls = [
    {
      id: "poll_1",
      comment_id: pollComment.id,
      question: "대시보드 기본 조회 기간",
      options: ["최근 7일", "최근 14일", "최근 30일"],
      closes_at: isoAt(nowMs + 3 * 24 * HOUR),
    },
  ];
  const pollVotes = [
    ["u1", 0],
    ["u4", 1],
    ["u5", 0],
    ["u8", 2],
  ].map(([user_id, option_idx]) => ({
    poll_id: "poll_1",
    user_id,
    option_idx,
  }));

  // 구독자: 작성자·담당자·요청자·이해관계자·댓글 작성자·멘션된 사람
  const subscribers = posts.map((p) => {
    const set = new Set<string>([p.spec.author, ...p.stakeholders]);
    if (p.spec.assignee) set.add(p.spec.assignee);
    if (p.spec.requester) set.add(p.spec.requester);
    return set;
  });
  for (const c of comments) {
    subscribers[c.postIndex].add(c.author);
    if (c.mention) subscribers[c.postIndex].add(c.mention);
  }

  // 체크리스트·진행률
  const checklist: SnapshotRow[] = [];
  for (const [n, [items, done]] of Object.entries(CHECKLISTS)) {
    const p = postAt(Number(n));
    items.forEach((text, k) => {
      checklist.push({
        id: `ck_${p.row.id.slice(2)}_${k + 1}`,
        post_id: p.row.id,
        text,
        done: k < done,
        sort: k,
      });
    });
    p.row.progress = Math.round((100 * done) / items.length);
  }
  for (const p of posts) {
    const n = p.n;
    if (CHECKLISTS[n] || PARENTS[n]) continue;
    p.row.progress = {
      unresolved: 0,
      in_progress: random.int(2, 7) * 10,
      in_review: 90,
      resolved: 100,
      on_hold: random.int(1, 4) * 10,
      cancelled: 0,
    }[p.spec.status];
  }
  for (const [n, children] of Object.entries(PARENTS)) {
    const done = children.filter(
      (c) => postAt(c).spec.status === "resolved",
    ).length;
    postAt(Number(n)).row.progress = Math.round((100 * done) / children.length);
  }

  const relations = [
    ...BLOCKS.map(([a, b]) => ["blocks", a, b] as const),
    ...DUPLICATES.map(([a, b]) => ["duplicate", a, b] as const),
  ].map(([kind, a, b]) => ({
    from_id: postAt(a).row.id,
    to_id: postAt(b).row.id,
    kind,
  }));

  // 알림: 받을 사람 후보를 이벤트마다 만든다 (자기가 한 일은 제외)
  const NOTIFY_KINDS = new Set([
    "assignee",
    "mention",
    "comment",
    "status",
    "review_requested",
    "approved",
    "rejected",
    "overdue",
  ]);
  const candidates = new Map<string, typeof events>();
  for (const [k, e] of events.entries()) {
    if (!NOTIFY_KINDS.has(e.kind)) continue;
    const i = allEvents[k].postIndex;
    let recipients: string[];
    if (e.kind === "assignee" || e.kind === "mention")
      recipients = [e.new_value as string];
    else if (e.kind === "overdue")
      recipients = [posts[i].spec.assignee as string];
    else recipients = [...subscribers[i]];
    for (const u of recipients) {
      if (!u || u === e.actor_id) continue;
      candidates.set(u, [...(candidates.get(u) ?? []), e]);
    }
  }
  const notifications: {
    user: string;
    event: (typeof events)[number];
    read: boolean;
  }[] = [];
  const pickFor = (
    user: string,
    unread: number,
    read: number,
    must: string[] = [],
  ) => {
    const list = [...(candidates.get(user) ?? [])].reverse(); // 최근 순
    const mustEvents = list.filter((e) => must.includes(e.id));
    const rest = list.filter((e) => !must.includes(e.id));
    const unreadEvents = [
      ...mustEvents,
      ...rest.slice(0, unread - mustEvents.length),
    ];
    const readEvents = rest.slice(
      unread - mustEvents.length,
      unread - mustEvents.length + read,
    );
    for (const event of unreadEvents)
      notifications.push({ user, event, read: false });
    for (const event of readEvents)
      notifications.push({ user, event, read: true });
  };
  // u1이 승인할 검토 요청 2건은 반드시 안읽음에
  const awaiting = posts
    .filter((p) => p.spec.status === "in_review" && p.spec.requester === "u1")
    .map(
      (p) =>
        events
          .filter(
            (e) => e.post_id === p.row.id && e.kind === "review_requested",
          )
          .at(-1)?.id as string,
    );
  pickFor("u1", 10, 15, awaiting);
  for (const u of ["u2", "u4", "u5", "u6", "u7", "u8"]) {
    const overdue = (candidates.get(u) ?? []).filter(
      (e) => e.kind === "overdue",
    );
    pickFor(
      u,
      2 + overdue.length,
      3,
      overdue.map((e) => e.id),
    );
  }
  notifications.sort(
    (a, b) =>
      a.event.id.localeCompare(b.event.id) || a.user.localeCompare(b.user),
  );
  const notificationRows = notifications.map(({ user, event, read }, k) => {
    const t = Date.parse(event.created_at);
    return {
      id: `n_${String(k + 1).padStart(3, "0")}`,
      user_id: user,
      event_id: event.id,
      read_at: read
        ? isoAt(Math.min(t + random.int(20, 300) * MIN, nowMs - 5 * MIN))
        : null,
      archived_at: null,
      created_at: event.created_at,
    };
  });

  // 발송 로그: 슬랙 기본값인 이벤트와 기한 초과(이메일)
  const SLACK_TEXT: Record<string, (actor: string) => string> = {
    assignee: (a) => `${a}님이 담당자로 지정했습니다`,
    mention: (a) => `${a}님이 회원님을 멘션했습니다`,
    review_requested: (a) => `${a}님이 완료를 요청했습니다`,
    rejected: (a) => `${a}님이 반려했습니다`,
    overdue: () => "기한이 지났습니다",
  };
  const outbox: SnapshotRow[] = [];
  for (const { user, event } of notifications) {
    const toText = SLACK_TEXT[event.kind];
    if (!toText) continue;
    const post = posts.find((p) => p.row.id === event.post_id)?.row;
    if (!post) continue;
    const line = `[${post.key}] ${post.title} — ${toText(USER_NAME.get(event.actor_id) ?? "")}`;
    outbox.push({
      channel: "slack",
      recipient: USER_EMAIL.get(user),
      subject: null,
      body: line,
      created_at: event.created_at,
    });
    if (event.kind === "overdue")
      outbox.push({
        channel: "email",
        recipient: USER_EMAIL.get(user),
        subject: `[${post.key}] 기한이 지났습니다`,
        body: `${post.title}의 기한(${post.due_date})이 지났습니다. 진행 상황을 갱신해 주세요.`,
        created_at: event.created_at,
      });
  }
  outbox.sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  outbox.forEach((row, k) => {
    row.id = `o_${String(k + 1).padStart(3, "0")}`;
  });

  // 저장된 뷰: 그룹마다 공유 뷰 2개(관리자 소유), u1 개인 뷰 1개
  const views: SnapshotRow[] = [];
  for (const key of ["FD", "DX"] as const) {
    const g = GROUPS[key];
    const lower = key.toLowerCase();
    views.push(
      {
        id: `v_${lower}_due`,
        owner_id: g.admin,
        group_id: g.id,
        name: "이번 주 기한",
        shared: true,
        layout: "list",
        filter: {
          groupIds: [g.id],
          dueFrom: today,
          dueTo: localDay(now, 6),
          categories: ["open"],
        },
        sort: { field: "dueDate", dir: "asc" },
        group_by: "assignee",
        pinned: true,
      },
      {
        id: `v_${lower}_review`,
        owner_id: g.admin,
        group_id: g.id,
        name: "검토 대기",
        shared: true,
        layout: "board",
        filter: { groupIds: [g.id], statuses: ["in_review"] },
        sort: { field: "updatedAt", dir: "asc" },
        group_by: null,
        pinned: true,
      },
    );
  }
  views.push({
    id: "v_u1_requested",
    owner_id: "u1",
    group_id: null,
    name: "내가 요청한 것",
    shared: false,
    layout: "feed",
    filter: { mine: "requested" },
    sort: { field: "updatedAt", dir: "desc" },
    group_by: null,
    pinned: true,
  });

  const templates = [
    {
      id: "rt_fd_weekly",
      owner_id: "u1",
      group_id: GROUPS.FD.id,
      name: "주간 업무 보고",
      kind: "activity",
      params: { rangeDays: 7, postTypeIds: ["pt_fd_worklog"] },
    },
    {
      id: "rt_fd_monthly",
      owner_id: "u1",
      group_id: GROUPS.FD.id,
      name: "월간 현황",
      kind: "status",
      params: { rangeDays: 30 },
    },
  ];

  return {
    users,
    groups,
    group_members: members,
    teams,
    post_types: postTypes,
    posts: posts.map((p) => p.row),
    post_stakeholders: posts.flatMap((p) =>
      p.stakeholders.map((user_id) => ({ post_id: p.row.id, user_id })),
    ),
    post_subscribers: posts.flatMap((p, i) =>
      [...subscribers[i]].sort().map((user_id) => ({
        post_id: p.row.id,
        user_id,
        muted: false,
      })),
    ),
    checklist_items: checklist,
    post_relations: relations,
    attachments: ATTACHMENTS.map(([n, kind, name, url], k) => ({
      id: `att_${k + 1}`,
      post_id: postAt(n).row.id,
      kind,
      name,
      url,
    })),
    user_follows: FOLLOWS.map(([follower_id, followee_id]) => ({
      follower_id,
      followee_id,
    })),
    comments: commentRows,
    reactions: [...reactions.values()],
    polls,
    poll_votes: pollVotes,
    events,
    notifications: notificationRows,
    outbox,
    saved_views: views,
    report_templates: templates,
  };
}
