# 2번 파트: 로그인 · DB · 권한 · 결제

담당: 허규현

## 구조
- 화면: 팀 공통 방식인 HTML + JavaScript. 기존 파일을 고치지 않고 `part2/` 파일을 덧붙이는 방식
- 로그인·DB: Supabase (Auth, PostgreSQL + RLS). 브라우저에서 `supabase-js`로 직접 로그인
- 결제: 토스페이먼츠 **테스트 모드**. 결제창은 브라우저에서 호출, 승인과 금액 검증은 Supabase Edge Function `confirm-payment`에서 처리

> 처음에는 Streamlit으로 만들었으나, 4·5번 파트가 HTML/JS로 진행되어 2026-09-29에 HTML/JS로 옮겼어요. Supabase 스키마·RLS·테스트 결과는 그대로 사용해요.

## 파일
| 파일 | 내용 |
|---|---|
| `part2/auth.js` | 로그인·회원가입·로그아웃, 로그인 전 화면 가리기, 계정 표시, `window.Auth` |
| `part2/auth.css` | 로그인 화면·계정 표시 스타일 |
| `part2/config.js` | 팀 Supabase 접속 정보 (URL + publishable 키). GitHub Pages 배포를 위해 저장소에 올림 |
| `part2/config.example.js` | 접속 정보 양식 (다른 Supabase 프로젝트로 바꿀 때 참고) |
| `part2/payment.js` | 프로 플랜 결제 버튼, 토스 결제창 호출, 결제 후 돌아왔을 때 승인 요청 |
| `part2/login-demo.html` | 로그인·결제 확인용 페이지 |
| `supabase/schema.sql` | 테이블, RLS 정책, 사용량 한도 함수(`consume_analysis_quota`), CSV 저장 버킷 |
| `supabase/payment.sql` | 결제 주문 생성·완료·실패 함수 (여러 번 실행해도 안전) |
| `supabase/functions/confirm-payment/index.ts` | 결제 승인 Edge Function (로그인·주문 주인·금액·중복·요금제 확인 후 토스 승인) |
| `supabase/rls_test.sql` | 운영자 A/B 권한 테스트 (SQL Editor에서 실행) |
| `docs/test_results/rls_test_2026-09-29.csv` | 권한 테스트 결과 (10/10 통과) |

## 처음 설정 (한 번만)
1. Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행
2. Authentication > Sign In / Providers > Email > **Confirm email 끄기** → Save (아래 "알려진 제약" 참고)
3. `part2/config.js`에 URL과 publishable 키 입력 (팀 프로젝트 값은 이미 들어 있음)

### 결제 설정
1. SQL Editor에서 `supabase/payment.sql` 전체 실행 (붙여넣은 내용의 마지막 줄이 `grant ... to service_role;`인지 확인)
2. Edge Functions → Deploy a new function → Via Editor → 이름 `confirm-payment` → 기본 파일 `index.ts`의 **내용만** `supabase/functions/confirm-payment/index.ts`로 바꾸고 Deploy (파일을 지우면 "Entrypoint path does not exist" 오류)
3. 함수 Details에서 **Verify JWT 끄기** (로그인 확인은 함수 코드가 직접 함)
4. Edge Functions → Secrets → `TOSS_SECRET_KEY` = **API 개별 연동 키의 시크릿 키** (`test_sk_`)
5. `part2/config.js`의 `tossClientKey` = **API 개별 연동 키의 클라이언트 키** (`test_ck_`)

키를 헷갈리기 쉬워요: `g`가 들어간 결제위젯 키(`test_gck_`, `test_gsk_`)는 쓰지 않아요. `config.js`는 공개 파일이라 `sk`(시크릿) 키를 넣으면 안 돼요.

## 로컬에서 확인하기
저장소 폴더에서 정적 서버를 띄워요 (`file://`로 열면 로그인이 동작하지 않을 수 있어요).
```bash
python -m http.server 8510
```
브라우저에서 `http://localhost:8510/part2/login-demo.html` 열기

## 다른 페이지에 붙이는 방법 (예: part5/index.html)
`</body>` 바로 앞, **다른 스크립트보다 먼저** 넣어요.
```html
<link rel="stylesheet" href="../part2/auth.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../part2/config.js"></script>
<script src="../part2/auth.js"></script>
<!-- 결제 버튼도 붙이려면 -->
<script src="https://js.tosspayments.com/v2/standard"></script>
<script src="../part2/payment.js"></script>
```
- 로그인하지 않은 사람에게는 로그인 화면만 보이고, 로그인하면 원래 화면과 오른쪽 위 계정 표시(이메일 · 요금제 · 오늘 사용 횟수 · 로그아웃)가 나타나요.
- 로그인 상태는 브라우저(localStorage)에 저장되어 **새로고침해도 유지**돼요.

## 다른 파트에서 쓰는 것 (`window.Auth`)
```js
Auth.onReady((user) => { /* 로그인 확인 후 실행. user = { id, email } */ });

// 분석 실행 직전에 1회 호출 (무료: 하루 5회)
if (!(await Auth.consumeQuota())) { alert("오늘 사용 한도를 모두 썼습니다."); return; }

await Auth.getProfile();          // { plan, daily_usage, usage_date }
Auth.client.from("projects").select("*");   // 로그인 사용자 권한(RLS)으로 DB 조회
Auth.client.functions.invoke("analyze-shop", { body });  // Edge Function 호출 시 로그인 토큰 자동 첨부
```

