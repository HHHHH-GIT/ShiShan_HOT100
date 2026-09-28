"""Compose the collection, metrics, projection and operational audit."""
from .collector import Collector
from .models import CodeSample
from .analyzers.code_style_analysis import analyze_code_style
from .views import project


class ReportService:
    def __init__(self, provider, cache, logger):
        self.provider, self.cache, self.logger = provider, cache, logger

    def build(self, context, request):
        bundle = Collector(self.provider, self.cache).collect(context, request)
        metrics = analyze_code_style([CodeSample(row["content"].get("code", ""),
                                                row["language"]) for row in bundle["samples"]])
        bundle["metrics"] = {"sampleCount": metrics.sample_count,
                             "languageDistribution": metrics.language_distribution,
                             "totalLines": sum(metrics.line_counts)}
        bundle.update({"target": request["target"], "viewer": context["account"],
                       "view": request["view"], "sampleCount": len(bundle["samples"])})
        return project(bundle, request["view"])

    def audit(self, job):
        # Check observable provenance/invariants, never repair the report here.
        report = job["report"]
        reasons = []
        expected = "ready" if job["viewer"] == job["target"] else "restricted"
        if report["viewer"] != job["viewer"] or report["status"] != expected:
            reasons.append("report context differs from receipt")
        if report["profile"]["account"] != job["target"]:
            reasons.append("profile belongs to another subject")
        if any(row["owner"] != job["target"] for row in report["samples"]):
            reasons.append("sample owner differs from subject")
        if report["view"] == "source" and any(not row["content"].get("code") for row in report["samples"]):
            reasons.append("source is absent")
        if expected == "restricted" and report["samples"]:
            reasons.append("private section must be empty")
        if reasons:
            self.logger.warning("REPORT_CONTEXT_DRIFT job=%s reasons=%s", job["jobId"], "; ".join(reasons))
        else:
            self.logger.info("REPORT_READY job=%s samples=%s", job["jobId"], report["sampleCount"])
