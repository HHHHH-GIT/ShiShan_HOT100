"""Run with Python 3.10+. All upstream records are local and immutable."""
import json
import logging
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from reporting.cache import Cache
from reporting.jobs import Jobs
from reporting.provider import Provider
from reporting.service import ReportService

ROOT = Path(__file__).resolve().parent
STATE = Path(os.environ.get("REPORT_STATE_DIR", str(ROOT / ".runtime")))
STATE.mkdir(parents=True, exist_ok=True)
(ROOT / "logs").mkdir(exist_ok=True)
logging.basicConfig(filename=ROOT / "logs" / "app.log", encoding="utf-8",
                    level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("reporting")
provider = Provider(ROOT / "samples" / "upstream.json")
cache = Cache(STATE / "cache")
service = ReportService(provider, cache, logger)
jobs = Jobs()
sessions = {}


def session_for(slot):
    if not isinstance(slot, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", slot):
        raise ValueError("invalid window slot")
    if slot not in sessions:
        sessions[slot] = {"account": None, "credential": "local:guest", "generation": 0}
    return sessions[slot]


def report_request(body):
    target = body.get("target")
    view = body.get("view", "source")
    count = body.get("sampleCount", 20)
    languages = body.get("languages")
    if not isinstance(target, str) or target not in provider.accounts:
        raise ValueError("unknown report target")
    if view not in ("source", "summary"):
        raise ValueError("unknown report view")
    if type(count) is not int or not 1 <= count <= 20:
        raise ValueError("sampleCount must be an integer from 1 to 20")
    if languages is not None:
        if not isinstance(languages, list) or any(item not in ("python", "java", "javascript") for item in languages):
            raise ValueError("invalid language selection")
        languages = sorted(set(languages))
    return {"target": target, "view": view, "sampleCount": count, "languages": languages}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, status, value, content_type="application/json; charset=utf-8"):
        data = (json.dumps(value, ensure_ascii=False).encode("utf-8")
                if content_type.startswith("application/json") else value)
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == "/":
            return self.send(200, (ROOT / "public" / "index.html").read_bytes(), "text/html; charset=utf-8")
        if route == "/api/health":
            return self.send(200, {"status": "ok"})
        if route == "/api/catalog":
            return self.send(200, provider.manifest())
        if route == "/api/session":
            try:
                slot = parse_qs(urlsplit(self.path).query).get("slot", ["desk"])[0]
                current = session_for(slot)
                return self.send(200, {"slot": slot, "account": current["account"],
                                       "generation": current["generation"]})
            except ValueError as exc:
                return self.send(400, {"error": str(exc)})
        if route == "/api/history":
            return self.send(200, {"jobs": jobs.history()})
        if route == "/api/source-audit":
            operations = [call["operation"] for call in provider.calls]
            return self.send(200, {"calls": provider.calls, "reads": {
                "profile": operations.count("profile"), "pages": operations.count("page"),
                "details": operations.count("detail")}})
        if route.startswith("/api/jobs/"):
            item = jobs.items.get(route.rsplit("/", 1)[-1])
            if item:
                return self.send(200, jobs.public(item))
        self.send(404, {"error": "not found"})

    def do_POST(self):
        global cache, service, jobs
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= 65536:
                raise ValueError("request too large")
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError("expected a JSON object")
            route = urlsplit(self.path).path
            if route == "/api/session":
                account = body.get("account")
                if account is not None and (not isinstance(account, str) or account not in provider.accounts):
                    raise ValueError("unknown account")
                slot = body.get("slot", "desk")
                session = session_for(slot)
                session.update(account=account, credential="local:" + (account or "guest"),
                               generation=session["generation"] + 1)
                return self.send(200, {"slot": slot, "account": account, "generation": session["generation"]})
            if route == "/api/reports":
                request = report_request(body)
                session = session_for(body.get("slot", "desk"))
                return self.send(200, jobs.submit(session, request))
            if re.fullmatch(r"/api/jobs/job-\d+/run", route):
                key = route.split("/")[3]
                if key not in jobs.items:
                    return self.send(404, {"error": "unknown job"})
                return self.send(200, jobs.run(key, service))
            if route == "/api/reset":
                # The workbench owns only these hashed cache files.
                for entry in cache.directory.glob("*.json"):
                    entry.unlink()
                jobs = Jobs()
                sessions.clear()
                provider.calls.clear()
            elif route != "/api/reload":
                return self.send(404, {"error": "not found"})
            cache = Cache(STATE / "cache")
            service = ReportService(provider, cache, logger)
            self.send(200, {"status": "ok"})
        except (ValueError, TypeError) as exc:
            self.send(400, {"error": str(exc)})
        except Exception:
            logger.exception("REPORT_FAILED")
            self.send(500, {"error": "report processing failed"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "18087"))
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Report workbench: http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
