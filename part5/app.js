/**
 * [5번] 대시보드 — 3번 CSV → 4번 buildResult → 화면 → (승인하면) 4번 AI 서버
 *
 * 화면은 숫자를 다시 계산하지 않는다. 모든 숫자는 buildResult 결과에서 오고,
 * 비율 변화가 더 필요하면 4번 엔진의 percentChange 를 그대로 쓴다.
 * 표시 규칙(4번 TEAM_HANDOFF): 비율은 소수 → %, roas 는 배, changes 는 이미 %, null 은 "계산 불가".
 */
import { buildResult, percentChange } from "../part4/result-engine.js";
import { readFiles, readTable } from "./csv.js";

// 4번 Supabase Edge Function (팀 Supabase 프로젝트, part4/RUN.md) — 주소는 공개돼도 되는 값, OpenAI 키는 서버 Secret 에만 있다.
// 서버는 verify_jwt=true 라서 로그인한 사용자의 access token 을 Authorization 헤더로 보내야 한다.
const AI_URL = "https://joxyzphsqjwuyobkboqe.supabase.co/functions/v1/analyze-shop";

// 로그인 토큰 — 4번 RUN.md 의 약속(getAccessToken · supabaseClient)과 2번 window.Auth.client 를 차례로 찾는다
// 2번 계정 상자는 consumeQuota·refreshAccount 때만 다시 그린다. 한도는 4번 서버가 세므로 화면이 알려 줘야 한다.
function refreshAccount() {
  try { window.Auth?.refreshAccount?.()?.catch?.((e) => console.warn("[dashboard] 계정 표시 갱신 실패", e)); }
  catch (e) { console.warn("[dashboard] 계정 표시 갱신 실패", e); }
}

async function accessToken() {
  if (typeof window.getAccessToken === "function") return (await window.getAccessToken()) || null;
  const client = window.Auth?.client || window.supabaseClient;
  if (!client?.auth?.getSession) return null;
  const { data } = await client.auth.getSession();
  return data?.session?.access_token || null;
}
const SAMPLE_FILES = ["sales_2026_06.csv", "sales_2026_07.csv", "sales_2026_08.csv", "sales_2026_09.csv"];
const SAMPLE_DIR = "../data/";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const errorsEl = $("errors");
const appEl = $("app");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const won = (n) => (n == null ? "계산 불가" : Math.round(n).toLocaleString("ko-KR") + "원");
const wonShort = (n) => (n == null ? "계산 불가" : new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(n) + "원");
const times = (n) => (n == null ? "계산 불가" : n.toFixed(2) + "배");
const rate = (n) => (n == null ? "계산 불가" : (n * 100).toFixed(2) + "%");
const count = (n) => (n == null ? "계산 불가" : Math.round(n).toLocaleString("ko-KR"));
const signed = (v) => (v == null ? "전월 비교 불가" : (v > 0 ? "+" : "") + v.toFixed(2) + "%");

// 오르면 나쁜 지표(비용)는 색을 반대로
const COST = new Set(["ad_spend", "cpa"]);
const tone = (key, v) => (v == null || v === 0 ? "" : (v > 0) !== COST.has(key) ? "positive" : "negative");

const KPIS = [
  { key: "revenue", label: "매출", fmt: won },
  { key: "ad_spend", label: "광고비", fmt: won },
  { key: "roas", label: "ROAS", fmt: times },
  { key: "cvr", label: "구매전환율", fmt: rate },
  { key: "cpa", label: "CPA (구매당 광고비)", fmt: won },
  { key: "aov", label: "객단가", fmt: won },
];

// 엔진이 없는 열을 0으로 더하는 것(R1 빈칸≠0 위반)을 막는 안전장치. csv.js 가 이 열들을 필수로 검사하므로
// 지금은 걸릴 일이 없지만, 필수 목록이 바뀌어도 화면 · AI 에 0 이 넘어가지 않게 남겨 둔다.
// 그 열로 만든 값만 null(계산 불가)로 바꾼다. 숫자를 새로 계산하지는 않는다.
const OPTIONAL = {
  add_to_cart: ["add_to_cart", "cart_rate", "cart_to_purchase_rate"],
  impressions: ["impressions", "ctr"],
  clicks: ["clicks", "ctr", "cpc"],
  units: ["units"],
  refund: ["refund"],
};
const DIAG_COLS = ["unit_price", "competitor_min_price"]; // 쿠팡 경쟁가 진단(4번 diagnostics)
const COL_LABEL = { add_to_cart: "장바구니", impressions: "광고 노출", clicks: "광고 클릭", units: "판매 수량", refund: "반품액", unit_price: "우리 판매가", competitor_min_price: "경쟁 최저가" };
const filled = (v) => v != null && String(v).trim() !== "";

