# 매출분석 툴

CSV 매출 데이터를 올리면 지표를 계산하고, AI가 결과를 분석해 주는 웹 서비스입니다.

- 숫자는 코드가 계산합니다. AI는 계산된 결과만 받아 해석하고, 숫자를 지어내지 않습니다.
- AI 답변은 확인된 사실, 원인 후보, 다음 행동, 분석 한계로 나눠 보여 줍니다.

## 바로 써 보기

- 주소: `https://ctaleez51-art.github.io/sales-analysis/part5/`
- 회원가입 후 로그인하고, [예시 데이터로 시작]을 누르면 됩니다.

## 사용 흐름

1. 로그인
2. 월별 매출 CSV 올리기 (여러 개 가능) 또는 예시 데이터
3. 지표가 자동으로 계산되어 대시보드에 나옴
4. 질문 → 분석 계획 확인 → 승인
5. AI 분석 답변 확인
6. 무료 한도(하루 5회)를 넘기면 프로 요금제로 결제

## 로컬에서 실행하기

빌드 없이 정적 파일로 돌아갑니다. 저장소 폴더에서 웹 서버를 띄웁니다.

```bash
python -m http.server 8510
```

브라우저에서 `http://localhost:8510/part5/`를 엽니다. 파일을 더블클릭해서(`file://`) 열면 로그인이 동작하지 않습니다.

## 처음 설정 (Supabase)

1. Supabase SQL Editor에서 `supabase/schema.sql`, `supabase/payment.sql` 실행
2. Authentication > Sign In / Providers > Email에서 Confirm email 끄기
3. Edge Function 배포
   - `analyze-shop`(AI 분석): `part4/supabase/functions/analyze-shop/index.ts`. Verify JWT 켬
   - `confirm-payment`(결제 승인): `supabase/functions/confirm-payment/index.ts`. Verify JWT 끔 (로그인 확인은 함수 코드가 함)
4. Edge Function Secret에 아래 키 등록
5. `part2/config.js`에 Supabase 주소, 공개 키, 토스 클라이언트 키 입력 (팀 프로젝트 값은 이미 들어 있음)

토스 키는 "API 개별 연동 키"를 씁니다. `g`가 들어간 결제위젯 키(`test_gck_`, `test_gsk_`)는 쓰지 않습니다.

## 환경변수 이름

| 이름 | 용도 | 위치 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 | Edge Function Secret |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (`test_sk_`) | Edge Function Secret |
| `url`, `key` | Supabase 주소, 공개용 publishable 키 | `part2/config.js` |
| `tossClientKey` | 토스페이먼츠 클라이언트 키 (`test_ck_`) | `part2/config.js` |

시크릿 키는 저장소와 브라우저 코드에 넣지 않습니다. `part2/config.js`에는 공개해도 되는 키만 넣습니다.

## 샘플 데이터

- `data/sales_2026_06.csv` ~ `sales_2026_09.csv`: 가상 건강보조식품 쇼핑몰의 6~9월 매출 (총 1,200행)
- `data/answer_key.json`: 정답표
- `part5/test-csv/coupang_orders_2026_09.csv`, `naver_orders_2026_09.csv`: 쿠팡, 네이버스토어 주문내역 원본 형식 시험 파일 (구매자·수취인 칸은 지움)
- CSV 형식은 `DevelopDoc/PRD.md` §7

## 구조

```
README.md
DevelopDoc/   PRD, TECH_SPEC, WORK_UNITS, FINAL_CHECKLIST
Submission/   STEP_CHECKLIST, SUBMISSION, ANALYSIS_SUBMISSION
part2/        로그인, 결제 화면
supabase/     DB 테이블, 권한, 결제 함수, 결제 승인 서버
data/         예시 CSV, 정답표
tools/        예시 데이터 생성 스크립트
part4/        지표 계산, AI 분석 서버
part5/        대시보드
```

## 제약

- 개발용으로 이메일 인증을 꺼 두어, 없는 이메일로도 가입할 수 있습니다.
- 결제는 토스페이먼츠 테스트 모드입니다. 결제 취소·환불 기능은 없습니다.
- 월 단위로만 분석합니다. 상품별, 주별 분석은 하지 않습니다.
- 결측치나 중복 행을 자동으로 고치지 않습니다. 잘못된 CSV는 오류로 알려 줍니다.
- AI 분석은 응답까지 수십 초 걸릴 수 있습니다.

## 역할분담

| 번호 | 역할 | 담당 | 브랜치 |
|---|---|---|---|
| 1 | 프로젝트매니저 (PRD, 저장소 관리) | 이지연 | `main` 관리 |
| 2 | 로그인 + 결제창 (DB, 토스페이먼츠) | 허규현 | `feature/login-payment` |
| 3 | CSV 입력단 (더미 데이터, 정답 시나리오) | 김보겸 | `feature/csv-input` |
| 4 | 결과 출력단 (지표 계산식, 결과분석, OpenAI 연결) | 김성순 | `feature/part4-result-engine` |
| 5 | 대시보드 + CSS | 이두규 | `feature/dashboard` |

## 작업 규칙

1. `main`에 직접 올리지 않습니다.
2. 자기 브랜치에서 작업하고, 끝나면 Pull Request를 올립니다.
3. 합치기(merge)는 PM이 합니다.
4. 커밋 메시지는 무엇을 했는지 한 줄로 적습니다. 예: `로그인 화면 추가`
5. API 키, 비밀번호는 코드에 넣지 않습니다. 시크릿 키는 Supabase Edge Function Secret에 둡니다.
