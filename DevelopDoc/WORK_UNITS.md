# 단위 작업 명세서 - 매출분석 툴

> 초안입니다. 팀 회의에서 (  ) 부분을 채워 확정합니다.
> 2026-09-29 저녁: 각자 PR 에 적힌 작업 · 확인 결과를 완료 조건으로 옮겼습니다. [x] 는 PR 에 증거가 있는 것, 병합 전이라 상태는 🔄 입니다.

| 항목 | 내용 |
|---|---|
| 기준 문서 | [PRD.md](./PRD.md), [TECH_SPEC.md](./TECH_SPEC.md) |

---

## 1. 규칙
- 각 단위는 완료 조건 체크박스를 전부 확인해야 완료입니다.
- 자기 브랜치에서 작업하고, 끝나면 Pull Request를 올립니다. (저장소 쓰기 권한이 없으면 포크에서 PR — 4번 · 5번)

## 2. 단위 목록

| # | 단위 | 담당 | 브랜치 | PR |
|---|---|---|---|---|
| U01 | 문서 작성 | 1번 이지연 | `main` | — |
| U02 | 로그인 화면 + DB | 2번 허규현 | `feature/login-payment` | #4 |
| U03 | 결제창 (토스페이먼츠) | 2번 허규현 | `feature/login-payment` | 다음 PR 예정 |
| U04 | 더미 데이터 + 정답 시나리오 | 3번 김보겸 | `feature/csv-input` | #1 |
| U05 | 지표 계산식 | 4번 김성순 | `feature/part4-result-engine` (포크) | #2 |
| U06 | 결과분석 출력 + OpenAI 연결 | 4번 김성순 | `feature/part4-result-engine` (포크) | #2 |
| U07 | 대시보드 + CSS | 5번 이두규 | `feature/dashboard` (포크) | #3 |
| U08 | 합치기 | 1번 이지연 | `main` | — |

---

## 3. 단위 정의

### U01 · 문서 작성
**담당** 1번 이지연
- [ ] PRD.md 미결정 사항 전부 채움 (9/29 밤: Q-02 · Q-03 · Q-04 반영, Q-06 정리됨, Q-01 · Q-05 · Q-07 남음)
- [ ] TECH_SPEC.md 미결정 사항 전부 채움 (9/29 밤: T-02 ~ T-04 · T-06 반영, T-07 정리됨, T-01 · T-05 · T-08 · T-09 남음)
- [ ] 병합 뒤 README 폴더 구조를 실제 폴더에 맞춤 (TECH_SPEC §6)

