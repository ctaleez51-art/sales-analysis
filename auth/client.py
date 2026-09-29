"""Supabase 클라이언트 생성.

Streamlit 서버 하나에 여러 사용자가 동시에 접속하므로, 로그인 상태를 담은
클라이언트는 반드시 사용자 세션(st.session_state)마다 따로 만든다.
@st.cache_resource 같은 전역 캐시에 두면 다른 사용자의 로그인이 섞인다.
"""

import os
from pathlib import Path

import streamlit as st
from supabase import Client, create_client

try:
    from dotenv import load_dotenv

    # 실행 위치와 상관없이 저장소 루트의 .env를 읽는다
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

_CLIENT_KEY = "_supabase_client"


class ConfigError(RuntimeError):
    """Supabase 접속 정보가 설정되지 않았을 때."""


def _read_setting(name: str) -> str | None:
    """st.secrets(.streamlit/secrets.toml) → 환경변수(.env) 순서로 읽는다."""
    try:
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        # secrets.toml 파일이 없으면 예외가 난다 → 환경변수로 넘어감
        pass
    return os.getenv(name)


def get_client() -> Client:
    """현재 사용자 세션 전용 Supabase 클라이언트 (anon 키, RLS 적용)."""
    if _CLIENT_KEY not in st.session_state:
        url = _read_setting("SUPABASE_URL")
        key = _read_setting("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ConfigError(
                "SUPABASE_URL, SUPABASE_ANON_KEY가 설정되지 않았습니다. "
                ".streamlit/secrets.toml 또는 .env를 확인하세요."
            )
        st.session_state[_CLIENT_KEY] = create_client(url, key)
    return st.session_state[_CLIENT_KEY]


def reset_client() -> None:
    """로그아웃 시 세션의 클라이언트를 버린다."""
    st.session_state.pop(_CLIENT_KEY, None)