// 4번 diagnostics.evidence_rule 은 코드 식("channel=쿠팡 AND competitor_min_price < unit_price") — 화면에는 문장으로 바꿔 보여 준다.
// 식이 바뀌어도 깨지지 않게, 모르는 식은 열 이름만 한국어로 바꾼다.
function ruleText(rule) {
  const r = String(rule || "").trim();
  if (!r) return "";
  if (/^channel\s*=\s*쿠팡\s+AND\s+competitor_min_price\s*<\s*unit_price$/i.test(r)) return "쿠팡에서 경쟁 최저가가 우리 판매가보다 낮은 제품";
  return r
    .replace(/\bchannel\s*=\s*/g, "판매 채널 ")
    .replace(/\b[a-z_]+\b/g, (w) => COL_LABEL[w] || w)
    .replace(/\s+AND\s+/g, " 이고 ")
    .replace(/\s*<\s*/g, " < ");
}

// 한 행이라도 비어 있으면 합계가 틀리므로 "없음"으로 본다. 돌려주는 값: { 열: 판단 근거 }
function columnGaps(rows) {
  const gaps = {};
  for (const c of [...Object.keys(OPTIONAL), ...DIAG_COLS]) {
    const absent = rows.filter((r) => !(c in r)).length;
    const blank = rows.filter((r) => c in r && !filled(r[c])).length;
    const name = `${COL_LABEL[c]}(${c})`;
    if (absent === rows.length) gaps[c] = `올린 CSV에 ${name} 열이 없음`;
    else if (absent) gaps[c] = `일부 파일에 ${name} 열이 없음 (${absent.toLocaleString("ko-KR")}행)`;
    else if (blank) gaps[c] = `${name} 칸이 ${blank.toLocaleString("ko-KR")}행 비어 있음`;
  }
  return gaps;
}

// null 인 값의 판단 근거 — 없는 열 때문인지, 나눌 값(분모)이 0이라서인지
const DENOM = { roas: ["ad_spend", "광고비가"], cvr: ["visits", "방문이"], cpa: ["purchases", "구매가"], aov: ["purchases", "구매가"], cart_rate: ["visits", "방문이"], cart_to_purchase_rate: ["add_to_cart", "장바구니가"] };
function whyNull(kpi, key, gaps) {
  const col = Object.keys(OPTIONAL).find((c) => OPTIONAL[c].includes(key) && gaps[c]);
  if (col) return gaps[col];
  const d = DENOM[key];
  if (d && kpi?.[d[0]] === 0) return `${d[1]} 0이라 나눌 수 없음`;
  return "";
}

function maskResult(result, gaps) {
  const missing = Object.keys(gaps);
  if (!missing.length) return result;
  const out = structuredClone(result);
  const fields = new Set(missing.flatMap((c) => OPTIONAL[c] || []));
  const blank = (k) => { if (k) for (const f of fields) if (f in k) k[f] = null; };
  blank(out.current);
  blank(out.previous);
  Object.values(out.monthly_kpis || {}).forEach(blank);
  Object.values(out.channel_kpis || {}).forEach((byMonth) => Object.values(byMonth).forEach(blank));
  const diagMissing = DIAG_COLS.filter((c) => missing.includes(c));
  if (diagMissing.length && out.diagnostics) {
    out.diagnostics = { ...out.diagnostics, coupang_undercut_product_count: null, coupang_undercut_products: null,
      unavailable_reason: diagMissing.map((c) => gaps[c]).join(" · ") };
  }
  out.data_gaps = { missing_columns: missing, reasons: gaps, note: "이 열로 만든 값은 null(계산 불가)이며 0이 아니다. 이 값으로 결론을 내리지 말 것." };
  return out;
}

let state = null; // { rows, result, source, gaps }
let aiRequest = null; // 확인용으로 바꿔 끼울 수 있는 AI 요청 함수

