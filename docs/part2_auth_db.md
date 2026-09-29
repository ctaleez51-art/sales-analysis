# 2번 파트: 로그인 · DB · 권한 · 결제

담당: 허규현

## 구조
- 메인 앱: Streamlit
- 로그인·DB·파일 저장: Supabase (Auth, PostgreSQL + RLS, Storage)
- 결제: 토스페이먼츠 **테스트 모드**. 공식 예제 기반의 별도 정적 결제 페이지에서 결제창을 띄우고, 승인과 금액 검증은 Streamlit 서버에서 처리

## 파일
| 파일 | 내용 |
|---|---|
| `supabase/schema.sql` | 테이블, RLS 정책, 사용량 한도 함수(`consume_analysis_quota`), CSV 저장 버킷 |
| `supabase/rls_test.sql` | 운영자 A/B 권한 테스트 (SQL Editor에서 실행) |
| `docs/test_results/rls_test_2026-09-29.csv` | 권한 테스트 결과 (10/10 통과) |
| `auth/` | 로그인 화면과 로그인·권한 함수 |
| `app.py` | 앱 시작점 (로그인 이후 화면은 3·4·5번 파트가 채움) |

## 적용 방법
1. Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행
2. Authentication > Users에서 테스트 계정 2개 생성
3. `supabase/rls_test.sql` 상단의 `A_USER_ID`, `B_USER_ID`를 각 계정 UID로 바꾼 뒤 실행 (경고창에서 "Run without RLS" 선택)
4. 확인 후 `drop schema testing cascade;` 실행

## 앱 실행 방법
```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp .env.example .env  → 값 채우기
streamlit run app.py
```
키는 `.env` 또는 `.streamlit/secrets.toml` 중 한 곳에 넣으면 돼요. 배포(Streamlit Cloud)에서는 앱 설정의 Secrets에 넣어요.

## 다른 파트에서 쓰는 방법
```python
from auth import require_login, get_current_user, consume_analysis_quota, get_client

require_login()               # 페이지 맨 위. 로그인 안 했으면 로그인 화면을 보여주고 멈춤
user = get_current_user()     # CurrentUser(id, email)

if not consume_analysis_quota():      # 분석 실행 직전에 1회 호출
    st.warning("오늘 사용 한도를 모두 썼습니다.")
    st.stop()

get_client().table("projects").select("*").execute()   # 로그인 사용자 권한(RLS)으로 DB 조회
```
- `get_client()`는 **사용자 세션마다 따로** 만들어진 클라이언트예요. `@st.cache_resource`에 넣지 마세요. 다른 사용자의 로그인이 섞여요.

## 알려진 제약
- **브라우저를 새로고침하면 로그아웃돼요.** 로그인 정보를 Streamlit 세션(`st.session_state`)에만 두기 때문이에요. 앱 안에서 화면을 이동하는 동안에는 유지돼요. 쿠키 저장은 추후 개선 과제로 둬요.
- Supabase에서 **Confirm email**이 켜져 있으면 가입 후 메일 인증을 해야 로그인돼요. 무료 요금제는 인증 메일 발송 수가 적어서, 개발 중에는 Authentication > Sign In / Providers > Email에서 끄거나 대시보드의 Add user로 계정을 만드는 걸 추천해요.

## 키 관리
| 키 | 용도 | 위치 |
|---|---|---|
| Supabase URL, anon 키 | 로그인 사용자 요청 (RLS 적용) | `.streamlit/secrets.toml` |
| Supabase service_role 키 | 결제 승인 후 요금제 변경 (RLS 우회) | `.streamlit/secrets.toml` |
| 토스 클라이언트 키 | 결제창 호출 (공개 가능) | 결제 페이지 |
| 토스 시크릿 키 | 결제 승인 API | `.streamlit/secrets.toml` |

`secrets.toml`은 `.gitignore`에 포함되어 있어요. 저장소에 절대 커밋하지 않기.

## 테스트 결과
| 날짜 | 테스트 | 결과 | 증거 |
|---|---|---|---|
| 2026-09-29 | DB 권한(RLS) 10개 항목 | 10/10 통과 | `docs/test_results/rls_test_2026-09-29.csv` |
| 2026-09-29 | 로그인 화면 입력 검사 (로컬, 가짜 설정) | 통과: 키 없음 안내, 빈 입력, 이메일 형식, 비밀번호 확인 불일치, 서버 연결 실패 안내 | 로컬 실행 확인 |

## 남은 작업
- [x] Streamlit 로그인 화면 (회원가입·로그인·로그아웃)
- [x] 인터페이스 함수: `get_current_user()`, `require_login()`, `get_profile()`, `consume_analysis_quota()`, `get_client()`
- [ ] 실제 Supabase 키로 로그인·로그아웃 확인
- [ ] 인터페이스 함수: `create_project()`, `save_dataset()`, `save_analysis_run()` (3·4번 파트와 데이터 형식 합의 후)
- [ ] 앱에서 A/B 계정 권한 테스트 (A1~A4)
- [ ] 결제 가능 여부 확인: 테스트 결제 왕복
- [ ] 결제 본 구현과 테스트 (P1~P4)
