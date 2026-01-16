# ID Card Print Service (Local)

## Requirements
- Python 3.10+
- `uv` installed

## Setup
From the project root:

```bash
uv venv
source .venv/bin/activate  # macOS/Linux
# OR on Windows PowerShell:
# .\.venv\Scripts\Activate.ps1

uv pip install -r <(python -c "import tomllib;print('\n'.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")

uv run uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000
