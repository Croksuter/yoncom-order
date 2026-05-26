import contextlib
from datetime import datetime
import io
import tempfile
import unittest
from pathlib import Path

from kb_bank_webhook.main import post_or_print_deposit
from kb_bank_webhook.models import Transaction
from kb_bank_webhook.state import StateStore


class FakeYoncom:
    def __init__(self):
        self.calls = 0

    def post_deposit(self, payload, cycle_id):
        self.calls += 1
        return {"ok": True}


class MainTest(unittest.TestCase):
    def test_initial_sync_remembers_without_posting_in_dry_run(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            state = StateStore(state_path)
            yoncom = FakeYoncom()
            transaction = make_transaction()

            with contextlib.redirect_stdout(io.StringIO()):
                status = post_or_print_deposit(transaction, yoncom, state, True, "cycle-1", True)
                skipped = post_or_print_deposit(transaction, yoncom, state, True, "cycle-2")

            self.assertEqual(status, "baselined")
            self.assertEqual(skipped, "skipped")
            self.assertEqual(yoncom.calls, 0)
            self.assertFalse(state_path.exists())

    def test_initial_sync_persists_without_posting_in_live_mode(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            state = StateStore(state_path)
            yoncom = FakeYoncom()

            with contextlib.redirect_stdout(io.StringIO()):
                status = post_or_print_deposit(make_transaction(), yoncom, state, False, "cycle-1", True)

            self.assertEqual(status, "baselined")
            self.assertEqual(yoncom.calls, 0)
            self.assertTrue(state_path.exists())


def make_transaction():
    return Transaction(
        occurred_at=datetime(2026, 5, 27, 0, 15, 22),
        summary="전자금융",
        memo="홍길동",
        direction="입금",
        amount=1,
        balance=2,
        transfer_memo="",
        branch="하나은행",
        raw_text="2026.05.27 00:15:22 입금 홍길동 전자금융 1 잔액 2 거래점 하나은행",
    )


if __name__ == "__main__":
    unittest.main()
