import tempfile
import unittest
from pathlib import Path

from kb_bank_webhook.state import StateStore


class StateStoreTest(unittest.TestCase):
    def test_marks_seen_keys(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "state.json"
            state = StateStore(path)

            self.assertFalse(state.has("KB:1"))
            state.mark("KB:1")

            reloaded = StateStore(path)
            self.assertTrue(reloaded.has("KB:1"))

    def test_remembers_keys_without_persisting(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "state.json"
            state = StateStore(path)

            state.remember("KB:dry-run")

            self.assertTrue(state.has("KB:dry-run"))
            self.assertFalse(path.exists())
            self.assertFalse(StateStore(path).has("KB:dry-run"))


if __name__ == "__main__":
    unittest.main()
