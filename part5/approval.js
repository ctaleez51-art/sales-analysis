/**
 * [담당5] 계획 승인 화면 — 과제 Step 3 "계획 제안 → 승인 → 실행 → 실행 기록"
 *
 * app.js 는 고치지 않는다. 질문 클릭·Enter 를 먼저(capture 단계) 받아 계획 카드를 띄우고,
 * [승인]을 눌렀을 때만 app.js 의 answerByQuestion(q) 를 부른다. [취소]면 부르지 않는다.
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

  const BADGE = { rule: "규칙 기반 계획 · LLM 연결 전", ai: "AI 계획", mock: "목업 계획" };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // app.js 의 전역 변수 current (불러온 CSV 행)
  const rowsNow = () => (typeof current !== "undefined" && Array.isArray(current) ? current : null);

  // app.js answerByQuestion 의 분기와 같은 순서로 계획을 적는다
  function planFor(q) {
    const base = [
      { do: "날짜를 월 단위로 묶어 최근 두 달(전월 · 이번 달)을 나눈다", tool: "calculatePeriodComparison" },
      { do: "두 달의 광고비 · 방문 · 구매 · 매출 · 구매전환율과 변화율을 계산한다", tool: "calculateKPIs" },
    ];
    if (q.includes("채널")) {
      return [...base,
        { do: "채널별 ROAS를 두 달 비교해 가장 크게 떨어진 채널을 찾는다", tool: "calculateBreakdown(channel)" },
        { do: "확인된 사실 · 채널 분석 · 다음 분석을 정리한다", tool: "설명 문장" }];
    }
    if (q.includes("상품")) {
      return [...base,
        { do: "상품별 매출 변화율을 비교해 가장 크게 떨어진 상품을 찾는다", tool: "calculateBreakdown(product)" },
        { do: "확인된 사실 · 상품 분석 · 다음 분석을 정리한다", tool: "설명 문장" }];
    }
    if (q.includes("지표") || q.includes("먼저")) {
      return [...base,
        { do: "구매전환율 변화를 확인해 먼저 볼 지표를 고른다", tool: "calculateKPIs" },
        { do: "우선 확인 지표 · 근거 · 한계를 정리한다", tool: "설명 문장" }];
    }
    return [...base,
      { do: "광고비 → 방문 → 구매 → 매출 순서로 변화율을 이어 본다", tool: "calculatePeriodComparison" },
      { do: "확인된 사실 · 원인 후보(확정 아님) · 다음 분석을 정리한다", tool: "설명 문장" }];
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

  function approve() {
    if (!pending) return;
    const p = pending;
    pending = null;
    const at = new Date();
    answerByQuestion(p.q); // app.js — 실제 계산은 여기서만 일어난다
    const ok = answerEl.textContent.trim().length > 0;

    planEl.innerHTML = `<div class="plan-card plan-done">✓ 계획 승인됨 · ${at.toLocaleTimeString("ko-KR")} · ${esc(p.q)}</div>`;
    logEl.innerHTML = `
      <summary>실행 기록 · ${p.steps.length}단계 · ${ok ? "완료" : "결과 없음"}</summary>
      <table>
        <thead><tr><th>단계</th><th>할 일</th><th>도구</th><th>상태</th><th>입력</th></tr></thead>
        <tbody>
          ${p.steps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.do)}</td><td><code>${esc(s.tool)}</code></td><td class="${ok ? "st-done" : "st-fail"}">${ok ? "완료" : "결과 없음"}</td><td>${p.rows}행</td></tr>`).join("")}
        </tbody>
      </table>
      <p class="runlog-note">승인 ${at.toLocaleString("ko-KR")} · 비교 기간 ${esc(p.period)} · 숫자는 계산 코드가 만들고, 계획 카드는 숫자를 만들지 않습니다.</p>`;
    logEl.hidden = false;
  }

  function cancel() {
    if (!pending) return;
    pending = null;
    answerEl.innerHTML = "";
    planEl.innerHTML = `<div class="plan-card plan-cancelled">계획을 취소했습니다. 계산은 실행하지 않았습니다. 질문을 바꾸거나 다시 눌러 주세요.</div>`;
  }

  function reset() {
    window.cancelRequest?.(planEl);
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
