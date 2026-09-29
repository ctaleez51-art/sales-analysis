# 잘못된 CSV 시험 파일

3번 `data/sales_2026_*.csv`에서 만든 파일입니다. [CSV 올리기]로 올리면 계산하지 않고 이유를 안내합니다.

| 파일 | 만든 방법 | 화면 안내 |
|---|---|---|
| `bad_format.csv` | 9월 20행, 4행 날짜 `2026/09/01`, 6행 광고비 `많음` | 행 번호 · 열 이름 · 값 |
| `no_visits_column.csv` | 9월 20행, `visits` 열 삭제 | "필수 열이 없습니다 — visits" |
| `required7_2026_08.csv`, `required7_2026_09.csv` | 예전 필수 7열만 남김 (둘 함께 올리기) | "필수 열이 없습니다 — unit_price, competitor_min_price, impressions, clicks, add_to_cart, units, refund" |

시연 순서는 `docs/presentation/DEMO.md`(PR #6)를 보세요.
