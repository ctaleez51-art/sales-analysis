# 기술 명세서 - 매출분석 툴

> 초안입니다. 팀 회의에서 (  ) 부분을 채워 확정합니다.
> 2026-09-29 저녁: 팀원 PR #1~#4 에 이미 구현 · 문서화된 내용을 옮겨 적었습니다(출처 표시). "현재 구현 기준"은 팀 확정 전입니다.

| 항목 | 내용 |
|---|---|
| 선행 문서 | [PRD.md](./PRD.md) |

---

## 1. 기술 스택
현재 구현 기준 (팀 확정 필요 — T-01)

| 구분 | 선택 | 담당 |
|---|---|---|
| 프론트엔드 | HTML + JavaScript (빌드 없는 정적 파일, 파트별 폴더 `part2/` · `part4/` · `part5/`) | 2번(로그인 화면) · 5번(대시보드) |
| 백엔드 | Supabase Edge Function — AI 분석 `analyze-shop`(4번), 결제 승인(2번, 예정) | 4번 · 2번 |
| DB | Supabase (PostgreSQL + Auth + RLS, CSV 저장 버킷) | 2번 |
| 결제 | 토스페이먼츠 테스트 모드 | 2번 |
| AI | OpenAI API (Edge Function 안에서 호출, 키는 서버 Secret) | 4번 |
| 배포 | GitHub Pages (저장소 Settings 에서 켜기 필요 — T-05) | (  ) |

## 2. 구조
```
[로그인] 2번 part2/auth.js (Supabase Auth, 로그인 전 화면 가리기)
   ▼
[CSV 입력] 3번 data/*.csv (예시 데이터) · 5번 part5/csv.js (업로드 · 검증)
   ▼
[지표 계산] 4번 part4/result-engine.js  buildResult(rows)
   ▼
[대시보드] 5번 part5/  ── 계획 승인 뒤 ──▶ [결과 분석(OpenAI)] 4번 Edge Function analyze-shop
                                             ▼
                                        답변 카드 (5번)
```

## 3. 모듈 사이 약속

### 3.1 CSV 입력단 → 지표 계산
출처: 3번 `docs/part3_to_part4_metric_spec.md` "입력: rows"
- 넘겨주는 데이터 형식: **행 객체 배열 `rows`**. 키는 CSV 열 이름(영문 소문자 snake_case). 여러 달의 파일을 합친 배열
- 필수 키 7개: `date` · `product` · `channel` · `ad_spend` · `visits` · `purchases` · `revenue` (선택 키는 PRD §7)
- 숫자는 문자열로 들어와도 되고 계산 쪽에서 Number 로 바꿈. 월은 `date` 앞 7글자
- CSV 읽기 · 검증(따옴표 안 쉼표, 필수 열 누락, 숫자 아닌 값, 빈 파일): 명세상 4번 담당, 현재 구현은 5번 `part5/csv.js` (T-09)

### 3.2 지표 계산 → 대시보드
출처: 4번 `part4/result-engine.js` (`schema_version` 1.1), `part4/TEAM_HANDOFF.md`
- 계산 결과 형식: `buildResult(rows)` 가 돌려주는 객체

| 키 | 내용 |
|---|---|
| `currentPeriod` · `previousPeriod` | 가장 최근 달 · 바로 전 달 (`"2026-09"`) |
| `current` · `previous` | 두 달의 지표(§3.3) |
| `changes` | 전월 대비 증감률 — **이미 % 단위** |
| `monthly_kpis` | 달마다 지표 |
| `channel_kpis` | 채널 → 달 → 지표 |
| `diagnostics` | 쿠팡 경쟁가 진단: 제품 목록 · 기준 · "인과 확정 아님" 문구 |

- 표시 규칙: 비율(`ctr` · `cvr` · `cart_rate` 등)은 소수 → 화면에서 %, `roas` 는 배, `null` 은 0 이 아니라 "계산 불가". **대시보드는 다시 계산하지 않는다**

### 3.3 지표 계산식
입력단(3번)과 결과 출력단(4번)이 같은 계산식을 씁니다. 출처: 3번 `docs/part3_to_part4_metric_spec.md` "계산 방법"

| 지표 | 계산식 |
|---|---|
| 합계 | `ad_spend` · `impressions` · `clicks` · `visits` · `add_to_cart` · `purchases` · `units` · `revenue` · `refund` 를 먼저 더함 |
| `ctr` | clicks / impressions |
| `cvr` | purchases / visits |
| `cart_rate` | add_to_cart / visits |
| `cart_to_purchase_rate` | purchases / add_to_cart |
| `roas` | revenue / ad_spend |
| `cpc` | ad_spend / clicks |
| `cpa` | ad_spend / purchases |
| `aov` | revenue / purchases |
| `revenue_per_visit` | revenue / visits |
| 증감률 | (current − previous) / previous × 100 — previous 가 0 이하 · null 이면 null |

- 분모가 0 이하이면 `null`. `revenue` 는 반품 전 매출이고 `refund` 는 빼지 않는다

### 3.4 대시보드 → AI 분석
출처: 4번 `part4/AI_SERVER.md`, 5번 `part5/app.js`
- 요청: `POST …/functions/v1/analyze-shop` 본문 `{ result: buildResult 결과, question: 사용자 질문 }`
- 응답: `{ analysis }` — 모범 답 구조는 `summary · facts · hypotheses · actions · limitations` (3번 `docs/part3_answer_scenario.md` §10)
- 대시보드는 **계획 승인 뒤에만** 요청하고, 20초가 넘거나 실패하면 가짜 결과 없이 실패 안내

