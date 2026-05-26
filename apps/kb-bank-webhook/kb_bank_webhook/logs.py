from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from selenium.webdriver.remote.webdriver import WebDriver

from .config import Settings
from .models import Transaction, deposit_payload


class RunLogger:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.counter = 0

    def next_cycle_id(self) -> str:
        self.counter += 1
        now = datetime.now(UTC)
        stamp = f"{now.strftime('%Y-%m-%dT%H-%M-%S')}-{now.microsecond // 1000:03d}"
        return f"{stamp}Z-{self.counter:04d}"

    def write_json(self, cycle_id: str, name: str, data: Any) -> None:
        self.settings.log_dir.mkdir(parents=True, exist_ok=True)
        path = self.settings.log_dir / f"{cycle_id}-{name}.json"
        path.write_text(json.dumps(envelope(cycle_id, data), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def write_text(self, cycle_id: str, name: str, data: str) -> None:
        self.settings.log_dir.mkdir(parents=True, exist_ok=True)
        path = self.settings.log_dir / f"{cycle_id}-{name}"
        path.write_text(data, encoding="utf-8")

    def log_dom_cycle(
        self,
        cycle_id: str,
        driver: WebDriver,
        rows: list[dict[str, str]],
        transactions: list[Transaction],
    ) -> None:
        if self.settings.save_dom:
            self.write_text(cycle_id, "kb-dom.html", driver.page_source)
        self.write_json(cycle_id, "kb-rows", {"rows": rows})
        self.write_json(cycle_id, "parse-summary", {
            "total": len(transactions),
            "deposits": sum(1 for transaction in transactions if transaction.direction == "입금"),
            "transactions": [transaction_summary(transaction) for transaction in transactions],
        })

    def log_http(
        self,
        cycle_id: str,
        scope: str,
        request: dict[str, Any],
        status_code: int,
        response_text: str,
    ) -> None:
        safe_request = dict(request)
        headers = dict(safe_request.get("headers") or {})
        for key in list(headers):
            if key.lower() in {"cookie", "authorization", "x-csrf-token"}:
                headers[key] = "[REDACTED]"
        safe_request["headers"] = headers
        if scope == "yoncom-sign-in" and isinstance(safe_request.get("json"), dict):
            safe_request["json"] = {**safe_request["json"], "password": "[REDACTED]"}
        self.write_json(cycle_id, f"{scope}-request", safe_request)
        self.write_json(cycle_id, f"{scope}-response", {
            "status": status_code,
            "bodyFile": f"{cycle_id}-{scope}-response-body.txt",
            "bodyBytes": len(response_text.encode("utf-8")),
        })
        self.write_text(cycle_id, f"{scope}-response-body.txt", response_text)


def transaction_summary(transaction: Transaction) -> dict[str, Any]:
    return {
        "occurredAt": transaction.occurred_at.isoformat(),
        "summary": transaction.summary,
        "memo": transaction.memo,
        "direction": transaction.direction,
        "amount": transaction.amount,
        "balance": transaction.balance,
        "transferMemo": transaction.transfer_memo,
        "branch": transaction.branch,
        "rawText": transaction.raw_text,
        "dedupeKey": (
            deposit_payload(transaction)["dedupeKey"]
            if transaction.direction == "입금" and transaction.amount > 0
            else None
        ),
    }


def envelope(cycle_id: str, data: Any) -> dict[str, Any]:
    metadata = {
        "loggedAt": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "cycleId": cycle_id,
    }
    if isinstance(data, dict):
        return {**metadata, **data}
    return {**metadata, "data": data}
