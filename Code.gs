/**
 * 위치의 변화량과 움직인 거리 — 구글 스프레드시트 + 앱스크립트 서버
 *
 * 프론트엔드(index.html)는 깃허브 페이지에서, 이 파일은 구글 앱스크립트에서 백엔드로 동작한다.
 *
 * 설치 순서
 *  1. 새 구글 스프레드시트를 만들고, 메뉴 [확장 프로그램] → [Apps Script]를 연다.
 *  2. Code.gs 내용을 모두 지우고 이 파일 내용을 붙여 넣는다. (HTML 파일은 넣지 않는다.)
 *  3. 저장 후 스프레드시트를 새로고침하면 [속도와 거리] 메뉴가 생긴다. → [처음 설정]을 실행한다(권한 승인 필요).
 *  4. '설정' 시트에 관리자 비밀번호를 넣는다.
 *  5. Apps Script 화면에서 [배포] → [새 배포] → 유형 '웹 앱',
 *     실행 계정 '나', 액세스 권한 '모든 사용자'로 배포한다.
 *     ※ 깃허브 페이지에서 호출하려면 반드시 '모든 사용자'여야 한다. 로그인이 필요한 권한이면 호출이 막힌다.
 *  6. 나온 웹 앱 주소(…/exec)를 깃허브 저장소의 config.js 에 붙여 넣는다.
 *     메뉴의 [서버 주소 보기]에서도 확인할 수 있다.
 *  ※ 코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전 '새 버전'으로 다시 배포해야 반영된다(주소는 그대로).
 */

var SHEET_CFG = '설정', SHEET_REC = '학습기록', SHEET_LOG = '풀이기록';
var REC_HEAD = ['학번·이름', '시작', '최근 활동', '현재 단계', '통과한 단계 수', '총점', '푼 문제', '틀린 횟수', '다시 풀기', '모두 완료', '상태(자동 저장, 수정 금지)'];
var LOG_HEAD = ['시각', '학번·이름', '단계', '문제', '숫자 판본', '결과', '점수', '틀린 횟수', '풀이 내용'];
var N_STAGES = 4, N_ALL = 5;   /* 본 단계 수, 보너스를 포함한 단계 수 (화면의 단계 구성과 맞춘다) */
var CFG_ROWS = [
  ['선택형 기회', 3, '선지에서 고르는 줄에서 틀릴 수 있는 횟수. 다 쓰면 그 문제만 처음부터 다시 풉니다(점수는 깎이지 않음).'],
  ['입력형 기회', 5, '수를 직접 계산해 넣는 줄과 마지막 확인(핵심 정리 빈칸)에서 틀릴 수 있는 횟수.'],
  ['오답 뒤 대기 시간(초)', 0, '답을 틀리게 제출하면 이 시간 동안 제출 버튼이 막힙니다. 0이면 막지 않습니다. 찍기가 많으면 5 정도로 올리세요.'],
  ['학생마다 다른 숫자', '켬', "'켬'이면 같은 문제라도 학번에 따라 숫자가 다르게 나옵니다(옆 사람 답 베끼기 방지). 함께 풀이하는 수업이면 '끔'으로 바꾸세요."],
  ['관리자 비밀번호', '', "학생 화면 아래 [관리자 모드]에 들어갈 때 쓰는 비밀번호. 비워 두면 관리자 모드가 닫힙니다."]
];

/* ---------------- 웹 앱 (깃허브 페이지의 화면이 fetch 로 부른다) ---------------- */
var API = { apiJoin: apiJoin, apiSave: apiSave, apiAdmin: apiAdmin, apiAdminDelete: apiAdminDelete };

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** 요청 본문: {"fn": "apiJoin", "arg": ...} */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    out = API.hasOwnProperty(req.fn) ? API[req.fn](req.arg) : { ok: false, error: '알 수 없는 요청입니다.' };
  } catch (err) {
    out = { ok: false, error: '서버에서 처리하지 못했습니다.' };
  }
  return json_(out);
}

