# ==============================================================================
# Dockerfile — Backend & Poller "Apuração 2º Turno" (Eleições 2026)
# Pronto para deploy em Render, Fly.io ou Railway
# ==============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Sao_Paulo \
    PORT=8000

WORKDIR /app

# Instala dependências do sistema mínimas (ca-certificates e tzdata para horário de Brasília)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python do backend
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia código do backend, cache do 1º turno e snapshots/avatares estáticos iniciais
COPY backend ./backend
COPY public/snapshots ./public/snapshots
COPY public/avatars ./public/avatars
COPY public/geo ./public/geo

# Cria diretório de dados SQLite persistente
RUN mkdir -p /app/backend/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
