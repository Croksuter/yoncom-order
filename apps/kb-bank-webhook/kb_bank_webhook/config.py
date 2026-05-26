from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_dir: Path
    kb_login_url: str
    poll_interval_seconds: int
    dom_wait_seconds: int
    dry_run: bool
    state_file: Path
    log_dir: Path
    save_dom: bool
    chrome_binary: str
    chrome_user_data_dir: Path
    chrome_profile_directory: str
    chrome_detach: bool
    chrome_headless: bool
    chrome_remote_debugging_port: int
    chrome_debugger_address: str
    yoncom_app_base_url: str
    yoncom_admin_email: str
    yoncom_admin_password: str
    yoncom_session_cookie: str
    yoncom_csrf_token: str


def load_env_file(path: str | Path | None) -> None:
    if not path:
        return
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def load_settings() -> Settings:
    app_dir = Path(__file__).resolve().parents[1]

    def resolve_app_path(name: str, fallback: str) -> Path:
        raw = env(name, fallback)
        path = Path(raw)
        return path if path.is_absolute() else app_dir / path

    return Settings(
        app_dir=app_dir,
        kb_login_url=env("KB_LOGIN_URL", "https://obank.kbstar.com/quics?page=C055068&QSL=F"),
        poll_interval_seconds=env_int("KB_POLL_INTERVAL_SECONDS", 30),
        dom_wait_seconds=env_int("KB_DOM_WAIT_SECONDS", 20),
        dry_run=env_bool("KB_DRY_RUN", True),
        state_file=resolve_app_path("KB_STATE_FILE", ".state/sent-transactions.json"),
        log_dir=resolve_app_path("KB_LOG_DIR", ".logs"),
        save_dom=env_bool("KB_SAVE_DOM", True),
        chrome_binary=env("KB_CHROME_BIN", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        chrome_user_data_dir=resolve_app_path("KB_CHROME_USER_DATA_DIR", ".chrome-profile"),
        chrome_profile_directory=env("KB_CHROME_PROFILE_DIRECTORY", "Default"),
        chrome_detach=env_bool("KB_CHROME_DETACH", True),
        chrome_headless=env_bool("KB_CHROME_HEADLESS", False),
        chrome_remote_debugging_port=env_int("KB_CHROME_REMOTE_DEBUGGING_PORT", 9222),
        chrome_debugger_address=env("KB_CHROME_DEBUGGER_ADDRESS", ""),
        yoncom_app_base_url=env("YONCOM_APP_BASE_URL", "http://localhost:3000").rstrip("/"),
        yoncom_admin_email=env("YONCOM_ADMIN_EMAIL", ""),
        yoncom_admin_password=env("YONCOM_ADMIN_PASSWORD", ""),
        yoncom_session_cookie=env("YONCOM_SESSION_COOKIE", ""),
        yoncom_csrf_token=env("YONCOM_CSRF_TOKEN", ""),
    )


def env(name: str, fallback: str) -> str:
    return os.environ.get(name, fallback).strip()


def env_int(name: str, fallback: int) -> int:
    value = env(name, "")
    return int(value) if value else fallback


def env_bool(name: str, fallback: bool) -> bool:
    value = env(name, "")
    if not value:
        return fallback
    return value.lower() in {"1", "true", "yes", "y", "on"}
