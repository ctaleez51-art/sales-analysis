# Part 4 → Team Handoff

## 가져갈 핵심 파일
- `result-engine.js`: 3번 rows → 결정론적 KPI 계산
- `app.js`: OpenAI 분석 호출 예시
- `index.html`, `styles.css`: 독립 데모용(팀 통합 시 선택)

## 3번 → 4번 입력
`rows: Array<Object>`

필수: `date, product, channel, ad_spend, visits, purchases, revenue`

선택: `impressions, clicks, add_to_cart, units, refund` 등.

## 4번 → 5번 출력
```json
{
  "currentPeriod": "2026-09",
  "previousPeriod": "2026-08",
  "current": {},
  "previous": {},
  "changes": {},
  "monthly_kpis": {},
  "channel_kpis": {},
  "ai_analysis": {}
}
```

### 표시 규칙
- ctr/cvr/cart_rate 등 비율은 소수. 예: 0.029899 → UI에서 2.99%
- roas는 배수. 예: 3.948315 → 3.95배 또는 394.8%
- changes는 이미 퍼센트 단위. -31.452 → -31.452%
- null은 0이 아니라 계산 불가
- 5번은 KPI를 재계산하지 않고 시각화

## 정답 검증 기준
3번 PR #1의 `data/answer_key.json` 기준.

2026-09:
- revenue 27356180
- ad_spend 6928570
- visits 25452
- purchases 761
- roas 3.948315
- cvr 0.029899
- ctr 0.018722
- cpa 9104.55979
- aov 35947.674113
- revenue_per_visit 1074.814553

8→9월:
- revenue -31.452%
- ad_spend +23.0656%
- visits +0.8999%
- purchases -32.7739%
- roas -44.2996%
- cvr -33.3734%
- cpa +83.0621%
- aov +1.9663%

쿠팡 2026-09 ROAS = 2.9732

## AI 원칙
계산은 코드가 수행하고 OpenAI는 계산 완료 결과만 해석합니다.
확인된 사실 / 원인 후보 / 다음 액션 / 분석 한계를 구분합니다.
API 키는 브라우저 또는 GitHub에 저장하지 않습니다.


## 검증 완료 (2026-09-29)

3번 담당 PR #1의 실제 CSV 4개(`sales_2026_06.csv` ~ `sales_2026_09.csv`)를 합쳐 **총 1,200행**을 4번 계산 로직으로 검증했습니다.

- 검증 항목: **190개**
- PASS: **190**
- FAIL: **0**
- 월별 KPI: PASS
- 8월 → 9월 증감률: PASS
- 채널별 KPI: PASS
- 0분모/null 규칙: 명세 반영

대표 검증값:
- 2026-09 revenue = 27,356,180
- 2026-09 ad_spend = 6,928,570
- 2026-09 visits = 25,452
- 2026-09 purchases = 761
- 2026-09 roas = 3.948315
- 2026-09 cvr = 0.029899
- 2026-09 cpa = 9,104.55979
- 2026-09 aov = 35,947.674113
- revenue change = -31.452%
- roas change = -44.2996%
- 쿠팡 2026-09 roas = 2.9732

**결론: 3번 → 4번 KPI 계산 계약이 `data/answer_key.json` 기준으로 전 항목 일치합니다.**
