/**
 * [5번] CSV 읽기 · 검증 — 3번 명세(docs/part3_to_part4_metric_spec.md "CSV 읽기")를 따른다.
 *   - 여러 파일을 한 번에 받아 행을 합친다 (파일끼리 열 구성이 달라도 필수 열만 있으면 됨)
 *   - 숫자 열은 있는 것만 검사한다. 없는 열로 만든 지표는 app.js 가 "계산 불가"로 바꾼다(0으로 두지 않음)
 *   - UTF-8 BOM 제거, 줄바꿈 \n · \r\n, 따옴표 안 쉼표 · 줄바꿈 · "" 처리
 *   - 실패하면 이유를 모아서 돌려준다 (파일명 · 행 번호 · 열 이름)
 * 숫자는 여기서 바꾸지 않는다. 계산은 4번 buildResult 가 한다.
 */
// 필수 = 행을 나누는 식별 3열(날짜 · 상품 · 판매 채널). 판매 지표만 있는 CSV 도 분석할 수 있게 숫자 열은 고를 수 있다(10/1).
// 4번 buildResult 는 없는 열을 0으로 더하므로, 없는 열로 만든 지표는 app.js 의 columnGaps · maskResult 가 null(계산 불가)로 바꾼다.
// 14열이 모두 있으면 예전과 같다 — 3번 정답표(answer_key.json) 검증 그대로.
export const REQUIRED = ["date", "product", "channel"];
export const NUMBER_COLUMNS = ["unit_price", "competitor_min_price", "impressions", "clicks", "visits", "add_to_cart",
  "purchases", "units", "revenue", "ad_spend", "refund"];
const MAX_ERRORS = 5;

// RFC 4180 방식: 따옴표로 감싼 칸 안의 쉼표 · 줄바꿈은 칸의 일부, "" 는 따옴표 하나
export function parseCSV(text) {
  const src = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

const looksBinary = (text) => /\u0000/.test(text.slice(0, 2000));
const isNumber = (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;

// 파일 한 개 → { rows, errors }
export function readTable(name, text) {
  if (looksBinary(text)) return { rows: [], errors: [`${name}: CSV 파일이 아닙니다.`] };
  const table = parseCSV(text);
  if (table.length === 0) return { rows: [], errors: [`${name}: 빈 파일입니다.`] };
  const head = table[0].map((h) => h.trim());
  const missing = REQUIRED.filter((k) => !head.includes(k));
  if (missing.length) return { rows: [], errors: [`${name}: 필수 열이 없습니다 — ${missing.join(", ")}`] };
  const numbers = NUMBER_COLUMNS.filter((k) => head.includes(k)); // 있는 숫자 열만 검사
  if (!numbers.length) return { rows: [], errors: [`${name}: 숫자 열이 하나도 없습니다 — ${NUMBER_COLUMNS.join(", ")} 중 하나 이상 필요`] };
  if (table.length === 1) return { rows: [], errors: [`${name}: 데이터가 없습니다 (제목 행만 있음).`] };

  const errors = [];
  const rows = [];
  for (let i = 1; i < table.length && errors.length < MAX_ERRORS; i++) {
    const line = i + 1; // 엑셀에서 보이는 행 번호 (제목 = 1행)
    const cells = table[i];
    if (cells.length !== head.length) {
      errors.push(`${name} ${line}행: 칸 수가 제목(${head.length}칸)과 다릅니다 (${cells.length}칸).`);
      continue;
    }
    const r = Object.fromEntries(head.map((k, j) => [k, cells[j].trim()]));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(`${name} ${line}행 date: 날짜 형식(YYYY-MM-DD)이 아닙니다 — "${r.date}"`);
    for (const k of numbers) {
      if (!isNumber(r[k])) errors.push(`${name} ${line}행 ${k}: 0 이상의 숫자가 아닙니다 — "${r[k]}"`);
    }
    rows.push(r);
  }
  return { rows: errors.length ? [] : rows, errors };
}

// File 여러 개 → { rows, files: [{name, rows}], errors }
export async function readFiles(files) {
  const list = [...files];
  if (!list.length) return { rows: [], files: [], errors: ["파일을 고르지 않았습니다."] };
  const out = { rows: [], files: [], errors: [] };
  for (const f of list) {
    if (!/\.csv$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) {
      out.errors.push(`${f.name}: CSV 파일이 아닙니다.`);
      continue;
    }
    const { rows, errors } = readTable(f.name, await f.text());
    out.errors.push(...errors);
    out.files.push({ name: f.name, rows: rows.length });
    out.rows.push(...rows);
  }
  if (out.errors.length) out.rows = [];
  return out;
}
