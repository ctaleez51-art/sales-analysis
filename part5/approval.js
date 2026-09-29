/**
 * [담당5] 계획 승인 화면 — 과제 Step 3 "계획 제안 → 승인 → 실행 → 실행 기록"
 *
 * 질문 클릭·Enter 를 먼저(capture 단계) 받아 계획 카드를 띄우고,
 * [승인]을 눌렀을 때만 app.js 의 window.dashboard.analyze(q) 로 AI 서버를 부른다. [취소]면 부르지 않는다.
 * 계획 카드는 숫자를 만들지 않는다 — 행 수·기간처럼 데이터에서 그대로 세는 값만 쓴다.
 * AI 계획: setPlanProvider((signal, {question, rows, period}) => fetch(…)) 로 등록하면
 *   status-card.js 의 로딩 · 실패 화면을 거쳐 AI 계획(steps[].desc)을 보여 준다.
 *   실패하면 [규칙 기반 계획으로 계속] 으로 아래 planFor() 계획을 쓸 수 있다. 등록 안 하면 planFor() 그대로.
 */
(() => {
  const answerEl = document.getElementById("answer");
  const questionEl = document.getElementById("question");
  if (!answerEl || !questionEl) return;

  const planEl = document.createElement("div");
  planEl.id = "plan";
  planEl.setAttribute("aria-live", "polite");
  answerEl.before(planEl);

  const logEl = document.createElement("details");
  logEl.id = "runlog";
  logEl.hidden = true;
  answerEl.after(logEl);

  let pending = null;
  let planProvider = null;
  window.setPlanProvider = (fn) => { planProvider = typeof fn === "function" ? fn : null; };

  const BADGE = { rule: "규칙 기반 계획", ai: "AI 계획", mock: "목업 계획" };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // app.js 가 불러온 CSV 행
  const rowsNow = () => window.dashboard?.rows?.() ?? null;

  // 계산은 이미 4번 엔진(buildResult)이 끝냈다 — 계획은 "어떤 계산 결과를 보고, AI 에 무엇을 묻는지"를 적는다
  function planFor(q) {
    const base = [
      { do: "올린 CSV를 합쳐 월별로 묶고, 최근 두 달(전월 · 이번 달)을 비교한다", tool: "buildResult → monthly_kpis · changes" },
    ];
    const ai = { do: "계산 결과만 AI에 보내 확인된 사실 · 원인 후보(확정 아님) · 실행 제안 · 한계를 받는다 (AI는 숫자를 다시 계산하지 않음)", tool: "AI 서버 analyze-shop" };
    if (q.includes("채널")) {
      return [...base,
        { do: "판매 채널(쿠팡 · 네이버스토어 · 자사몰)별 ROAS · 구매전환율을 두 달 비교한다", tool: "channel_kpis" }, ai];
    }
    if (q.includes("상품")) {
      return [...base,
        { do: "쿠팡에서 경쟁 최저가가 우리보다 낮은 제품 목록을 확인한다", tool: "diagnostics" },
        { do: "채널별 변화와 함께 먼저 볼 제품을 고른다", tool: "channel_kpis" }, ai];
    }
    if (q.includes("전환율")) {
      return [...base,
        { do: "방문 → 장바구니 → 구매 단계별 비율(장바구니율 · 장바구니→구매율)을 두 달 비교한다", tool: "monthly_kpis" },
        { do: "전환율이 가장 많이 떨어진 채널을 찾는다", tool: "channel_kpis" }, ai];
    }
    if (q.includes("지표") || q.includes("먼저")) {
      return [...base,
        { do: "전월 대비 변화가 가장 큰 지표를 고른다", tool: "changes" }, ai];
    }
    return [...base,
      { do: "광고비 → 방문 → 구매 → 매출 순서로 변화율을 이어 보고, 가장 많이 떨어진 채널을 찾는다", tool: "changes · channel_kpis" },
      { do: "경쟁가 진단 결과를 함께 본다", tool: "diagnostics" }, ai];
  }

  function monthsOf(rows) {
    return [...new Set(rows.map((r) => String(r.date || "").slice(0, 7)).filter(Boolean))].sort();
  }

  // AI 계획 응답(화면연결_데이터모양 ②) → 화면용 단계. desc 가 없으면 do 도 받는다.
  function stepsFrom(data) {
    const list = Array.isArray(data) ? data : data?.steps;
    if (!Array.isArray(list)) return [];
    return list
      .map((s) => ({ do: String(s?.desc ?? s?.do ?? "").trim(), tool: String(s?.tool ?? "").trim() }))
      .filter((s) => s.do);
  }

  function propose(q) {
    q = (q || "").trim();
    if (!q) return;
    window.cancelRequest?.(planEl);
    window.cancelRequest?.(answerEl);
    answerEl.innerHTML = "";
    logEl.hidden = true;

    const rows = rowsNow();
    if (!rows) {
      pending = null;
      planEl.innerHTML = `<div class="plan-card plan-notice">먼저 샘플 데이터나 CSV를 불러오세요. 불러온 데이터가 있어야 계획을 세울 수 있습니다.</div>`;
      return;
    }

    const months = monthsOf(rows);
    const period = months.length >= 2 ? `${months.at(-2)} → ${months.at(-1)}` : (months[0] || "기간 없음");
    const show = (steps, source) => showPlan({ q, steps, rows: rows.length, period, twoMonths: months.length >= 2 }, source);

    if (!planProvider || typeof window.runRequest !== "function") return show(planFor(q), "rule");

    pending = null;
    window.runRequest(planEl, (signal) => planProvider(signal, { question: q, rows: rows.length, period }), {
      label: "AI가 분석 계획을 세우는 중",
      onSuccess: (data) => {
        const steps = stepsFrom(data);
        if (!steps.length) throw new Error("steps 가 없습니다");
        show(steps, data?.source === "mock" ? "mock" : "ai");
      },
      extra: [{ label: "규칙 기반 계획으로 계속", onClick: () => show(planFor(q), "rule") }],
    });
  }

  function showPlan(p, source) {
    const { q, steps, rows, period } = p;
    pending = p;
    planEl.innerHTML = `
      <div class="plan-card" role="region" aria-label="분석 계획">
        <div class="plan-head">
          <h3>분석 계획 확인</h3>
          <span class="plan-badge plan-src-${source}">${BADGE[source]}</span>
        </div>
        <p class="plan-q">질문: <b>${esc(q)}</b></p>
        <ol class="plan-steps">
          ${steps.map((s) => `<li><span class="plan-do">${esc(s.do)}</span><code>${esc(s.tool)}</code></li>`).join("")}
        </ol>
        <p class="plan-data">사용할 데이터: <b>${rows}행</b> · 비교 기간 <b>${esc(period)}</b></p>
        ${pending.twoMonths ? "" : `<p class="plan-warn">전월 비교에는 최소 2개월 데이터가 필요합니다. 승인해도 비교 결과는 나오지 않습니다.</p>`}
        <div class="plan-actions">
          <button type="button" class="plan-approve">승인하고 분석</button>
          <button type="button" class="plan-cancel">취소</button>
        </div>
      </div>`;
    planEl.querySelector(".plan-approve").focus();
  }

  const AI_TOOL = "AI 서버 analyze-shop";
  const KIND = { ok: "완료", cancelled: "중단", timeout: "시간 초과", network: "연결 실패", rate: "요청 몰림", auth: "서버 설정 문제", server: "서버 오류", app: "처리 실패", format: "형식 오류", "no-data": "데이터 없음" };

  function writeLog(p, at, aiState) {
    const cell = (s) => (s.tool === AI_TOOL ? aiState : { text: "완료", cls: "st-done" });
    logEl.innerHTML = `
      <summary>실행 기록 · ${p.steps.length}단계 · AI ${esc(aiState.text)}</summary>
      <table>
        <thead><tr><th>단계</th><th>할 일</th><th>도구</th><th>상태</th><th>입력</th></tr></thead>
        <tbody>
          ${p.steps.map((s, i) => { const c = cell(s); return `<tr><td>${i + 1}</td><td>${esc(s.do)}</td><td><code>${esc(s.tool)}</code></td><td class="${c.cls}">${esc(c.text)}</td><td>${p.rows}행</td></tr>`; }).join("")}
        </tbody>
      </table>
      <p class="runlog-note">승인 ${at.toLocaleString("ko-KR")} · 비교 기간 ${esc(p.period)} · 숫자는 4번 계산 엔진이 불러올 때 이미 계산했고, AI 에는 그 결과만 보냅니다. [다시 시도]의 결과는 위 답변 칸에 나옵니다.</p>`;
    logEl.hidden = false;
  }

  async function approve() {
    if (!pending) return;
    const p = pending;
    pending = null;
    const at = new Date();
    planEl.innerHTML = `<div class="plan-card plan-done">✓ 계획 승인됨 · ${at.toLocaleTimeString("ko-KR")} · ${esc(p.q)}</div>`;
    writeLog(p, at, { text: "진행 중", cls: "" });
    // 여기서만 AI 를 부른다 (승인 전에는 0회)
    const r = window.dashboard?.analyze ? await window.dashboard.analyze(p.q) : { ok: false, kind: "no-data" };
    if (r.kind === "replaced") return; // 더 새 질문이 자리를 가져갔다
    writeLog(p, at, r.ok ? { text: "완료", cls: "st-done" } : { text: KIND[r.kind] || "실패", cls: "st-fail" });
  }


  function cancel() {
    if (!pending) return;
    pending = null;
    answerEl.innerHTML = "";
    planEl.innerHTML = `<div class="plan-card plan-cancelled">계획을 취소했습니다. 계산은 실행하지 않았습니다. 질문을 바꾸거나 다시 눌러 주세요.</div>`;
  }

  function reset() {
    window.cancelRequest?.(planEl);
    window.cancelRequest?.(answerEl);
    pending = null;
    planEl.innerHTML = "";
    logEl.hidden = true;
  }

  // 질문 입구 세 곳(FAQ 버튼 · 분석하기 · Enter)을 app.js 보다 먼저 받는다
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest(".plan-approve")) return approve();
    if (t.closest(".plan-cancel")) return cancel();
    const faq = t.closest(".faq-btn");
    const ask = t.closest("#ask");
    if (!faq && !ask) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (faq) questionEl.value = faq.textContent.trim();
    propose(questionEl.value);
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.target !== questionEl || e.key !== "Enter" || e.isComposing) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    propose(questionEl.value);
  }, true);

  // 새 데이터를 불러오면 이전 계획·기록을 지운다
  document.getElementById("sample")?.addEventListener("click", reset);
  document.getElementById("file")?.addEventListener("change", reset);
})();
