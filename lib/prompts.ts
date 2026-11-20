/**
 * 프롬프트 형식 (학생 화면과 서버가 함께 사용)
 *
 * 처음 만들기: V·I·B·E 카드
 *   V (Vision)      무엇을 만들까?
 *   I (Interaction) 어떻게 작동할까?
 *   B (Body)        어떤 모습일까?
 *   E (Exception)   지켜야 할 조건은?
 *
 * 고치기:    바꿀 곳 → 바꿀 내용 → 그대로 둘 것
 * 버그 고치기: 내가 한 행동 → 기대한 결과 → 실제 결과 (+ 자동으로 잡힌 오류)
 */

export type CreatePrompt = { kind: "create"; vision: string; interaction: string; body: string; exception: string };
export type EditPrompt = { kind: "edit"; where: string; what: string; keep: string };
export type DebugPrompt = { kind: "debug"; action: string; expected: string; actual: string; errors: string[] };
export type FreePrompt = { kind: "free"; text: string };
export type StudentPrompt = CreatePrompt | EditPrompt | DebugPrompt | FreePrompt;

export type CardDef<K extends string> = {
  key: K;
  letter: string;
  title: string;
  question: string;
  placeholder: string;
  chips: string[];
  required: boolean;
  minLength: number;
  hint: string;
};

export const VIBE_CARDS: CardDef<"vision" | "interaction" | "body" | "exception">[] = [
  {
    key: "vision",
    letter: "V",
    title: "무엇을",
    question: "어떤 앱을 만들고 싶나요? 누가 쓰나요?",
    placeholder: "예) 우리 반 친구들이 쓰는 급식 메뉴 투표 앱을 만들어 줘",
    chips: ["퀴즈 앱", "타이머", "투표 앱", "할 일 목록", "미니 게임", "단어장", "뽑기 기계", "계산기"],
    required: true,
    minLength: 8,
    hint: "앱의 종류와 누가 쓰는지 함께 써 보세요.",
  },
  {
    key: "interaction",
    letter: "I",
    title: "어떻게 작동",
    question: "무엇을 누르면 어떤 일이 일어나나요?",
    placeholder: "예) 메뉴 버튼을 누르면 표가 1씩 올라가고, 1등 메뉴에는 왕관이 붙어",
    chips: ["버튼을 누르면", "점수가 올라가고", "시간이 끝나면", "정답이면", "무작위로", "목록에 추가돼"],
    required: true,
    minLength: 10,
    hint: "'~을 누르면 ~가 된다' 형태로 쓰면 AI가 잘 알아들어요.",
  },
  {
    key: "body",
    letter: "B",
    title: "모습",
    question: "색, 글씨, 분위기는 어떻게 할까요?",
    placeholder: "예) 파스텔 톤, 큰 버튼, 이모지를 많이 써 줘",
    chips: ["파스텔 톤", "어두운 테마", "큰 버튼", "이모지 사용", "귀여운 느낌", "깔끔하게", "애니메이션"],
    required: false,
    minLength: 4,
    hint: "색깔이나 느낌을 한두 개만 적어도 결과가 확 달라져요.",
  },
  {
    key: "exception",
    letter: "E",
    title: "조건",
    question: "꼭 지켜야 할 규칙이나 예외 상황은?",
    placeholder: "예) 한 사람은 한 번만 투표, 처음으로 돌아가는 초기화 버튼이 있어야 해",
    chips: ["초기화 버튼", "빈칸이면 안내", "최대 10개까지", "한 번만 가능", "점수는 0 아래로 안 내려가"],
    required: false,
    minLength: 4,
    hint: "'만약 ~하면?'을 생각해 보세요. 빈칸 입력, 끝났을 때, 다시 시작…",
  },
];

export const EDIT_CARDS: CardDef<"where" | "what" | "keep">[] = [
  {
    key: "where",
    letter: "1",
    title: "바꿀 곳",
    question: "화면의 어느 부분인가요?",
    placeholder: "예) 맨 위 제목",
    chips: ["제목", "버튼", "배경", "점수판", "결과 화면", "목록"],
    required: true,
    minLength: 2,
    hint: "위치를 정확히 말할수록 다른 곳이 덜 바뀌어요.",
  },
  {
    key: "what",
    letter: "2",
    title: "바꿀 내용",
    question: "어떻게 바꾸고 싶나요?",
    placeholder: "예) 무지개색 글씨로 바꾸고 조금 더 크게",
    chips: ["더 크게", "색을 바꿔", "기능을 추가해", "소리 효과", "애니메이션 추가"],
    required: true,
    minLength: 4,
    hint: "'예쁘게'보다 '파란색, 더 크게'처럼 구체적으로!",
  },
  {
    key: "keep",
    letter: "3",
    title: "그대로 둘 것",
    question: "망가지면 안 되는 기능은?",
    placeholder: "예) 투표 기능과 점수는 그대로 둬",
    chips: ["나머지 기능은 그대로", "디자인은 그대로", "점수 계산은 그대로"],
    required: false,
    minLength: 3,
    hint: "AI는 고치다가 잘 되던 것을 망가뜨리기도 해요. 지킬 것을 알려 주세요!",
  },
];