/** 주소를 브라우저로 열었을 때: 서버가 살아 있는지만 알려 준다. */
function doGet() { return json_({ ok: true, service: '위치의 변화량과 움직인 거리 서버' }); }

/* ---------------- 스프레드시트 메뉴 ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('속도와 거리')
    .addItem('처음 설정 (시트 만들기)', 'setup')
    .addItem('서버 주소 보기', 'showUrl')
    .addSeparator()
    .addItem('기록 모두 지우기', 'clearRecords')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  var cfg = ss.getSheetByName(SHEET_CFG);
  if (!cfg) {
    cfg = ss.insertSheet(SHEET_CFG, 0);
    cfg.getRange(1, 1, 1, 3).setValues([['항목', '값', '설명']]).setFontWeight('bold');
    cfg.getRange(2, 1, CFG_ROWS.length, 3).setValues(CFG_ROWS);
    cfg.setColumnWidth(1, 200); cfg.setColumnWidth(2, 160); cfg.setColumnWidth(3, 560); cfg.setFrozenRows(1);
  } else {
    tidyCfg_(cfg);
  }
  ensureSheet_(SHEET_REC, REC_HEAD);
  ensureSheet_(SHEET_LOG, LOG_HEAD);
  SpreadsheetApp.getUi().alert("준비가 끝났습니다.\n'설정' 시트에 관리자 비밀번호를 정한 뒤 웹 앱으로 배포하세요.\n이미 입력해 둔 값은 그대로 남아 있습니다.");
}

/** 이미 있는 '설정' 시트를 지금 버전의 항목과 순서로 다시 정리한다. 입력해 둔 값은 그대로 둔다. */
function tidyCfg_(cfg) {
  var last = cfg.getLastRow(), val = {}, extra = [], known = {};
  CFG_ROWS.forEach(function (r) { known[r[0]] = true; });
  if (last > 1) {
    cfg.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
      var k = String(r[0]).trim(), v = r[1];
      if (!k) return;
      if (!known[k]) { extra.push([r[0], r[1], r[2]]); return; }     /* 직접 적어 둔 다른 줄은 아래에 남긴다 */
      if (val[k] === undefined || val[k] === '') val[k] = v;         /* 같은 항목이 여러 줄이면 값이 있는 첫 줄 */
    });
  }
  var rows = CFG_ROWS.map(function (r) { return [r[0], val[r[0]] !== undefined && val[r[0]] !== '' ? val[r[0]] : r[1], r[2]]; }).concat(extra);
  var span = Math.max(last - 1, rows.length);
  cfg.getRange(2, 1, span, 3).clearContent();
  cfg.getRange(2, 1, rows.length, 3).setValues(rows);
  cfg.getRange(1, 1, 1, 3).setValues([['항목', '값', '설명']]).setFontWeight('bold');
}

function ensureSheet_(name, head) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (name === SHEET_REC) { sh.setColumnWidth(1, 160); sh.setColumnWidth(4, 240); sh.hideColumns(head.length); }
    if (name === SHEET_LOG) { sh.setColumnWidth(2, 140); sh.setColumnWidth(9, 520); }
  }
  return sh;
}

function showUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? '서버 주소 (깃허브 저장소의 config.js 에 붙여 넣으세요)\n\n' + url : '아직 웹 앱으로 배포하지 않았습니다. Apps Script 화면에서 [배포] → [새 배포]를 먼저 하세요.');
}

function clearRecords() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('학습기록과 풀이기록을 모두 지울까요?', '되돌릴 수 없습니다.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  [SHEET_REC, SHEET_LOG].forEach(function (n) {
    var sh = SpreadsheetApp.getActive().getSheetByName(n);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
}

