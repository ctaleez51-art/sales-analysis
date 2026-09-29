# 4번 지표 계산 모듈 구현 명세 (3번 → 4번)

> 4번 담당이 AI에게 이 파일을 그대로 읽히고 작업하도록 쓴 문서입니다.
> 작성: 3번 CSV 입력단 · 관련 문서: [part3_csv_input.md](part3_csv_input.md), [part3_answer_scenario.md](part3_answer_scenario.md)

## 배경

- 3번(CSV 입력단)은 CSV를 읽어 **행 객체 배열(rows)** 을 4번 모듈에 넘긴다. 4번 모듈은 rows를 받아 지표를 계산한다.
- 더미 데이터: `data/sales_2026_06.csv` ~ `data/sales_2026_09.csv` (월별 300행)
- 정답표: `data/answer_key.json`

## 입력: rows

- 형식: 객체 배열. 키는 CSV 열 이름이다 (영문 소문자, snake_case).
- 필수 키 7개: `date`, `product`, `channel`, `ad_spend`, `visits`, `purchases`, `revenue`
- 선택 키: `period_end`, `days`, `category`, `unit_price`, `discount_rate`, `competitor_min_price`, `impressions`, `clicks`, `add_to_cart`, `units`, `refund`, `holidays`, `stockout_days`
- `date`: `"YYYY-MM-DD"` 문자열 (주 구간 시작일)
- 금액 단위: 원 (정수)
- 숫자 열이 문자열로 들어올 수 있다. 계산 전에 Number로 변환하고, 변환 실패나 빈 값은 0으로 본다.
- 행 하나 = 1주 구간 × 채널 × 제품이다. 여러 달의 파일을 합친 배열이 들어온다.

## 계산 방법

1. **합계를 먼저 구하고, 비율은 합계로 계산한다.** 행별 비율을 평균하지 않는다.
   합계 대상 필드: `ad_spend`, `impressions`, `clicks`, `visits`, `add_to_cart`, `purchases`, `units`, `revenue`, `refund`

2. **파생 지표** (필드명을 그대로 사용):

   | 필드 | 공식 |
   |---|---|
   | `ctr` | clicks / impressions |
   | `cvr` | purchases / visits |
   | `cart_rate` | add_to_cart / visits |
   | `cart_to_purchase_rate` | purchases / add_to_cart |
   | `roas` | revenue / ad_spend |
   | `cpc` | ad_spend / clicks |
   | `cpa` | ad_spend / purchases |
   | `aov` | revenue / purchases |
   | `revenue_per_visit` | revenue / visits |

3. **분모가 0 이하이면 결과는 `null`** 이다. 0, NaN, Infinity를 반환하지 않는다.

4. **비율(`ctr`, `cvr`, `cart_rate`, `cart_to_purchase_rate`)은 소수로 반환한다.** 예: 4.5% → 0.045. 100을 곱하지 않는다.

5. **월 구분은 `date` 문자열의 앞 7글자**(`"2026-09"`)로 한다. 날짜 객체로 변환하지 않는다. 시간대 때문에 월이 바뀔 수 있다.

6. **전월 대비 증감률**
   - 들어온 데이터의 가장 최근 월 = current, 바로 전 월 = previous
   - `change = (current - previous) / previous * 100`
   - **이 값만 퍼센트 단위다.** 예: -31.45는 -31.45%를 뜻한다.
   - previous가 0 이하이거나 null이면 결과는 null
   - 대상: `revenue`, `ad_spend`, `visits`, `purchases`, `roas`, `cvr`, `cpa`, `aov`
   - 월이 1개뿐이면 비교하지 않는다. changes를 비우거나 previous를 null로 둔다.

7. **채널별 지표**: 월 × `channel` 로 묶어 2번 공식을 똑같이 적용한다.

## 주의할 데이터 특성

- 9월 쿠팡에 `purchases = 0` 인 행이 있다. 개별 행이나 제품 단위로 계산할 때 `cpa`, `aov` 가 null로 나와야 한다.
- `refund`(반품액)는 합계만 낸다. `revenue` 에서 빼지 않는다. `revenue` 는 반품 전 총매출이다.
- 지표 계산에 LLM을 쓰지 않는다. 숫자는 코드로 결정론적으로 계산하고, LLM에는 계산된 결과만 넘긴다.

## 검증 기준 (필수)

`data/answer_key.json` 의 값과 비교하는 테스트를 작성한다. 4개 CSV를 모두 합쳐 넣었을 때 아래 값이 나와야 한다.

**`monthly_kpis["2026-09"]`**

| 필드 | 값 |
|---|---:|
| revenue | 27356180 |
| ad_spend | 6928570 |
| visits | 25452 |
| purchases | 761 |
| add_to_cart | 1905 |
| clicks | 15662 |
| impressions | 836534 |
| roas | 3.948315 |
| cvr | 0.029899 |
| ctr | 0.018722 |
| cart_rate | 0.074847 |
| cart_to_purchase_rate | 0.399475 |
| cpc | 442.380922 |
| cpa | 9104.55979 |
| aov | 35947.674113 |
| revenue_per_visit | 1074.814553 |

**전월 비교**: currentPeriod `"2026-09"`, previousPeriod `"2026-08"`

| 필드 | changes 값 (%) |
|---|---:|
| revenue | -31.452 |
| ad_spend | 23.0656 |
| visits | 0.8999 |
| purchases | -32.7739 |
| roas | -44.2996 |
| cvr | -33.3734 |
| cpa | 83.0621 |
| aov | 1.9663 |

**채널별**: `channel_kpis["쿠팡"]["2026-09"].roas` = 2.9732

**허용 오차**
- 합계(정수): 정확히 일치
- 비율·금액 지표: 소수 6자리 반올림 기준 ±0.000001
- changes: 소수 4자리 반올림 기준 ±0.0001

6·7·8월 값과 채널별 값도 `answer_key.json` 의 `monthly_kpis`, `channel_kpis` 에 있다. 전부 비교한다.

## 합의가 필요한 것 (3번과 협의)

- 지표 추가·삭제 (예: 순매출 = revenue − refund, 상품별 매출). 바꾸면 3번이 정답표를 다시 만든다.
- 3번 → 4번 함수 이름과 반환 JSON 구조
- 5번(대시보드)과 OpenAI에 넘길 결과 형식