export const DEBUG_CARDS: CardDef<"action" | "expected" | "actual">[] = [
  {
    key: "action",
    letter: "1",
    title: "내가 한 행동",
    question: "무엇을 했나요?",
    placeholder: "예) 시작 버튼을 두 번 눌렀더니",
    chips: ["시작 버튼을 누르면", "정답을 입력하면", "처음 화면을 열면"],
    required: true,
    minLength: 4,
    hint: "문제가 생기기 직전에 한 행동을 적어요.",
  },
  {
    key: "expected",
    letter: "2",
    title: "기대한 결과",
    question: "원래 어떻게 되어야 하나요?",
    placeholder: "예) 타이머가 한 번만 돌아가야 하는데",
    chips: [],
    required: true,
    minLength: 4,
    hint: "",
  },
  {
    key: "actual",
    letter: "3",
    title: "실제 결과",
    question: "실제로는 어떻게 되나요?",
    placeholder: "예) 시간이 두 배로 빨리 줄어들어",
    chips: ["아무 일도 안 일어나", "화면이 하얘져", "숫자가 이상해", "버튼이 안 보여"],
    required: true,
    minLength: 4,
    hint: "",
  },
];

/** 카드 입력이 부족하면 안내 문구 목록을 돌려줌 (비어 있으면 통과) */
export function checkCards<K extends string>(cards: CardDef<K>[], values: Record<K, string>): string[] {
  const problems: string[] = [];
  for (const c of cards) {
    const v = (values[c.key] ?? "").trim();
    if (c.required && v.length === 0) problems.push(`「${c.title}」 카드를 채워 주세요.`);
    else if (c.required && v.length < c.minLength) problems.push(`「${c.title}」을 조금 더 자세히 써 볼까요? ${c.hint}`);
  }
  return problems;
}

/** 프롬프트 완성도 점수 (0~100): 학생에게 '좋은 프롬프트' 감각을 주기 위한 게이지 */
export function promptScore<K extends string>(cards: CardDef<K>[], values: Record<K, string>): number {
  let score = 0;
  const per = 100 / cards.length;
  for (const c of cards) {
    const len = (values[c.key] ?? "").trim().length;
    if (len === 0) continue;
    score += per * Math.min(1, 0.4 + (0.6 * len) / Math.max(c.minLength * 3, 20));
  }
  return Math.round(score);
}

/** 학생 입력을 AI에게 보내는 문장으로 바꿈 (기록 화면에도 그대로 보여 줌) */
export function formatPrompt(p: StudentPrompt): string {
  switch (p.kind) {
    case "create":
      return [
        `[무엇을] ${p.vision}`,
        `[어떻게 작동] ${p.interaction}`,
        p.body && `[모습] ${p.body}`,
        p.exception && `[조건] ${p.exception}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "edit":
      return [`[바꿀 곳] ${p.where}`, `[바꿀 내용] ${p.what}`, p.keep && `[그대로 둘 것] ${p.keep}`]
        .filter(Boolean)
        .join("\n");
    case "debug":
      return [
        `[버그 신고]`,
        `${p.action} → ${p.expected} 그런데 실제로는 ${p.actual}`,
        p.errors.length > 0 && `[브라우저 오류]\n${p.errors.slice(0, 5).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "free":
      return p.text;
  }
}

export const KIND_LABEL: Record<string, string> = {
  create: "처음 만들기",
  edit: "고치기",
  debug: "버그 고치기",
  free: "자유 프롬프트",
  restore: "되돌리기",
};

/* ── 미리보기/배포 공통: 학생 앱 안전 설정 ─────────────────────── */

/** 학생 앱에 적용하는 보안 정책: 외부 접속 금지, 인라인 코드만 허용 */
export const APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'";

/** iframe 미리보기용: CSP와 오류 수집 스크립트를 head 맨 앞에 넣음 */
export function previewDoc(html: string): string {
  const inject =
    `<meta http-equiv="Content-Security-Policy" content="${APP_CSP}">` +
    `<script>(function(){function s(m){try{parent.postMessage({__velo:"error",message:String(m).slice(0,300)},"*")}catch(e){}}` +
    `window.addEventListener("error",function(e){s(e.message+(e.lineno?" (줄 "+e.lineno+")":""))});` +
    `window.addEventListener("unhandledrejection",function(e){s(e.reason)});` +
    `document.addEventListener("securitypolicyviolation",function(e){s("차단된 외부 연결: "+e.blockedURI)});})();</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + inject);
  return inject + html;
}
