from __future__ import annotations

import argparse
import logging
import sys
import time

from selenium.common.exceptions import TimeoutException, WebDriverException

from .browser import create_driver
from .console import configure_logging
from .config import load_env_file, load_settings
from .dom import (
    click_query_button,
    extract_transaction_rows,
    wait_for_query_screen,
    wait_for_transaction_table_settled,
)
from .logs import RunLogger
from .models import Transaction, deposit_payload
from .parser import parse_dom_rows
from .state import StateStore
from .yoncom import YoncomClient

APP_LOG = logging.getLogger("kb-bank-webhook")


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    args = parse_args(argv or sys.argv[1:])
    load_env_file(args.env_file)
    settings = load_settings()
    dry_run = args.dry_run or settings.dry_run
    logger = RunLogger(settings)

    driver = create_driver(settings)
    if not settings.chrome_debugger_address:
        driver.get(settings.kb_login_url)

    APP_LOG.info("chrome ready | url=%s | dryRun=%s", settings.kb_login_url, dry_run)
    APP_LOG.info("manual step | log in and move to the KB account query screen")
    answer = input("KB query screen ready? Type 'y' to start DOM watcher: ")
    if answer.strip().lower() != "y":
        APP_LOG.info("aborted before watcher loop")
        return 1

    wait_for_query_screen(driver, settings.dom_wait_seconds)
    APP_LOG.info("query screen detected | selector=form[name='IBF'] button.btn-com.c2")
    yoncom = YoncomClient(settings, logger)
    if not dry_run:
        yoncom.authenticate(logger.next_cycle_id())
    state = StateStore(settings.state_file)
    initial_sync = True

    while True:
        cycle_id = logger.next_cycle_id()
        try:
            started_at = time.monotonic()
            result = run_cycle(driver, settings, logger, yoncom, state, dry_run, cycle_id, initial_sync)
            initial_sync = False
            APP_LOG.info(
                "cycle complete | cycle=%s | total=%s | deposits=%s | new=%s | mode=%s | skipped=%s | baseline=%s | elapsed=%.2fs",
                cycle_id,
                result["total"],
                result["deposits"],
                result["newDeposits"],
                "dry-run" if dry_run else "posted",
                result["skipped"],
                result["baselined"],
                time.monotonic() - started_at,
            )
            if result["total"] == 0:
                APP_LOG.warning("no transaction rows parsed | check that the KB query result table is visible")
        except (TimeoutException, WebDriverException, RuntimeError, ValueError) as error:
            APP_LOG.error("cycle failed | cycle=%s | error=%s", cycle_id, error)
            if args.once:
                return 1

        if args.once:
            APP_LOG.info("once mode enabled | exiting after one cycle")
            break
        time.sleep(settings.poll_interval_seconds)

    return 0


def run_cycle(
    driver,
    settings,
    logger: RunLogger,
    yoncom: YoncomClient,
    state: StateStore,
    dry_run: bool,
    cycle_id: str,
    initial_sync: bool = False,
) -> dict[str, int]:
    click_query_button(driver, settings.dom_wait_seconds)
    wait_for_transaction_table_settled(driver, settings.dom_wait_seconds)
    rows = extract_transaction_rows(driver)
    transactions = parse_dom_rows(rows)
    logger.log_dom_cycle(cycle_id, driver, rows, transactions)

    deposits = sorted(
        [transaction for transaction in transactions if transaction.direction == "입금" and transaction.amount > 0],
        key=lambda transaction: transaction.occurred_at,
    )
    new_deposits = 0
    skipped = 0
    baselined = 0
    for transaction in deposits:
        status = post_or_print_deposit(transaction, yoncom, state, dry_run, cycle_id, initial_sync)
        if status == "new":
            new_deposits += 1
        elif status == "baselined":
            baselined += 1
        else:
            skipped += 1

    return {
        "total": len(transactions),
        "deposits": len(deposits),
        "newDeposits": new_deposits,
        "skipped": skipped,
        "baselined": baselined,
    }


def post_or_print_deposit(
    transaction: Transaction,
    yoncom: YoncomClient,
    state: StateStore,
    dry_run: bool,
    cycle_id: str,
    initial_sync: bool = False,
) -> str:
    payload = deposit_payload(transaction)
    if state.has(payload["dedupeKey"]):
        log_deposit("skipped", transaction, payload)
        return "skipped"
    if initial_sync:
        log_deposit("baseline", transaction, payload)
        if dry_run:
            state.remember(payload["dedupeKey"])
        else:
            state.mark(payload["dedupeKey"])
        return "baselined"
    if dry_run:
        log_deposit("dry-run", transaction, payload)
        state.remember(payload["dedupeKey"])
    else:
        response = yoncom.post_deposit(payload, cycle_id)
        log_deposit("posted", transaction, payload, response)
        state.mark(payload["dedupeKey"])
    return "new"


def log_deposit(
    status: str,
    transaction: Transaction,
    payload: dict,
    response: dict | None = None,
) -> None:
    message = (
        "deposit %-8s | at=%s | name=%s | amount=%s | balance=%s | branch=%s | key=%s"
        % (
            status,
            transaction.occurred_at.isoformat(),
            transaction.memo,
            f"{transaction.amount:,}",
            f"{transaction.balance:,}",
            transaction.branch or "-",
            payload["dedupeKey"][:24],
        )
    )
    if response is not None:
        message += f" | response={response}"
    APP_LOG.info(message)


def parse_args(argv: list[str]) -> argparse.Namespace:
    argv = [arg for arg in argv if arg != "--"]
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)
