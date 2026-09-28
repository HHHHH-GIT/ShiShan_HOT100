"""The foreground window submits jobs; the operator runs the queued work later."""
import copy


def capture_context(session):
    return copy.deepcopy(session)


class Jobs:
    def __init__(self):
        self.items = {}

    def submit(self, session, request):
        key = "job-" + str(len(self.items) + 1)
        item = {"jobId": key, "status": "queued", "target": request["target"],
                "viewer": session["account"], "request": copy.deepcopy(request),
                "context": capture_context(session)}
        self.items[key] = item
        return self.public(item)

    def run(self, key, service):
        item = self.items[key]
        if item["status"] == "queued":
            report = service.build(item["context"], item["request"])
            item["report"] = copy.deepcopy(report)
            item["status"] = "completed"
            service.audit(item)
        return self.public(item)

    def public(self, item):
        return copy.deepcopy({key: value for key, value in item.items()
                              if key not in ("context", "request")})

    def history(self):
        return [self.public(item) for item in self.items.values()]
