# PRD - 매출분석 툴

> 초안입니다. 팀 회의에서 (  ) 부분을 채워 확정합니다.
> 2026-09-29 저녁: 팀원 PR #1~#4 에 이미 정해진 내용을 옮겨 적었습니다(출처 표시). 팀이 정할 것은 §10 에 "확인 필요"로 남겼습니다.

| 항목 | 내용 |
|---|---|
| 기간 | 2026-09-28(월) ~ 2026-10-02(금) |
| 제출 마감 | 2026-10-02 오전 10시 |
| 발표 | 2026-10-02 오후, Google Meet (발표 15분, 질의응답·피드백 10분) |

---

## 1. 목적
매출 CSV를 올리면 핵심 지표를 자동 계산하고, AI가 쉬운 말로 분석해 주는 도구를 만듭니다.

**원칙** (출처: 4번 `part4/TEAM_HANDOFF.md` "AI 원칙" · 3번 `docs/part3_answer_scenario.md` §12)
- 숫자는 코드가 계산합니다(`part4/result-engine.js`). AI는 계산된 결과만 받아 해석하고, 숫자를 다시 계산하지 않습니다.
- AI 답변은 확인된 사실 / 원인 후보(확정 아님) / 실행 제안 / 분석 한계를 나눠서 보여 줍니다.
- 상관관계를 인과관계로 단정하지 않습니다.

## 2. 사용자
- 쇼핑몰 운영자

## 3. 핵심 기능
| 기능 | 설명 | 담당 | 현재 (9/29 저녁) |
|---|---|---|---|
| 문서·저장소 | PRD 등 문서 작성, 저장소 관리(merge 등) | 1번 이지연 | `DevelopDoc/` |
| 로그인 | 로그인 화면, DB 만들기 | 2번 허규현 | PR #4 · `part2/` · `supabase/` |
| 결제 | 토스페이먼츠로 결제창 붙이기 | 2번 허규현 | 다음 PR 예정 (`supabase/payment.sql` 은 아직 적용 안 함) |
| CSV 입력 | 더미 데이터 만들기, 정답 시나리오 만들기 | 3번 김보겸 | PR #1 · `data/` · `docs/part3_*` |
| 지표 계산 | 지표 계산식을 코드에 고정, 입력단과 공유 | 4번 김성순 | PR #2 · `part4/result-engine.js` |
| 결과 분석 | 결과분석 출력, OpenAI API 연결 | 4번 김성순 | PR #2 · Supabase Edge Function `analyze-shop` (`part4/AI_SERVER.md`) |
| 대시보드 | 사용자 친화적인 화면, 전체 색·글꼴·버튼 모양·위치 결정 | 5번 이두규 | PR #3 · `part5/` (CSV 업로드·검증 화면 포함) |

## 4. 사용 흐름
로그인 → 결제 → CSV 업로드 → 지표 계산 → AI 분석 → 대시보드 확인

