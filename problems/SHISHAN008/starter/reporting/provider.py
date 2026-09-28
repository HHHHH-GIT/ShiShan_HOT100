"""Complete offline upstream. No cookies, HTTP calls, retries or fallback data."""
import copy
import json
from pathlib import Path


class Provider:
    PAGE_SIZE = 2

    def __init__(self, fixture):
        self.accounts = json.loads(Path(fixture).read_text(encoding="utf-8"))["accounts"]
        self.calls = []

    def _actor(self, context):
        account = context["account"]
        expected = "local:" + (account or "guest")
        if context["credential"] != expected:
            raise ValueError("invalid local credential")
        return account

    def identity(self, context):
        actor = self._actor(context)
        self.calls.append({"operation": "identity", "actor": actor})
        return {"userStatus": {"isSignedIn": actor is not None,
                               "username": actor, "userSlug": actor}}

    def profile(self, target):
        self.calls.append({"operation": "profile", "target": target})
        return copy.deepcopy(self.accounts[target]["profile"])

    def page(self, context, offset):
        actor = self._actor(context)
        self.calls.append({"operation": "page", "actor": actor, "offset": offset})
        records = self.accounts[actor]["submissions"] if actor else []
        selected = records[offset:offset + self.PAGE_SIZE]
        # Real list endpoints omit source; detail endpoints supply it.
        return {"submissions": [{k: v for k, v in row.items() if k != "content"}
                                 for row in copy.deepcopy(selected)],
                "hasNext": offset + len(selected) < len(records)}

    def detail(self, context, sid):
        actor = self._actor(context)
        self.calls.append({"operation": "detail", "actor": actor, "id": sid})
        for row in self.accounts[actor]["submissions"] if actor else []:
            if row["id"] == sid:
                return copy.deepcopy(row)
        raise PermissionError("submission is unavailable to this local account")

    def manifest(self):
        return {"accounts": [{"account": name, **copy.deepcopy(value["profile"]),
                              "submissionCount": len(value["submissions"])}
                             for name, value in self.accounts.items()]}