/* ---------------- 설정 읽기 ---------------- */
function readCfg_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CFG), m = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { m[String(r[0]).trim()] = r[1]; });
  }
  function num(k, d, lo, hi) { var v = parseInt(m[k], 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
  var vary = String(m['학생마다 다른 숫자'] == null ? '켬' : m['학생마다 다른 숫자']).trim();
  return {
    limC: num('선택형 기회', 3, 1, 9),
    limN: num('입력형 기회', 5, 1, 9),
    wait: num('오답 뒤 대기 시간(초)', 0, 0, 120),
    vary: !/^(끔|꺼짐|off|false|아니오|0)$/i.test(vary),
    adminPw: String(m['관리자 비밀번호'] == null ? '' : m['관리자 비밀번호']).trim()
  };
}
/* 학생 화면으로 보내도 되는 값만. 관리자 비밀번호는 넣지 않는다. */
function publicCfg_(c) { return { limC: c.limC, limN: c.limN, wait: c.wait, vary: c.vary }; }

function cleanName_(name) { return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 30); }

function findRow_(sh, name) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (String(col[i][0]) === name) return i + 2;
  return 0;
}

/* ---------------- 학생 화면이 부르는 함수 ---------------- */

/** 입장: 설정과 저장된 학습 상태를 돌려준다.
 *  같은 학번에 다른 이름의 기록이 있으면(오타·장난 입장) 한 번 되묻는다. 다른 학생의 이름은 알려 주지 않는다. */
function apiJoin(arg) {
  var name = cleanName_(arg && typeof arg === 'object' ? arg.name : arg), force = !!(arg && arg.force);
  if (!name) return { ok: false, error: '이름이 비어 있습니다.' };
  var sh = ensureSheet_(SHEET_REC, REC_HEAD), row = findRow_(sh, name), state = null;
  if (row) { var raw = sh.getRange(row, REC_HEAD.length).getValue(); state = raw ? String(raw) : null; }
  else if (!force) {
    var sid = name.split(' ')[0], last = sh.getLastRow();
    if (last > 1) {
      var col = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < col.length; i++) if (String(col[i][0]).split(' ')[0] === sid) return { ok: false, dup: true };
    }
  }
  return { ok: true, name: name, cfg: publicCfg_(readCfg_()), state: state };
}

/** 관리자 모드: 비밀번호가 맞으면 학생별 단계 통과 현황과 문항·오개념 통계용 자료를 돌려준다. */
function apiAdmin(pw) {
  var c = readCfg_();
  if (!c.adminPw) return { ok: false, error: "'설정' 시트에 관리자 비밀번호를 먼저 정하세요." };
  if (String(pw == null ? '' : pw).trim() !== c.adminPw) { Utilities.sleep(1200); return { ok: false, error: '비밀번호가 맞지 않습니다.' }; }
  return { ok: true, students: students_() };
}

function students_() {
  var sh = ensureSheet_(SHEET_REC, REC_HEAD), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, REC_HEAD.length).getValues().forEach(function (r) {
    var full = String(r[0] || '').trim(); if (!full) return;
    var sp = full.indexOf(' '), prog = null, stj = {}, it = {}, gate = {};
    try { stj = JSON.parse(String(r[REC_HEAD.length - 1] || '{}')) || {}; } catch (e) {}
    prog = stj.prog || null;
    /* 손댄 문제마다 [완료 여부, 오답 수, 줄별 오답 수, 선택지별 오답 수, 오개념별 횟수] */
    Object.keys(stj.probs || {}).forEach(function (id) {
      var q = stj.probs[id] || {};
      if (q.done || q.miss || q.step) it[id] = [q.done ? 1 : 0, Number(q.miss) || 0, q.ms || [], q.wo || {}, q.tg || {}];
    });
    var fin = stj.final || {};
    Object.keys(fin.ok || {}).concat(Object.keys(fin.msk || {})).forEach(function (k) { gate[k] = [(fin.ok || {})[k] ? 1 : 0, Number((fin.msk || {})[k]) || 0]; });
    if (!prog || !prog.c) {                       /* 상태를 읽지 못한 기록: 통과한 단계 수로 추정 */
      var n = Math.min(N_STAGES, Number(r[4]) || 0), cc = [];
      for (var i = 0; i < N_ALL; i++) cc.push(i < n ? 1 : 0);
      prog = { c: cc, f: n >= N_STAGES ? 1 : 0 };
    }
    out.push({ sid: sp > 0 ? full.slice(0, sp) : full, name: sp > 0 ? full.slice(sp + 1) : '', c: prog.c, f: prog.f ? 1 : 0, score: Number(r[5]) || 0, pos: String(r[3] || ''), it: it, g: gate });
  });
  return out;
}

