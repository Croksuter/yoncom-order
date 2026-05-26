import json
from types import SimpleNamespace
import tempfile
import unittest
from pathlib import Path

from kb_bank_webhook.logs import RunLogger


class LogsTest(unittest.TestCase):
    def test_json_logs_include_timestamp_and_cycle_id(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            settings = SimpleNamespace(log_dir=Path(temp_dir), save_dom=False)
            logger = RunLogger(settings)

            logger.write_json("cycle-1", "sample", {"value": 1})

            data = json.loads((Path(temp_dir) / "cycle-1-sample.json").read_text(encoding="utf-8"))
            self.assertEqual(data["cycleId"], "cycle-1")
            self.assertRegex(data["loggedAt"], r"^\d{4}-\d{2}-\d{2}T")
            self.assertEqual(data["value"], 1)


if __name__ == "__main__":
    unittest.main()