## 알려진 제약
- **개발용 설정: Confirm email 끔.** Supabase 기본 메일 서버는 한 시간에 몇 통만 보낼 수 있어서, 켜 두면 가입 테스트 중 "인증 메일 발송 한도를 넘었습니다"가 나와요. 끈 상태에서는 가입 즉시 로그인되지만 **실제로 없는 이메일로도 가입할 수 있어요.** 실서비스로 전환하려면 이메일 인증을 켜고 외부 메일 서버(SMTP)를 연결해야 해요.
- 화면을 가리는 것은 1차 방어예요. 실제 데이터 보호는 Supabase RLS가 해요. Edge Function도 로그인 토큰을 검사해야 해요.
- 팀 전체가 **같은 Supabase 프로젝트**를 써야 로그인과 DB가 연결돼요. 2026-09-29 팀 결정: `joxyzphsqjwuyobkboqe`로 통일.
- 토스 테스트 모드에서 **신한카드를 고르면 실제 SOL Pay 앱 인증 화면**으로 넘어가요. 인증까지 진행해도 청구되지 않았지만(2026-09-29 확인), 시연 때는 실제 인증을 요구하지 않는 카드사를 고르는 게 좋아요.
- 결제 성공 후 사용 한도는 프로(무제한)로 바뀌어요. 결제 취소·환불 기능은 없어요.

## 키 관리
| 키 | 용도 | 위치 |
|---|---|---|
| Supabase URL, publishable 키 | 브라우저 로그인·DB 조회 (RLS 적용, 공개 가능한 키) | `part2/config.js` (저장소에 올림) |
| Supabase secret / service_role 키 | 결제 승인 후 요금제 변경 (RLS 우회) | Edge Function Secret만 |
| 토스 클라이언트 키 | 결제창 호출 (공개 가능) | 브라우저 |
| 토스 시크릿 키 | 결제 승인 API | Edge Function Secret만 |

secret·service_role 키와 토스 시크릿 키는 브라우저 코드와 저장소에 절대 넣지 않기.

## 테스트 결과
| 날짜 | 테스트 | 결과 | 증거 |
|---|---|---|---|
| 2026-09-29 | DB 권한(RLS) 10개 항목 | 10/10 통과 | `docs/test_results/rls_test_2026-09-29.csv` |
| 2026-09-29 | 로그인 전 화면 가리기 | 통과: 로그인 화면만 보이고 페이지 내용은 표시 안 됨 | 로컬 확인 (`login-demo.html`) |
| 2026-09-29 | 입력 검사 | 통과: 빈 입력, 이메일 형식, 비밀번호 확인 불일치 안내 | 로컬 확인 |
| 2026-09-29 | A2 없는 계정 로그인 | 통과: "이메일 또는 비밀번호가 올바르지 않습니다." | 로컬 확인 |
| 2026-09-29 | A1 테스트 계정 로그인 · 계정 표시 | 통과 | 로컬 확인 (사용자 직접) |
| 2026-09-29 | 새로고침 후 로그인 유지 | 통과 | 로컬 확인 (사용자 직접) |
| 2026-09-29 | A5 무료 한도: 5회 후 차단 | 통과 | 로컬 확인 (사용자 직접) |
| 2026-09-29 | 로그아웃 | 통과: 로그인 화면으로 돌아옴 | 로컬 확인 (사용자 직접) |
| 2026-09-29 | P1 테스트 결제 성공 | 통과: 주문 `done`, 승인 시각 기록, 요금제 pro, 결제 버튼 사라짐 | 로컬 확인 (사용자 결제, DB 조회) |
| 2026-09-29 | P2 결제창 닫기(취소) | 통과: 주문 `cancelled` (`PAY_PROCESS_CANCELED`), 요금제 그대로 | DB 조회 |
| 2026-09-29 | P3 금액 변조 (9,900원 주문에 100원 요청) | 통과: 거부, 주문 `failed` (`AMOUNT_MISMATCH`), 같은 주문 재시도도 거부, 토스 호출 안 함 | Edge Function 직접 호출 |
| 2026-09-29 | 남의 주문·없는 주문 승인 요청 | 통과: "주문을 찾을 수 없습니다." (404) | Edge Function 직접 호출 |
| 2026-09-29 | P4 완료된 결제 재승인 요청 | 통과: "이미 처리된 결제입니다."만 응답, 승인 시각 변화 없음. 다른 결제 키는 거부 (409) | Edge Function 직접 호출 |
| 2026-09-29 | 로그인 없이 승인 요청 | 통과: "로그인이 필요합니다." (401) | curl |
| 2026-09-29 | 이미 프로인 사용자의 재결제 (버그 수정 후) | 통과: 주문 생성 거부(`already on plan`), 기존 주문 승인도 거부 (`ALREADY_ON_PLAN`, 409) | 로컬 확인 |

### 발견하고 고친 문제
- **같은 계정의 프로 결제 2회 (2026-09-29):** 프로가 되면 결제 버튼을 화면에서만 숨겨서, 무료일 때 열어 둔 다른 탭에서 한 번 더 결제됨(테스트라 청구 없음). → DB 함수(주문 생성)와 Edge Function(승인 직전) 두 곳에서 "이미 같은 요금제인지"를 검사하도록 수정하고 재테스트 통과.
- **설정 중 시크릿 키가 공개 파일(`config.js`)에 들어감 (2회):** 커밋 전에 형식 검사로 발견해 지움. 저장소에는 올라가지 않음. → 설명서에 키 구분표 추가.

## 남은 작업
- [x] DB 설계와 RLS 권한 규칙
- [x] 로그인·회원가입·로그아웃 (HTML/JS)
- [ ] 5번 대시보드(`part5/index.html`)에 붙이기: 5번 PR이 main에 합쳐진 뒤
- [ ] 앱에서 A/B 계정 권한 테스트 (A4): 프로젝트 저장 기능이 생긴 뒤
- [x] 결제: 결제창 + Edge Function 승인 + 테스트 (P1~P4)
