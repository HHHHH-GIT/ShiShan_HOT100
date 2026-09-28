"""JSON cache, with a small process-local read-through index."""
import copy
import hashlib
import json
import time
from pathlib import Path


class Cache:
    def __init__(self, directory, ttl=21600):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl
        self._hot = {}

    def _memory_key(self, namespace, key):
        return (namespace, key)

    def _path(self, namespace, key):
        raw = json.dumps([namespace, key], ensure_ascii=False).encode()
        return self.directory / (hashlib.sha256(raw).hexdigest() + ".json")

    def get(self, namespace, key):
        address = self._memory_key(namespace, key)
        entry = self._hot.get(address)
        if entry is None:
            try:
                entry = json.loads(self._path(namespace, key).read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return None
            self._hot[address] = entry
        if time.time() - entry["ts"] > self.ttl:
            self._hot.pop(address, None)
            return None
        return entry["payload"]

    def set(self, namespace, key, payload):
        entry = {"ts": time.time(), "payload": copy.deepcopy(payload)}
        target = self._path(namespace, key)
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
        temporary.replace(target)
        self._hot[self._memory_key(namespace, key)] = entry

    def remember(self, namespace, key, fetch):
        value = self.get(namespace, key)
        if value is None:
            self.set(namespace, key, fetch())
            value = self.get(namespace, key)
        return value
