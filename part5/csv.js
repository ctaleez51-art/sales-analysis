/**
 * [5번] CSV 읽기 · 검증 — 3번 명세(docs/part3_to_part4_metric_spec.md "CSV 읽기")를 따른다.
 *   - 여러 파일을 한 번에 받아 행을 합친다 (파일끼리 열 구성이 달라도 필수 열만 있으면 됨)
 *   - UTF-8 BOM 제거, 줄바꿈 \n · \r\n, 따옴표 안 쉼표 · 줄바꿈 · "" 처리
 *   - 실패하면 이유를 모아서 돌려준다 (파일명 · 행 번호 · 열 이름)
 * 숫자는 여기서 바꾸지 않는다. 계산은 4번 buildResult 가 한다.
 */
// 필수 = 4번 buildResult 가 읽는 14열. 3번 정답표(answer_key.json)가 이 14열로 만든 값을 전부 검증하므로,
// 7열만 필수로 두면 선택 열로 만든 지표(CTR · 장바구니율 · 경쟁가 진단)가 0으로 계산돼 정답과 어긋난다.
export const REQUIRED = ["date", "product", "channel", "unit_price", "competitor_min_price", "impressions", "clicks",
  "visits", "add_to_cart", "purchases", "units", "revenue", "ad_spend", "refund"];
export const REQUIRED_NUMBERS = ["unit_price", "competitor_min_price", "impressions", "clicks", "visits", "add_to_cart",
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
    for (const k of REQUIRED_NUMBERS) {
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
