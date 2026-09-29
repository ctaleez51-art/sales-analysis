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

## 5. 목표 단계
| Step | 목표 |
|---|---|
| 1 | 핵심 흐름: CSV 업로드 → 지표 계산 → AI 분석 → 대시보드 |
| 2 | 저장, 권한, 배포: 로그인, 내 데이터만 보기, 배포 주소 |
| 3 | 주요 사용성: 결제, 오류 안내 |
| 4 | 협업, 품질: PR 확인, 합친 뒤 재점검 |
| 5 | 고급 기능, 운영 준비: 정확도 기록, 사용량 제한, 키 점검 |

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
| Q-06 | Supabase 프로젝트 통일 | 2번 로그인 · DB 와 4번 AI 서버가 **서로 다른 Supabase 프로젝트**를 쓰고 있음. 하나로 정해야 로그인 토큰 · 사용 한도를 AI 서버에서 확인할 수 있음 (2번 PR #4 "팀 확인 필요") |
