from __future__ import annotations

import json
from pathlib import Path


class StateStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.seen = self._load()

    def has(self, key: str) -> bool:
        return key in self.seen

    def remember(self, key: str) -> None:
        self.seen.add(key)

    def mark(self, key: str) -> None:
        self.remember(key)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"seen": sorted(self.seen)}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _load(self) -> set[str]:
        if not self.path.exists():
            return set()
        data = json.loads(self.path.read_text(encoding="utf-8"))
        return set(data.get("seen", []))
