# =============================================================================
# EcoQuant Backend - Production Dockerfile
# Multi-stage build for optimized image size
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
  FROM python:3.11-slim as builder

  WORKDIR /app
  
  # 1. Install build dependencies
  RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      tar \
      && rm -rf /var/lib/apt/lists/*
  
  # 2. Install TA-Lib C Library (수동 파일 복사 방식)
  # 인터넷 다운로드(wget) 대신 로컬 파일을 복사해서 씁니다.
  COPY ta-lib-0.4.0-src.tar.gz .
  
  RUN tar -xvzf ta-lib-0.4.0-src.tar.gz && \
      cd ta-lib && \
      ./configure --prefix=/usr && \
      make && \
      make install && \
      cd .. && \
      rm -rf ta-lib ta-lib-0.4.0-src.tar.gz
  
  # Create virtual environment
  RUN python -m venv /opt/venv
  ENV PATH="/opt/venv/bin:$PATH"
  
  # Install Python dependencies
  COPY requirements.txt .
  RUN pip install --no-cache-dir --upgrade pip && \
    # 1. NumPy 1.x 버전 설치
    pip install --no-cache-dir "numpy<2.0" && \
    # 2. TA-Lib 설치 (CFLAGS 추가: 포인터 타입 에러를 무시하도록 설정)
    CFLAGS="-Wno-error=incompatible-pointer-types" \
    pip install --no-cache-dir --no-build-isolation ta-lib==0.4.28 && \
    # 3. 나머지 라이브러리 설치
    pip install --no-cache-dir -r requirements.txt
  
  # -----------------------------------------------------------------------------
  # Stage 2: Production
  # -----------------------------------------------------------------------------
  FROM python:3.11-slim as production
  
  WORKDIR /app
  
  # Install runtime dependencies only
  RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 \
      && rm -rf /var/lib/apt/lists/* \
      && apt-get clean
  
  # 3. Copy compiled TA-Lib C libraries from builder (이것도 추가!)
  # 파이썬 패키지가 실행될 때 시스템 라이브러리를 찾으므로 복사해와야 합니다.
  COPY --from=builder /usr/lib/libta_lib* /usr/lib/
  
  # Copy virtual environment from builder
  COPY --from=builder /opt/venv /opt/venv
  ENV PATH="/opt/venv/bin:$PATH"
  
  # Create non-root user for security
  RUN groupadd -r ecoquant && useradd -r -g ecoquant ecoquant
  
  # Copy application code
  COPY --chown=ecoquant:ecoquant ./app /app/app
  
  # Set environment variables
  ENV PYTHONDONTWRITEBYTECODE=1 \
      PYTHONUNBUFFERED=1 \
      PYTHONPATH=/app \
      LD_LIBRARY_PATH="/usr/lib:$LD_LIBRARY_PATH"
  
  # Switch to non-root user
  USER ecoquant
  
  # Expose port
  EXPOSE 8000
  
  # Health check (api/health 경로가 없다면 / 로 변경하거나 해당 엔드포인트 구현 필요)
  HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
      CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1
  
  # Run the application
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]