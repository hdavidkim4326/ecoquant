# test_phase4.py
import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

# 1. 로그인 (토큰 받기)
# (참고: DB 초기화했으면 회원가입 먼저 필요할 수 있음. Swagger UI에서 가입 먼저 하세요!)
# 여기서는 토큰 없이 요청할 수 있게 엔드포인트가 열려있다고 가정하거나,
# Swagger UI를 통해 직접 클릭해보는 것을 추천합니다.

print("👉 1. 뉴스 수집 및 분석 요청 (AAPL)")
# (주의: 실제로는 로그인이 필요하므로, 이 부분은 Swagger UI에서 /api/v1/news/collect 실행을 권장)
# 만약 인증을 껐다면: requests.post(f"{BASE_URL}/news/fetch/AAPL")

print("👉 2. 백테스팅 요청 (Sentiment Strategy)")
payload = {
    "strategy_type": "sentiment_sma",
    "symbols": ["AAPL"],
    "start_date": "2024-01-01",
    "end_date": "2024-02-01",
    "initial_capital": 10000,
    "strategy_params": {
        "fast_period": 5,
        "slow_period": 10,
        "buy_threshold": 0.1,  # 점수가 0.1 이상일 때만 매수
        "panic_threshold": -0.5
    }
}
# 실제 실행은 Swagger UI를 추천합니다.