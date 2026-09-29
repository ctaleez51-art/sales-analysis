"""앱 시작점. 실행: streamlit run app.py

로그인 이후 화면은 3·4·5번 파트가 채운다.
"""

import streamlit as st

from auth import get_current_user, require_login

st.set_page_config(page_title="매출분석 툴", page_icon="📊", layout="wide")

require_login()

user = get_current_user()
st.title("매출분석 툴")
st.success(f"{user.email} 님, 로그인되었습니다.")
st.info("CSV 업로드와 분석 화면은 준비 중입니다.")