function showErrors(list) {
  errorsEl.hidden = !list.length;
  errorsEl.innerHTML = list.length
    ? `<b>불러오지 못했습니다</b><ul>${list.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
    : "";
}

function bars(el, items) {
  const max = Math.max(...items.map((x) => x.value ?? 0), 1);
  el.innerHTML = items.map((x) => `
    <div class="barrow"><b>${esc(x.label)}</b>
      <div class="track"><div class="bar" style="width:${Math.max(2, ((x.value ?? 0) / max) * 100)}%"></div></div>
      <span>${esc(x.text)}${x.sub ? `<small class="${x.subTone || ""}">${esc(x.sub)}</small>` : ""}</span>
    </div>`).join("");
}

function render(rows, source) {
  const gaps = columnGaps(rows);
  const result = maskResult(buildResult(rows), gaps);
  state = { rows, result, source, gaps };
  window.dispatchEvent(new CustomEvent("dashboard:data"));
  const { current, previous, changes, currentPeriod, previousPeriod, monthly_kpis, channel_kpis, diagnostics } = result;
  if (!current) {
    showErrors(["날짜(date)로 묶을 수 있는 행이 없습니다."]);
    appEl.hidden = true;
    return;
  }

  // KPI 6칸
  $("kpis").innerHTML = KPIS.map(({ key, label, fmt }) => {
    const v = changes[key] ?? null;
    const why = current[key] == null ? whyNull(current, key, gaps) : "";
    return `<article><span>${esc(label)}</span><strong>${esc(fmt(current[key]))}</strong>
      ${why ? `<small class="why">근거: ${esc(why)}</small>` : ""}
      <small class="${tone(key, v)}">${esc(signed(v))}${v == null ? "" : " 전월 대비"}</small></article>`;
  }).join("");

  // 월별 매출
  bars($("months"), Object.entries(monthly_kpis).map(([p, k]) => ({ label: p, value: k.revenue, text: wonShort(k.revenue) })));

  // 없는 열 안내 — 해당 칸은 "계산 불가"
  const gapsEl = $("gaps");
  const gapList = Object.values(gaps);
  gapsEl.hidden = !gapList.length;
  gapsEl.innerHTML = gapList.length
    ? `<b>일부 칸은 계산 불가로 표시합니다</b> — 0으로 계산하면 틀린 숫자가 되기 때문입니다. AI에도 계산 불가로 전달합니다.
       <ul>${gapList.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`
    : "";

  // 이번 달 퍼널 — 장바구니 열이 없으면 구매는 방문 대비(cvr)로 보여 준다
  const noCart = current.add_to_cart == null;
  const steps = [
    ["방문", current.visits, ""],
    ["장바구니", current.add_to_cart, noCart ? `근거: ${gaps.add_to_cart || "장바구니 값 없음"}` : current.cart_rate == null ? `근거: ${whyNull(current, "cart_rate", gaps)}` : `방문의 ${rate(current.cart_rate)}`],
    ["구매", current.purchases, noCart ? `방문의 ${rate(current.cvr)}` : current.cart_to_purchase_rate == null ? `근거: ${whyNull(current, "cart_to_purchase_rate", gaps)}` : `장바구니의 ${rate(current.cart_to_purchase_rate)}`],
  ];
  $("funnel").innerHTML = steps.map(([name, n, note], i) =>
    `<div class="funnel-step" style="width:${100 - i * 18}%"><b>${name}</b> ${esc(count(n))}${note ? ` <small>${esc(note)}</small>` : ""}</div>`).join("");

  // 판매 채널별 (이번 달 ROAS, 전월 대비)
  bars($("channels"), Object.entries(channel_kpis).map(([ch, byMonth]) => {
    const now = byMonth[currentPeriod], before = previousPeriod ? byMonth[previousPeriod] : null;
    const v = before ? percentChange(now?.roas ?? null, before.roas) : null;
    const why = now?.roas == null ? whyNull(now, "roas", gaps) : "";
    return { label: ch, value: now?.roas, text: times(now?.roas ?? null), sub: why ? ` 근거: ${why}` : v == null ? "" : ` ${signed(v)}`, subTone: why ? "" : tone("roas", v) };
  }));

  // 경쟁가 진단 (4번 diagnostics)
  const diagEl = $("diagnostics");
  if (diagnostics && diagnostics.coupang_undercut_products === null) {
    diagEl.hidden = false;
    diagEl.querySelector(".diag-body").innerHTML =
      `<p><b>진단 불가</b> — 경쟁가가 더 낮은 제품이 없다는 뜻이 아닙니다.</p>
       <p class="diag-note">근거: ${esc(diagnostics.unavailable_reason || "경쟁가 열이 없음")}
       <span class="diag-rule">진단 기준: ${esc(ruleText(diagnostics.evidence_rule))} — 우리 판매가와 경쟁 최저가가 모든 행에 있어야 셀 수 있습니다.</span></p>`;
  } else if (diagnostics && Array.isArray(diagnostics.coupang_undercut_products)) {
    const list = diagnostics.coupang_undercut_products;
    diagEl.hidden = false;
    diagEl.querySelector(".diag-body").innerHTML = list.length
      ? `<p>${esc(currentPeriod)} 쿠팡에서 <b>경쟁 최저가가 우리 판매가보다 낮은 제품 ${list.length}개</b></p>
         <ul class="diag-list">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
         <p class="diag-note">${esc(diagnostics.causality_note || "")} <span class="diag-rule">기준: ${esc(ruleText(diagnostics.evidence_rule))}</span></p>`
      : `<p>${esc(currentPeriod)} 쿠팡에서 경쟁 최저가가 더 낮은 제품이 없습니다.</p>`;
  } else diagEl.hidden = true;

  // 한 줄 요약 — changes 값을 그대로 옮긴다.
  // 4번 엔진은 바로 앞 달(연속된 달)이 있을 때만 previousPeriod 를 준다 — 6월 · 9월만 올리면 비교하지 않는다
  const months = Object.keys(monthly_kpis);
  $("insight").textContent = previousPeriod
    ? `${previousPeriod} → ${currentPeriod}: 광고비 ${signed(changes.ad_spend)}, 방문 ${signed(changes.visits)}에 비해 구매 ${signed(changes.purchases)}, 매출 ${signed(changes.revenue)}입니다.`
    : months.length > 1
      ? `${currentPeriod} 바로 앞 달 데이터가 없어 전월 비교를 할 수 없습니다(올린 달: ${months.join(", ")}). 연속된 달의 파일을 함께 올려 주세요.`
      : `${currentPeriod} 한 달치만 있어 전월 비교를 할 수 없습니다. 두 달 이상의 파일을 함께 올려 주세요.`;

  // 필요한 열이 없는 질문 버튼은 숨긴다 (data-needs). 열이 다 있는 파일을 올리면 다시 보인다
  document.querySelectorAll(".faq-btn[data-needs]").forEach((b) => {
    b.hidden = b.dataset.needs.split(" ").some((c) => gaps[c]);
  });

  $("answer").innerHTML = "";
  showErrors([]);
  appEl.hidden = false;
  statusEl.textContent = `${source} · ${rows.length.toLocaleString("ko-KR")}행 · ${previousPeriod ? `${previousPeriod} → ${currentPeriod}` : currentPeriod}`;
}

async function loadSample() {
  statusEl.textContent = "예시 데이터를 불러오는 중…";
  try {
    const texts = await Promise.all(SAMPLE_FILES.map(async (f) => {
      const res = await fetch(SAMPLE_DIR + f);
      if (!res.ok) throw new Error(`${f} 를 찾지 못했습니다 (${res.status})`);
      return [f, await res.text()];
    }));
    const parts = texts.map(([f, t]) => readTable(f, t));
    const errors = parts.flatMap((p) => p.errors);
    if (errors.length) throw new Error(errors.join(" / "));
    render(parts.flatMap((p) => p.rows), `예시 CSV ${SAMPLE_FILES.length}개`);
  } catch (e) {
    statusEl.textContent = "예시 데이터를 불러오지 못했습니다.";
    showErrors([e.message, "저장소 최상위 폴더를 웹 서버로 열고 /part5/ 로 들어왔는지 확인해 주세요."]);
  }
}

$("sample").addEventListener("click", loadSample);
$("file").addEventListener("change", async (e) => {
  const input = e.target;
  statusEl.textContent = "파일을 읽는 중…";
  const out = await readFiles(input.files);
  input.value = ""; // 같은 파일을 다시 골라도 change 가 나게
  if (out.errors.length) {
    state = null;
    appEl.hidden = true;
    statusEl.textContent = "파일을 확인해 주세요.";
    showErrors(out.errors);
    return;
  }
  render(out.rows, `CSV ${out.files.length}개`);
});

// 계획 카드(approval.js)가 쓰는 연결부
window.dashboard = {
  rows: () => state?.rows ?? null,
  result: () => state?.result ?? null,
  gaps: () => state?.gaps ?? {},
  // 승인했을 때만 불린다. 돌려주는 값: { ok, kind }
  analyze(question) {
    if (!state) return Promise.resolve({ ok: false, kind: "no-data" });
    const body = { result: state.result, question };
    const fail = (kind) => Object.assign(new Error(kind), { kind });
    // 하루 한도는 4번 AI 서버가 센다(consume_analysis_quota, 넘으면 429). 화면에서 또 세면 한 번에 2회가 줄어든다.
    // 화면은 로그인 토큰만 확인한다. [다시 시도]도 매번 토큰부터 다시 찾는다.
    const request = async (signal) => {
      let token;
      try { token = await accessToken(); }
      catch (e) { console.warn("[dashboard] 로그인 확인 실패", e); throw fail("login"); }
      if (!token) throw fail("login"); // 토큰 없이 부르면 서버가 401
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await (aiRequest
        ? aiRequest(body, signal, headers)
        : fetch(AI_URL, { method: "POST", headers, body: JSON.stringify(body), signal }));
      refreshAccount(); // 응답이 왔으면 서버가 한도를 셌다 — 2번 계정 상자의 "오늘 N회"를 다시 그린다
      return res;
    };
    return window.runAnalysis(request, { target: $("answer") });
  },
  // 확인용: 실제 서버 대신 가짜 응답을 넣는다 — fn(body, signal, headers). null 이면 실제 서버
  setAIRequest(fn) { aiRequest = typeof fn === "function" ? fn : null; },
};