## 4. 데이터 모델
출처: 2번 `supabase/schema.sql`, `docs/part2_auth_db.md`

| 테이블 | 내용 |
|---|---|
| `plans` | 요금제와 하루 AI 분석 한도 |
| `profiles` | 사용자별 요금제 · 오늘 사용 횟수 (가입하면 자동 생성) |
| `projects` | 분석 프로젝트 (주인만 보기 · 수정) |
| `datasets` · `dataset_versions` | 올린 CSV 와 버전 |
| `analysis_runs` · `tool_steps` | 분석 실행 기록과 단계 |
| `payments` | 결제 기록 (사용자가 직접 만들 수 없음) |

- 모든 테이블에 RLS: 로그인한 본인 행만. 사용량 차감은 `consume_analysis_quota()` 함수

## 5. API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/functions/v1/analyze-shop` | 계산 결과 + 질문 → AI 해석 (4번) |
| POST | Supabase Auth (`supabase-js` `signUp` · `signInWithPassword` · `signOut`) | 회원가입 · 로그인 · 로그아웃 (2번) |
| POST | `/rest/v1/rpc/consume_analysis_quota` (`Auth.consumeQuota()`) | 분석 직전 하루 한도 1회 차감 (2번) |
| (  ) | (  ) | 결제 승인 (2번, 예정) |

## 6. 폴더 구조
PR #1~#4 를 합친 뒤 기준
```
README.md
DevelopDoc/           PRD · TECH_SPEC · WORK_UNITS · STEP_CHECKLIST · FINAL_CHECKLIST (1번)
part2/                로그인 화면 · config.js (2번)
supabase/             schema.sql · rls_test.sql · payment.sql (2번)
data/                 예시 CSV 4개 · answer_key.json (3번)
tools/                generate_sales.py — 예시 데이터 생성 (3번)
docs/                 part2_auth_db.md (2번) · part3_*.md (3번) · test_results/
part4/                result-engine.js · AI_SERVER.md · TEAM_HANDOFF.md (4번)
part5/                대시보드 index.html · app.js · csv.js · 화면 부품 (5번)
```

## 7. 환경변수
실제 값은 `.env`에만 적고 GitHub에 올리지 않습니다.

| 이름 | 용도 | 위치 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 | 4번 Edge Function Secret (저장소 · 브라우저에 없음) |
| (  ) | 토스페이먼츠 키 | 클라이언트 키는 결제 페이지(공개 가능) · 시크릿 키는 Edge Function Secret (2번, 예정) |
| Supabase URL · publishable 키 | DB 접속 정보 | `part2/config.js` — 브라우저 공개용 키, 데이터는 RLS 가 지킴 |
| Supabase service_role 키 | 결제 승인 후 요금제 변경 | Edge Function Secret 만 (2번, 예정) |

## 8. 테스트
| 무엇 | 방법 | 결과 · 기록 |
|---|---|---|
| 지표 계산 정확도 | CSV 4개(1,200행) → `buildResult` → `answer_key.json` 비교 | 190/190 PASS (4번 `part4/TEAM_HANDOFF.md`) |
| DB 권한 | A/B 계정 RLS 테스트 10개 (`supabase/rls_test.sql`) | 10/10 통과 (2번 `docs/test_results/rls_test_2026-09-29.csv`) |
| 로그인 화면 | 입력 검사 · 없는 계정 로그인 · 같은 이메일 재가입 · 새로고침 유지 · 하루 한도 · 로그아웃 | 통과 (2번 PR #4 확인표) |
| 대시보드 | 정답표 숫자 일치 · 파일 직접 올리기 · 잘못된 CSV 4종 · 승인 전 AI 0회 · AI 실패 카드 · 375px (AI 는 가짜 응답) | PR #3 본문 확인 7항목 통과 (5번) |
| 합친 뒤 | Step 1~3 다시 해 보기 | (  ) |

## 9. 미결정 사항
| # | 항목 | 현재 (9/29 저녁) |
|---|---|---|
| T-01 | 기술 스택 (§1) | 현재 구현 기준 반영. 팀 확정 필요 |
| T-02 | 모듈 사이 데이터 형식 (§3) | 3번 · 4번 문서 기준 반영 |
| T-03 | 지표 계산식 (§3.3) | 3번 명세 반영 |
| T-04 | DB 테이블 (§4) | 2번 schema.sql 반영 |
| T-05 | 배포 방법 | GitHub Pages — 저장소 주인 설정 필요(2번 PR #4 에 방법 있음), 체험 주소는 `…/part5/` |
| T-06 | 테스트 방법 | §8 반영, "합친 뒤" 칸은 병합 후 |
| T-07 | Supabase 프로젝트 통일 | 2번(로그인 · DB)과 4번(AI 서버)이 서로 다른 프로젝트. 하나로 정해야 AI 서버에서 로그인 · 한도 확인 가능 |
| T-08 | AI 서버의 로그인 · 사용 한도 확인 | 한도 함수는 DB 에 있고(2번), AI 서버에서 부르는 부분은 아직 없음 (STEP_CHECKLIST Step 5) |
| T-09 | CSV 읽기 담당 | 3번 명세는 4번, 현재 구현은 5번 `part5/csv.js`. 누가 맡을지 확인 |
