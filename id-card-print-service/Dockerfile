FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./

RUN python - <<'PY'
import pathlib
import tomllib

with open("pyproject.toml", "rb") as handle:
    deps = tomllib.load(handle)["project"]["dependencies"]

pathlib.Path("requirements.txt").write_text("\n".join(deps))
PY

RUN pip install --no-cache-dir -r requirements.txt \
    && rm requirements.txt

COPY src ./src
COPY assets ./assets
COPY update_prefix.py ./

EXPOSE 8000

CMD ["sh", "-c", "python update_prefix.py && uvicorn src.app.main:app --host 0.0.0.0 --port 8000"]
