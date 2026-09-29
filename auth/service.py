"""로그인·회원가입·로그아웃과 사용자 정보 조회.

다른 파트는 get_current_user(), get_profile(), consume_analysis_quota()만 쓰면 된다.
"""

import re
from dataclasses import dataclass

import httpx
import streamlit as st
from supabase_auth.errors import AuthApiError, AuthError

from auth.client import get_client, reset_client

_USER_KEY = "auth_user"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 6  # Supabase 기본 최소 길이

# Supabase 오류 코드 → 사용자 안내 문구
_ERROR_MESSAGES = {
    "invalid_credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "email_not_confirmed": "이메일 인증이 아직 완료되지 않았습니다. 받은 메일의 링크를 눌러 주세요.",
    "user_already_exists": "이미 가입된 이메일입니다. 로그인해 주세요.",
    "email_exists": "이미 가입된 이메일입니다. 로그인해 주세요.",
    "weak_password": f"비밀번호가 너무 약합니다. {MIN_PASSWORD_LENGTH}자 이상으로 입력해 주세요.",
    "email_address_invalid": "사용할 수 없는 이메일 주소입니다.",
    "over_email_send_rate_limit": "인증 메일 발송 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.",
    "over_request_rate_limit": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    "signup_disabled": "현재 회원가입이 비활성화되어 있습니다.",
}
_DEFAULT_ERROR = "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
_NETWORK_ERROR = "로그인 서버에 연결할 수 없습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요."


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str


@dataclass(frozen=True)
class AuthResult:
    ok: bool
    message: str


def _error_message(err: AuthError) -> str:
    code = getattr(err, "code", None)
    return _ERROR_MESSAGES.get(code, _DEFAULT_ERROR)


def validate_credentials(email: str, password: str) -> str | None:
    """입력값 검사. 문제가 있으면 안내 문구, 없으면 None."""
    if not email or not password:
        return "이메일과 비밀번호를 모두 입력해 주세요."
    if not _EMAIL_RE.match(email):
        return "이메일 형식이 올바르지 않습니다."
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"비밀번호는 {MIN_PASSWORD_LENGTH}자 이상이어야 합니다."
    return None


def sign_in(email: str, password: str) -> AuthResult:
    email = email.strip().lower()
    problem = validate_credentials(email, password)
    if problem:
        return AuthResult(False, problem)
    try:
        res = get_client().auth.sign_in_with_password({"email": email, "password": password})
    except AuthApiError as err:
        return AuthResult(False, _error_message(err))
    except AuthError:
        return AuthResult(False, _DEFAULT_ERROR)
    except httpx.HTTPError:
        return AuthResult(False, _NETWORK_ERROR)

    st.session_state[_USER_KEY] = CurrentUser(id=res.user.id, email=res.user.email)
    return AuthResult(True, "로그인되었습니다.")


def sign_up(email: str, password: str, password_confirm: str) -> AuthResult:
    email = email.strip().lower()
    problem = validate_credentials(email, password)
    if problem:
        return AuthResult(False, problem)
    if password != password_confirm:
        return AuthResult(False, "비밀번호 확인이 일치하지 않습니다.")
    try:
        res = get_client().auth.sign_up({"email": email, "password": password})
    except AuthApiError as err:
        return AuthResult(False, _error_message(err))
    except AuthError:
        return AuthResult(False, _DEFAULT_ERROR)
    except httpx.HTTPError:
        return AuthResult(False, _NETWORK_ERROR)

    # Supabase에서 "Confirm email"이 켜져 있으면 세션 없이 사용자만 만들어진다
    if res.session is None:
        return AuthResult(True, "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.")

    st.session_state[_USER_KEY] = CurrentUser(id=res.user.id, email=res.user.email)
    return AuthResult(True, "가입이 완료되었습니다.")


def sign_out() -> None:
    try:
        get_client().auth.sign_out()
    except Exception:
        # 서버 쪽 로그아웃이 실패해도 이 세션의 로그인 정보는 반드시 지운다
        pass
    st.session_state.pop(_USER_KEY, None)
    reset_client()


def get_current_user() -> CurrentUser | None:
    """로그인한 사용자. 로그인하지 않았으면 None."""
    return st.session_state.get(_USER_KEY)


def get_profile() -> dict | None:
    """현재 사용자의 요금제와 오늘 사용 횟수. RLS로 본인 행만 조회된다."""
    user = get_current_user()
    if user is None:
        return None
    res = (
        get_client()
        .table("profiles")
        .select("plan, daily_usage, usage_date")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def consume_analysis_quota() -> bool:
    """분석 실행 직전에 호출. 한도 안이면 사용량 +1 하고 True, 초과면 False."""
    if get_current_user() is None:
        return False
    return bool(get_client().rpc("consume_analysis_quota").execute().data)
