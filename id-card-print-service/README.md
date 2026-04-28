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

##### start server
uv run uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000


To save seeder
#############
sqlite3 print.db < src/app/sample-data.sql


########
build image
############

docker buildx build --platform linux/amd64,linux/arm64 -t kacytunde/id-card-print-service:3.5 --push .

Last working version 0.8 api 
UI 0.8

#########
build UI image
#########

docker buildx build --platform linux/amd64,linux/arm64 -t kacytunde/nrs-cardmanager-ui:3.5 --build-arg VITE_API_URL=/api --push .


