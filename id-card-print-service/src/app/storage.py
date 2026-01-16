from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]  # project root
DATA_DIR = BASE_DIR / "data"
JOBS_DIR = DATA_DIR / "jobs"

ASSETS_DIR = BASE_DIR / "assets"

def ensure_dirs():
    JOBS_DIR.mkdir(parents=True, exist_ok=True)

def job_dir(job_id: str) -> Path:
    d = JOBS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d
