from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Transaction:
    occurred_at: datetime
    summary: str
    memo: str
    direction: str
    amount: int
    balance: int
    transfer_memo: str
    branch: str
    raw_text: str


def deposit_payload(transaction: Transaction) -> dict:
    if transaction.direction != "입금" or transaction.amount <= 0:
        raise ValueError("only positive deposit transactions can be posted")

    timestamp = int(transaction.occurred_at.timestamp() * 1000)
    digest = hashlib.sha256(
        "|".join([
            "KB",
            str(timestamp),
            str(transaction.amount),
            transaction.memo,
            transaction.raw_text,
        ]).encode("utf-8")
    ).hexdigest()
    return {
        "amount": transaction.amount,
        "bank": "KB",
        "timestamp": timestamp,
        "name": transaction.memo or "UNKNOWN",
        "rawText": transaction.raw_text[:500],
        "source": "SELENIUM",
        "dedupeKey": f"KB:{digest}",
    }
