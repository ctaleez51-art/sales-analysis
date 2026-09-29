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

let state = null; // { rows, result, source }
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
  const result = buildResult(rows);
  state = { rows, result, source };
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
    return `<article><span>${esc(label)}</span><strong>${esc(fmt(current[key]))}</strong>
      <small class="${tone(key, v)}">${esc(signed(v))}${v == null ? "" : " 전월 대비"}</small></article>`;
  }).join("");

  // 월별 매출
  bars($("months"), Object.entries(monthly_kpis).map(([p, k]) => ({ label: p, value: k.revenue, text: wonShort(k.revenue) })));

  // 이번 달 퍼널
  const steps = [
    ["방문", current.visits, ""],
    ["장바구니", current.add_to_cart, current.cart_rate == null ? "" : `방문의 ${rate(current.cart_rate)}`],
    ["구매", current.purchases, current.cart_to_purchase_rate == null ? "" : `장바구니의 ${rate(current.cart_to_purchase_rate)}`],
  ];
  $("funnel").innerHTML = steps.map(([name, n, note], i) =>
    `<div class="funnel-step" style="width:${100 - i * 18}%"><b>${name}</b> ${count(n)}${note ? ` <small>${note}</small>` : ""}</div>`).join("");

  // 판매 채널별 (이번 달 ROAS, 전월 대비)
  bars($("channels"), Object.entries(channel_kpis).map(([ch, byMonth]) => {
    const now = byMonth[currentPeriod], before = previousPeriod ? byMonth[previousPeriod] : null;
    const v = before ? percentChange(now?.roas ?? null, before.roas) : null;
    return { label: ch, value: now?.roas, text: times(now?.roas ?? null), sub: v == null ? "" : ` ${signed(v)}`, subTone: tone("roas", v) };
  }));

  // 경쟁가 진단 (4번 diagnostics)
  const diagEl = $("diagnostics");
  if (diagnostics && Array.isArray(diagnostics.coupang_undercut_products)) {
    const list = diagnostics.coupang_undercut_products;
    diagEl.hidden = false;
    diagEl.querySelector(".diag-body").innerHTML = list.length
      ? `<p>${esc(currentPeriod)} 쿠팡에서 <b>경쟁 최저가가 우리 판매가보다 낮은 제품 ${list.length}개</b></p>
         <ul class="diag-list">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
         <p class="diag-note">${esc(diagnostics.causality_note || "")} <span class="diag-rule">기준: ${esc(diagnostics.evidence_rule || "")}</span></p>`
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
