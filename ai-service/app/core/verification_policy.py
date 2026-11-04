EXTERNAL_VERIFICATION_RETRIEVAL_THRESHOLD = 0.75


def should_trigger_external_verification(
    *, enabled: bool, api_key_available: bool, retrieval_quality: float
) -> bool:
    """Match production's strict low-retrieval-quality Tavily trigger."""
    return bool(
        enabled
        and api_key_available
        and retrieval_quality < EXTERNAL_VERIFICATION_RETRIEVAL_THRESHOLD
    )
