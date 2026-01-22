FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

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
COPY sample_data ./sample_data

EXPOSE 8000

CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
