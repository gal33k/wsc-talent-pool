"""Config loader.

scoring.yaml and taxonomy.yaml are the single source of truth for every
tunable value in the pipeline. Cached via lru_cache so downstream modules
call these freely without re-reading the disk.
"""
from functools import lru_cache
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "output"


@lru_cache(maxsize=1)
def scoring() -> dict:
    return yaml.safe_load((CONFIG_DIR / "scoring.yaml").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def taxonomy() -> dict:
    return yaml.safe_load((CONFIG_DIR / "taxonomy.yaml").read_text(encoding="utf-8"))