/** 관리자 모드: 선택한 학생(또는 전체)의 학습기록과 풀이기록을 지운다. 되돌릴 수 없다. */
function apiAdminDelete(p) {
  var c = readCfg_();
  if (!c.adminPw) return { ok: false, error: "'설정' 시트에 관리자 비밀번호를 먼저 정하세요." };
  if (String((p && p.pw) == null ? '' : p.pw).trim() !== c.adminPw) { Utilities.sleep(1200); return { ok: false, error: '비밀번호가 맞지 않습니다.' }; }
  var all = !!(p && p.all), who = {};
  (p.who || []).forEach(function (n) { who[cleanName_(n)] = true; });
  if (!all && !Object.keys(who).length) return { ok: false, error: '삭제할 학생을 고르세요.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var removed = 0;
  try {
    [[SHEET_REC, REC_HEAD, 0], [SHEET_LOG, LOG_HEAD, 1]].forEach(function (t) {
      var sh = ensureSheet_(t[0], t[1]), last = sh.getLastRow();
      if (last < 2) return;
      var rows = sh.getRange(2, 1, last - 1, t[1].length).getValues();
      var keep = all ? [] : rows.filter(function (r) { return !who[String(r[t[2]] || '').trim()]; });
      if (t[0] === SHEET_REC) removed = rows.length - keep.length;
      sh.getRange(2, 1, last - 1, t[1].length).clearContent();
      if (keep.length) sh.getRange(2, 1, keep.length, t[1].length).setValues(keep);
    });
  } finally { lock.releaseLock(); }
  return { ok: true, removed: removed, students: students_() };
}

/** 저장: 학습 상태(한 학생당 한 줄)와 풀이 기록(여러 줄)을 쓴다. */
function apiSave(p) {
  var name = cleanName_(p && p.name);
  if (!name) return { ok: false, error: '이름이 비어 있습니다.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = ensureSheet_(SHEET_REC, REC_HEAD), row = findRow_(sh, name), now = new Date(), s = p.sum || {};
    /* 전에 저장된 적이 있는데 줄이 없다 = 관리자가 지운 학생. 다시 만들지 않고 화면에 알린다. */
    if (!row && p.synced) return { ok: false, gone: true };
    var started = row ? sh.getRange(row, 2).getValue() : now;
    var vals = [name, started || now, now, safeText_(s.pos), Number(s.stage) || 0, Number(s.score) || 0, Number(s.done) || 0,
      Number(s.miss) || 0, Number(s.resets) || 0, s.end ? new Date(s.end) : '', String(p.state || '').slice(0, 45000)];
    if (!row) row = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(row, 1, 1, vals.length).setValues([vals]);
    var logs = (p.logs || []).slice(0, 30);
    if (logs.length) {
      var lg = ensureSheet_(SHEET_LOG, LOG_HEAD);
      var rows = logs.map(function (l) {
        return [l.at ? new Date(l.at) : now, name, safeText_(l.camp), safeText_(l.id), l.ver === '' || l.ver == null ? '' : String(l.ver) + '번', safeText_(l.result),
          Number(l.score) || 0, Number(l.miss) || 0, safeText_(l.work)];
      });
      lg.getRange(lg.getLastRow() + 1, 1, rows.length, LOG_HEAD.length).setValues(rows);
    }
    return { ok: true, rev: p.rev || 0 };
  } finally { lock.releaseLock(); }
}

/* 수식처럼 보이는 글이 시트에서 계산되지 않도록 앞에 작은따옴표를 붙인다 */
function safeText_(t) { t = String(t == null ? '' : t).slice(0, 3000); return /^[=+\-@]/.test(t) ? "'" + t : t; }
