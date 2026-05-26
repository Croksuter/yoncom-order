from __future__ import annotations

import re
from datetime import datetime
from html.parser import HTMLParser

from .models import Transaction


def parse_dom_rows(rows: list[dict[str, str]]) -> list[Transaction]:
    transactions: list[Transaction] = []
    for row in rows:
        occurred_at_text = field(row, "거래일시")
        summary = field(row, "적요")
        counterparty = field(row, "보낸분/받는분") or field(row, "counterpartyTitle")
        withdrawal = parse_money(field(row, "출금액(원)"))
        deposit = parse_money(field(row, "입금액(원)"))
        balance = parse_money(field(row, "잔액(원)"))
        transfer_memo = field(row, "송금메모") or field(row, "transferMemoTitle")
        branch = field(row, "거래점")

        direction = "입금" if deposit > 0 else "출금" if withdrawal > 0 else ""
        amount = deposit if deposit > 0 else withdrawal
        if not occurred_at_text or not direction or amount <= 0:
            continue

        raw_text = " ".join(
            part for part in [
                occurred_at_text,
                direction,
                counterparty,
                summary,
                f"{amount:,}",
                f"잔액 {balance:,}",
                f"메모 {transfer_memo}" if transfer_memo else "",
                f"거래점 {branch}" if branch else "",
            ] if part
        )
        transactions.append(Transaction(
            occurred_at=parse_kb_date(occurred_at_text),
            summary=summary,
            memo=counterparty or summary or transfer_memo,
            direction=direction,
            amount=amount,
            balance=balance,
            transfer_memo=transfer_memo,
            branch=branch,
            raw_text=raw_text,
        ))
    return transactions


def extract_rows_from_html(html: str) -> list[dict[str, str]]:
    parser = TransactionTableParser()
    parser.feed(html)
    return parser.rows


def field(row: dict[str, str], name: str) -> str:
    normalized = normalize_text(name)
    if normalized in row:
        return normalize_text(row[normalized])
    for key, value in row.items():
        if normalize_text(key) == normalized:
            return normalize_text(value)
    return ""


def parse_money(value: str) -> int:
    normalized = re.sub(r"[^0-9-]", "", value or "")
    return int(normalized) if normalized else 0


def parse_kb_date(value: str) -> datetime:
    match = re.match(r"^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$", value)
    if not match:
        raise ValueError(f"unsupported KB date: {value}")
    year, month, day, hour, minute, second = (int(part) for part in match.groups())
    return datetime(year, month, day, hour, minute, second)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


class TransactionTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_target_table = False
        self.table_depth = 0
        self.headers: list[str] = []
        self.rows: list[dict[str, str]] = []
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None
        self.current_cell_tag = ""
        self.in_thead = False
        self.in_tbody = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key: value or "" for key, value in attrs}
        if tag == "table" and "거래상세내역" in attr_map.get("summary", ""):
            self.in_target_table = True
            self.table_depth = 1
            return

        if not self.in_target_table:
            return

        if tag == "table":
            self.table_depth += 1
        elif tag == "thead":
            self.in_thead = True
        elif tag == "tbody":
            self.in_tbody = True
        elif tag == "tr":
            self.current_row = []
        elif tag in {"th", "td"}:
            self.current_cell = []
            self.current_cell_tag = tag

    def handle_endtag(self, tag: str) -> None:
        if not self.in_target_table:
            return

        if tag == "table":
            self.table_depth -= 1
            if self.table_depth <= 0:
                self.in_target_table = False
            return
        if tag == "thead":
            self.in_thead = False
            return
        if tag == "tbody":
            self.in_tbody = False
            return
        if tag in {"th", "td"} and self.current_cell is not None:
            value = normalize_text("".join(self.current_cell))
            if self.current_cell_tag == "th":
                self.headers.append(value)
            elif self.current_row is not None:
                self.current_row.append(value)
            self.current_cell = None
            return
        if tag == "tr" and self.current_row is not None:
            if self.current_row and self.headers:
                row = {
                    self.headers[index]: value
                    for index, value in enumerate(self.current_row)
                    if index < len(self.headers)
                }
                self.rows.append(row)
            self.current_row = None

    def handle_data(self, data: str) -> None:
        if self.in_target_table and self.current_cell is not None:
            self.current_cell.append(data)
