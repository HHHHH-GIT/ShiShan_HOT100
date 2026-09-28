"""Login status adapter used by report section routing."""


def resolve_identity(provider, cache, context, target):
    namespace = "identity:" + context["credential"]
    data = cache.remember(namespace, "user_status", lambda: provider.identity(context))
    status = data.get("userStatus") or {}
    if status.get("isSignedIn"):
        return status.get("username") or status.get("userSlug")
    return None