### U02 · 로그인 화면 + DB
**담당** 2번 허규현 · 결과물 `part2/` · `supabase/` · `docs/part2_auth_db.md`
- [x] 회원가입 · 로그인 · 로그아웃, 로그인 전 화면 가리기 (PR #4 확인표)
- [x] 테이블 · RLS · 하루 사용 한도 함수 (`supabase/schema.sql`)
- [x] A/B 권한 테스트 10/10 (`docs/test_results/rls_test_2026-09-29.csv`)
- [x] 새로고침해도 로그인 유지 (PR #4 확인표)
- [ ] 5번 화면(`part5/index.html`)에 로그인 붙이기 — #3 병합 뒤 2번이 PR 예정
- [ ] B 계정으로 A 계정의 분석 결과를 열면 거부 (STEP_CHECKLIST Step 2 — 분석 결과 저장이 연결된 뒤)

### U03 · 결제창 (토스페이먼츠)
**담당** 2번 허규현
- [ ] 테스트 결제 왕복 (`supabase/payment.sql` 은 작성됨, 아직 Supabase 에 적용 안 함)
- [ ] 결제 취소 · 실패 시 안내, 분석으로 안 넘어감 (STEP_CHECKLIST Step 3)

### U04 · 더미 데이터 + 정답 시나리오
**담당** 3번 김보겸 · 결과물 `data/` · `docs/part3_*.md` · `tools/generate_sales.py`
- [x] 월별 CSV 4개 (6~9월, 월 300행, 총 1,200행, 열 20개)
- [x] 정답 시나리오 (`docs/part3_answer_scenario.md`) + 코드 대조용 정답표 (`data/answer_key.json`)
- [x] 4번 지표 계산 구현 명세 (`docs/part3_to_part4_metric_spec.md`)
- [x] 전 행 무결성 검증 (매출 = 수량 × 판매가 × (1 − 할인율) 등)

### U05 · 지표 계산식
**담당** 4번 김성순 · 결과물 `part4/result-engine.js`
- [x] 계산식을 코드에 고정 (`buildResult`, `calculateKPIs`)
- [x] 입력단(3번)과 계산식 공유 (3번 명세의 공식 · 필드명 그대로)
- [x] 정답표 대조 190/190 PASS (`part4/TEAM_HANDOFF.md`)
- [x] 쿠팡 경쟁가 진단 (`diagnostics`)

### U06 · 결과분석 출력 + OpenAI 연결
**담당** 4번 김성순 · 결과물 `part4/AI_SERVER.md`
- [x] Supabase Edge Function `analyze-shop` — OpenAI 키는 서버 Secret, 서버 코드 `part4/supabase/functions/analyze-shop/index.ts`
- [x] 팀 Supabase 프로젝트로 통일 · 로그인 토큰 확인(verify_jwt) (`part4/RUN.md`)
- [x] 사실 / 원인 후보 / 다음 액션 / 한계 구분 원칙 (`part4/AI_SERVER.md`)
- [ ] AI 서버에서 하루 한도 확인 (TECH_SPEC T-08, STEP_CHECKLIST Step 5)
- [ ] 분석문의 숫자가 계산 결과와 같은지 확인 (STEP_CHECKLIST Step 1)

### U07 · 대시보드 + CSS
**담당** 5번 이두규 · 결과물 `part5/`
- [x] 전체 색, 글꼴, 버튼 모양, 위치 결정 (`part5/styles.css` · `dashboard.css`)
- [x] 3번 데이터 → 4번 `buildResult` → 화면. KPI 6칸이 정답표와 같음, 화면은 다시 계산 안 함 (PR #3)
- [x] CSV 여러 개 올리기 + 검증 (`part5/csv.js`)
- [x] 계획 승인 → AI 분석 → 답변 카드, 기다림 · 실패 · 중단 화면 (가짜 AI 응답으로 확인)
- [ ] 실제 AI 서버로 한 번 확인
- [ ] 2번 로그인과 합친 뒤 다시 확인

### U08 · 합치기
**담당** 1번 이지연
- [ ] 모든 PR merge — 순서: #1(3번) · #2(4번) → #3(5번, 1 · 2번 파일을 불러옴) → #4(2번). 4개를 함께 합쳐도 충돌 없음 (5번이 9/29 저녁 로컬에서 합쳐 확인)
- [ ] 합친 뒤 STEP_CHECKLIST Step 1~3 다시 해 보기

---

## 4. 진행 추적

| # | 단위 | 담당 | 상태 | 완료일 |
|---|---|---|---|---|
| U01 | 문서 작성 | 이지연 | 🔄 | |
| U02 | 로그인 화면 + DB | 허규현 | 🔄 PR #4 | |
| U03 | 결제창 | 허규현 | ⬜ | |
| U04 | 더미 데이터 + 정답 시나리오 | 김보겸 | 🔄 PR #1 | |
| U05 | 지표 계산식 | 김성순 | 🔄 PR #2 | |
| U06 | 결과분석 출력 + OpenAI 연결 | 김성순 | 🔄 PR #2 | |
| U07 | 대시보드 + CSS | 이두규 | 🔄 PR #3 | |
| U08 | 합치기 | 이지연 | ⬜ | |

상태: ⬜ 대기 · 🔄 진행 중 · ✅ 완료 · ⛔ 막힘