현재 구현 기준 화면 순서 (PR #2~#4, 팀 확인 필요)
1. **로그인** — 로그인 전에는 화면이 가려짐 (2번 `part2/auth.js`)
2. **CSV 올리기** — 월별 CSV 여러 개를 한 번에, 또는 [예시 데이터로 시작]. 잘못된 파일은 이유를 안내 (5번 `part5/csv.js`)
3. **지표 계산** — 올리자마자 자동 (4번 `buildResult`)
4. **대시보드 확인** — KPI 6칸 · 월별 매출 · 구매 퍼널 · 판매 채널별 ROAS · 쿠팡 경쟁가 진단 (5번 `part5/`)
5. **질문 → 분석 계획 확인 → [승인]** — 승인해야 AI를 부름. [취소]하면 부르지 않음 (5번)
6. **AI 분석** — 로그인 토큰과 함께 계산 결과 · 질문을 AI 서버로 보냄 (4번 `analyze-shop`, 로그인 확인 켜짐). 화면에서 하루 한도(2번 `consume_analysis_quota`)를 먼저 확인, 서버 쪽 한도 확인은 아직 (TECH_SPEC T-08)
7. **답변 카드 · 실행 기록** — 실패하면 가짜 결과 없이 실패 안내 (5번)

- **결제의 위치:** 2번 `supabase/schema.sql` 요금제는 무료(하루 AI 분석 5회) · 프로(9,900원, 무제한)입니다. 이 기준이면 결제는 필수 단계가 아니라 **무료 한도를 넘길 때 프로로 올리는 단계**입니다. 위 한 줄 흐름과 다르므로 확인 필요 (Q-07).

## 5. 목표 단계
| Step | 목표 | 현재 (9/29 저녁, 자세히는 STEP_CHECKLIST "현재" 칸) |
|---|---|---|
| 1 | 핵심 흐름: CSV 업로드 → 지표 계산 → AI 분석 → 대시보드 | 파트별 구현(PR #1~#3). 합친 뒤 실제 AI 호출 확인 남음 |
| 2 | 저장, 권한, 배포: 로그인, 내 데이터만 보기, 배포 주소 | 로그인 · RLS 완료(PR #4). 결과 저장 · 배포 남음 |
| 3 | 주요 사용성: 결제, 오류 안내 | 오류 안내 완료(PR #3). 결제는 다음 PR |
| 4 | 협업, 품질: PR 확인, 합친 뒤 재점검 | 코드는 전부 PR. 리뷰 · 합친 뒤 재점검 남음 |
| 5 | 고급 기능, 운영 준비: 정확도 기록, 사용량 제한, 키 점검 | 계산 엔진 정답표 일치 190/190(AI 답변 정확도 기록은 아직), 한도 함수 있음. AI 서버 한도 연결 남음(TECH_SPEC T-08) |

- 우리 팀 목표 단계: (  )
- 단계별 통과 기준: [STEP_CHECKLIST.md](./STEP_CHECKLIST.md)

## 6. 지표 목록
출처: 3번 `docs/part3_csv_input.md` "지표 공식" · `docs/part3_to_part4_metric_spec.md`. 4번 `part4/result-engine.js` 가 이 공식 그대로 계산합니다.

| 지표 | 공식 | 단위 |
|---|---|---|
| 매출 · 광고비 · 방문 · 구매 · 노출 · 클릭 · 장바구니 · 수량 · 반품액 | 합계 | 원 · 건 |
| CTR | clicks / impressions | 소수 |
| 구매전환율 (CVR) | purchases / visits | 소수 |
| 장바구니율 | add_to_cart / visits | 소수 |
| 장바구니→구매율 | purchases / add_to_cart | 소수 |
| ROAS | revenue / ad_spend | 배 |
| CPC | ad_spend / clicks | 원 |
| CPA | ad_spend / purchases | 원 |
| 객단가 (AOV) | revenue / purchases | 원 |
| 방문당 매출 | revenue / visits | 원 |
| 전월 대비 증감률 | (이번 달 − 전달) / 전달 × 100 — 매출 · 광고비 · 방문 · 구매 · ROAS · CVR · CPA · AOV | % |

- 합계를 먼저 내고 비율은 합계로 계산합니다. 분모가 0 이하이면 `null`(계산 불가)입니다.
- 채널별(쿠팡 · 네이버스토어 · 자사몰) 같은 공식, 그리고 쿠팡 경쟁가 진단(`competitor_min_price < unit_price` 제품 목록)을 함께 냅니다.

## 7. CSV 형식
출처: 3번 `docs/part3_csv_input.md` "CSV 형식 (제안안)".

- **필수 7열:** `date`(YYYY-MM-DD, 주 구간 시작일) · `product` · `channel` · `ad_spend` · `visits` · `purchases` · `revenue`
- **선택 열:** `period_end` · `days` · `category` · `unit_price` · `discount_rate` · `competitor_min_price` · `impressions` · `clicks` · `add_to_cart` · `units` · `refund` · `holidays` · `stockout_days`
- 한 행 = 1주 구간 × 채널 × 제품, 금액은 원 단위, UTF-8(BOM 있어도 됨), 제목 행 1줄
- **월별 파일을 여러 개 한 번에 올립니다.** 전월 대비는 두 달 이상이 있어야 나옵니다.
- 예시 데이터: `data/sales_2026_06.csv` ~ `sales_2026_09.csv` (월 300행, 총 1,200행) · 정답표 `data/answer_key.json`

## 8. 보안
- API 키, 비밀번호는 코드에 넣지 않고 `.env`에 둡니다. `.env`는 GitHub에 올리지 않습니다.
- 중요한 키는 Claude에게도 직접 보여 주지 않습니다.
- OpenAI 키 · Supabase service_role 키 · 토스 시크릿 키는 **서버(Edge Function) Secret 에만** 둡니다. 브라우저에 가는 것은 Supabase URL 과 공개용 publishable 키뿐입니다 (TECH_SPEC §7).
- 데이터는 DB 의 RLS 가 지킵니다 — 로그인한 본인 행만 읽고 쓰기 (2번 `supabase/schema.sql`, 권한 테스트 10/10).
- AI 답변은 화면에 넣을 때 HTML 이스케이프합니다(태그가 글자로 보임) (5번 `part5/answer-card.js`).

## 9. 일정
| 날짜 | 목표 |
|---|---|
| (  ) | 역할별 1차 완성 |
| (  ) | 합치기, 테스트 |
| 10/02 오전 10시 | 제출 |
| 10/02 오후 | 발표 |

## 10. 미결정 사항
| # | 항목 | 현재 (9/29 저녁) |
|---|---|---|
| Q-01 | 목표 단계 | 확인 필요 |
| Q-02 | 지표 목록 | 3번 제안안 반영(§6). 팀 확정 필요 |
| Q-03 | CSV 형식 | 3번 제안안 반영(§7). 팀 확정 필요 |
| Q-04 | 기술 스택 (TECH_SPEC.md 참고) | 현재 전 파트가 HTML/JS + Supabase 로 구현 중(2번도 9/29 HTML/JS 로 옮김). 팀 확정 필요 |
| Q-05 | 일정 | 확인 필요 |
| Q-06 | Supabase 프로젝트 통일 | **정리됨(9/29 밤)** — 4번이 AI 서버를 2번과 같은 팀 프로젝트로 옮김(PR #2 `part4/RUN.md` · `AI_SERVER.md`). 병합 뒤 확인 |
| Q-07 | 결제의 위치 (§4) | 필수 단계인지, 무료 한도를 넘길 때 올리는 단계인지 |

## 11. 성공 기준
출처: STEP_CHECKLIST Step 1 · 3번 `data/answer_key.json` · `docs/part3_answer_scenario.md`

예시 데이터(6~9월 CSV 4개)를 넣었을 때:
- **숫자:** 9월 매출 27,356,180원(전월 대비 -31.45%) · 광고비 6,928,570원(+23.07%) · ROAS 3.95배(-44.30%) · 구매전환율 2.99%(-33.37%)가 화면에 나온다
- **채널:** 하락이 쿠팡에 몰려 있다(하락액의 92.7%), 쿠팡 9월 ROAS 2.97배
- **AI 답변:** 쿠팡 전환율 하락 · 경쟁가 8개 제품 · 광고비 증가에도 ROAS 악화 · 인과 확정 불가를 짚고, 추석 · 품절 · 유입 감소 같은 함정 변수를 원인으로 단정하지 않는다 (시나리오 §12 오답 기준)
- **실패:** AI 가 응답하지 않으면 가짜 결과 없이 "실패"가 나온다
- 전체 통과 기준은 [STEP_CHECKLIST.md](./STEP_CHECKLIST.md)

## 12. 제출물
출처: [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md) Part C · 마감 10/02 오전 10시
- GitHub 링크 · 저장소 맨 위 `README.md`
- `DevelopDoc/` 에 PRD · TECH_SPEC · WORK_UNITS · FINAL_CHECKLIST (+ STEP_CHECKLIST)
- 체험 URL — GitHub Pages 를 켠 뒤 `https://ctaleez51-art.github.io/sales-analysis/part5/` (TECH_SPEC T-05)
- 발표 자료 (역할 분담 · 개발 일정 포함)

## 13. 알려진 제약 (9/29 저녁)
- 개발용으로 Supabase 이메일 인증(Confirm email)을 꺼 두어, 없는 이메일로도 가입된다 (2번 `docs/part2_auth_db.md`)
- 로그인 전 화면 가리기는 1차 방어이고, 데이터 보호는 RLS 가 한다 (2번 PR #4)
- AI 서버는 로그인 토큰은 확인하지만(verify_jwt), 하루 한도는 아직 서버에서 확인하지 않는다 — 화면에서만 먼저 확인 (TECH_SPEC T-08)
- 예시 데이터는 가상의 건강보조식품 쇼핑몰이다. 제품명만 실제 판매 제품을 참고했다 (3번 `docs/part3_csv_input.md`)
