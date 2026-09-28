"""Projection for the compact report card and the full source view."""
import copy


def project(bundle, view):
    result = copy.deepcopy(bundle)
    if view == "summary":
        for sample in result["samples"]:
            sample["content"].pop("code", None)
    return result
