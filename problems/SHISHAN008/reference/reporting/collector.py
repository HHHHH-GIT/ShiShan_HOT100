"""Fetch complete pages, retain accepted records, and collect source samples."""
import json
from .identity import resolve_identity
from .samplers import uniform_temporal_sample


class Collector:
    def __init__(self, provider, cache):
        self.provider, self.cache = provider, cache

    def collect(self, context, request):
        target = request["target"]
        profile = self.cache.remember("public:" + target, "profile",
                                      lambda: self.provider.profile(target))
        actor = resolve_identity(self.provider, self.cache, context, target)
        if actor is None or actor != target:
            return {"profile": profile, "status": "restricted", "samples": []}

        namespace = "private:" + context["credential"] + ":" + target
        records = self.cache.remember(namespace, "submission_list",
                                      lambda: self._all_pages(context))
        languages = request["languages"]
        eligible = [row for row in records if row["verdict"] == "Accepted"
                    and (languages is None or row["language"] in languages)]
        selection = uniform_temporal_sample(eligible, lambda row: row["submittedAt"],
                                            request["sampleCount"], seed=42)
        # view is a presentation choice, not a different upstream dataset.
        key = "bundle:" + json.dumps([request["sampleCount"], languages], sort_keys=True)
        samples = self.cache.remember(namespace, key, lambda: [
            self.cache.remember(namespace, "detail:" + row["id"],
                                lambda row=row: self.provider.detail(context, row["id"]))
            for row in selection])
        return {"profile": profile, "status": "ready", "samples": samples}

    def _all_pages(self, context):
        rows = []
        offset = 0
        while True:
            page = self.provider.page(context, offset)
            rows.extend(page["submissions"])
            if not page["hasNext"]:
                return rows
            if not page["submissions"]:
                raise ValueError("upstream page did not advance")
            offset += len(page["submissions"])
