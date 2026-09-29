"""로그인·회원가입 화면과 로그인 확인."""

import streamlit as st

from auth.client import ConfigError, get_client
from auth.service import get_current_user, get_profile, sign_in, sign_out, sign_up

_FLASH_KEY = "_auth_flash"


def _show_flash() -> None:
    """rerun 전에 남긴 안내 문구를 한 번만 보여준다."""
    flash = st.session_state.pop(_FLASH_KEY, None)
    if flash:
        kind, message = flash
        getattr(st, kind)(message)


def render_login_page() -> None:
    st.title("매출분석 툴")
    st.caption("주문 CSV를 올리고 매출이 어디서 줄었는지 확인하세요.")

    try:
        get_client()
    except ConfigError as err:
        st.error(str(err))
        return

    _show_flash()
    login_tab, signup_tab = st.tabs(["로그인", "회원가입"])

    with login_tab:
        with st.form("login_form", clear_on_submit=False):
            email = st.text_input("이메일", key="login_email")
            password = st.text_input("비밀번호", type="password", key="login_password")
            submitted = st.form_submit_button("로그인", type="primary", width="stretch")
        if submitted:
            with st.spinner("로그인 중..."):
                result = sign_in(email, password)
            if result.ok:
                st.rerun()
            else:
                st.error(result.message)

    with signup_tab:
        with st.form("signup_form", clear_on_submit=False):
            email = st.text_input("이메일", key="signup_email")
            password = st.text_input("비밀번호 (6자 이상)", type="password", key="signup_password")
            password_confirm = st.text_input("비밀번호 확인", type="password", key="signup_password_confirm")
            submitted = st.form_submit_button("회원가입", width="stretch")
        if submitted:
            with st.spinner("가입 처리 중..."):
                result = sign_up(email, password, password_confirm)
            if not result.ok:
                st.error(result.message)
            elif get_current_user() is not None:
                st.rerun()
            else:
                st.success(result.message)


def render_account_sidebar() -> None:
    user = get_current_user()
    if user is None:
        return
    with st.sidebar:
        st.markdown(f"**{user.email}**")
        try:
            profile = get_profile()
        except Exception:
            profile = None
        if profile:
            plan = "프로" if profile["plan"] == "pro" else "무료"
            st.caption(f"요금제: {plan} · 오늘 사용 {profile['daily_usage']}회")
        if st.button("로그아웃", width="stretch"):
            sign_out()
            st.session_state[_FLASH_KEY] = ("info", "로그아웃되었습니다.")
            st.rerun()


def require_login() -> None:
    """페이지 맨 위에서 호출. 로그인하지 않았으면 로그인 화면을 보여주고 멈춘다."""
    if get_current_user() is None:
        render_login_page()
        st.stop()
    render_account_sidebar()
