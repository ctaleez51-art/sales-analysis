"""2번 파트: 로그인·권한.

다른 파트에서 쓰는 방법:

    from auth import require_login, get_current_user, consume_analysis_quota

    require_login()               # 페이지 맨 위. 로그인 안 했으면 로그인 화면 후 멈춤
    user = get_current_user()     # CurrentUser(id, email)
    if not consume_analysis_quota():
        st.warning("오늘 사용 한도를 모두 썼습니다.")
"""

from auth.client import ConfigError, get_client
from auth.service import (
    CurrentUser,
    consume_analysis_quota,
    get_current_user,
    get_profile,
    sign_out,
)
from auth.ui import require_login

__all__ = [
    "ConfigError",
    "CurrentUser",
    "consume_analysis_quota",
    "get_client",
    "get_current_user",
    "get_profile",
    "require_login",
    "sign_out",
]
