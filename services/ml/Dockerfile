FROM python:3.13-slim

WORKDIR /repo/context

ARG LANGUAGETOOL_SHA256=53600506b399bb5ffe1e4c8dec794fd378212f14aaf38ccef9b6f89314d11631
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl openjdk-21-jre-headless unzip && \
    curl --fail --location --silent --show-error \
      https://languagetool.org/download/LanguageTool-6.6.zip \
      --output /tmp/LanguageTool-6.6.zip && \
    echo "${LANGUAGETOOL_SHA256}  /tmp/LanguageTool-6.6.zip" | sha256sum -c - && \
    mkdir -p /opt/languagetool && \
    unzip -q /tmp/LanguageTool-6.6.zip -d /opt/languagetool && \
    rm /tmp/LanguageTool-6.6.zip && \
    apt-get purge -y --auto-remove curl unzip && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    else \
      pip install --no-cache-dir -r services/ml/requirements.txt; \
    fi

RUN if [ -f stub_data/embedding-model.json ]; then \
      python scripts/download_embedding_model.py \
        stub_data/embedding-model.json /opt/models/all-MiniLM-L6-v2; \
    else \
      python services/ml/scripts/download_embedding_model.py \
        config/embedding-model.json /opt/models/all-MiniLM-L6-v2; \
    fi

ENV PYTHONPATH=/repo/context:/repo/context/services/ml \
    M2_EMBEDDING_MODEL_PATH=/opt/models/all-MiniLM-L6-v2 \
    M3_LANGUAGETOOL_DIR=/opt/languagetool/LanguageTool-6.6 \
    UPLOADS_DIR=/repo/context/fixtures/audio \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/internal/v1/health',timeout=2).read()" || exit 1

CMD ["sh", "-c", "if [ -f main.py ]; then exec uvicorn main:app --host 0.0.0.0 --port 8000; else exec uvicorn services.ml.main:app --host 0.0.0.0 --port 8000; fi"]
