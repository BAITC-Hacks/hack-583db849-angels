FROM python:3.13-slim

WORKDIR /repo
COPY services/ml/requirements.txt services/ml/requirements.txt
RUN pip install --no-cache-dir -r services/ml/requirements.txt
COPY docs/contracts/ml.md docs/contracts/ml.md
COPY services/ml services/ml

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import os,urllib.request; request=urllib.request.Request('http://127.0.0.1:8000/internal/v1/health',headers={'X-Internal-Token':os.environ['ML_INTERNAL_TOKEN']}); urllib.request.urlopen(request,timeout=2).read()" || exit 1
CMD ["uvicorn", "services.ml.main:app", "--host", "0.0.0.0", "--port", "8000"]
