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

## 적용 방법
1. Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행
2. Authentication > Users에서 테스트 계정 2개 생성
3. `supabase/rls_test.sql` 상단의 `A_USER_ID`, `B_USER_ID`를 각 계정 UID로 바꾼 뒤 실행 (경고창에서 "Run without RLS" 선택)
4. 확인 후 `drop schema testing cascade;` 실행

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

## 남은 작업
- [ ] Streamlit 로그인 화면 (회원가입·로그인·로그아웃·상태 유지)
- [ ] 인터페이스 함수: `get_current_user()`, `require_login()`, `create_project()`, `save_dataset()`, `save_analysis_run()`, `can_use_analysis()`
- [ ] 앱에서 A/B 계정 권한 테스트 (A1~A4)
- [ ] 결제 가능 여부 확인: 테스트 결제 왕복
- [ ] 결제 본 구현과 테스트 (P1~P4)
