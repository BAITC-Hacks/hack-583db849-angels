FROM python:3.13-slim

WORKDIR /repo/context
COPY . .

RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    else \
      pip install --no-cache-dir -r services/ml/requirements.txt; \
    fi

ENV PYTHONPATH=/repo/context:/repo/context/services/ml

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/internal/v1/health',timeout=2).read()" || exit 1

CMD ["sh", "-c", "if [ -f main.py ]; then exec uvicorn main:app --host 0.0.0.0 --port 8000; else exec uvicorn services.ml.main:app --host 0.0.0.0 --port 8000; fi"]
