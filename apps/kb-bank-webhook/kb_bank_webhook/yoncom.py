from __future__ import annotations

from typing import Any

import requests

from .config import Settings
from .logs import RunLogger


class YoncomClient:
    def __init__(self, settings: Settings, logger: RunLogger) -> None:
        self.settings = settings
        self.logger = logger
        self.session = requests.Session()
        self.csrf_token = ""

    def authenticate(self, cycle_id: str) -> None:
        if self.settings.yoncom_session_cookie and self.settings.yoncom_csrf_token:
            self.session.cookies.set("yoncom_session", self.settings.yoncom_session_cookie)
            self.session.cookies.set("yoncom_csrf", self.settings.yoncom_csrf_token)
            self.csrf_token = self.settings.yoncom_csrf_token
            return

        if not self.settings.yoncom_admin_email or not self.settings.yoncom_admin_password:
            raise RuntimeError("set YONCOM_ADMIN_EMAIL/PASSWORD or YONCOM_SESSION_COOKIE/YONCOM_CSRF_TOKEN")

        url = f"{self.settings.yoncom_app_base_url}/api/auth/sign-in"
        body = {
            "email": self.settings.yoncom_admin_email,
            "password": self.settings.yoncom_admin_password,
        }
        response = self.session.post(
            url,
            json=body,
            headers={"origin": self.settings.yoncom_app_base_url},
            timeout=self.settings.dom_wait_seconds,
        )
        self.logger.log_http(cycle_id, "yoncom-sign-in", {
            "method": "POST",
            "url": url,
            "headers": {"origin": self.settings.yoncom_app_base_url},
            "json": body,
        }, response.status_code, response.text)
        response.raise_for_status()
        self.csrf_token = self.session.cookies.get("yoncom_csrf", "")
        if not self.csrf_token:
            raise RuntimeError("Yoncom CSRF cookie missing after sign-in")

    def post_deposit(self, payload: dict[str, Any], cycle_id: str) -> dict[str, Any]:
        url = f"{self.settings.yoncom_app_base_url}/api/admin/deposit"
        headers = {
            "origin": self.settings.yoncom_app_base_url,
            "x-csrf-token": self.csrf_token,
            "idempotency-key": str(payload["dedupeKey"])[:128],
        }
        response = self.session.post(
            url,
            json=payload,
            headers=headers,
            timeout=self.settings.dom_wait_seconds,
        )
        self.logger.log_http(cycle_id, "yoncom-deposit", {
            "method": "POST",
            "url": url,
            "headers": headers,
            "json": payload,
        }, response.status_code, response.text)
        response.raise_for_status()
        return response.json() if response.text else {}
