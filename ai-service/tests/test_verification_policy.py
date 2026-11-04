from app.core.verification_policy import should_trigger_external_verification


def test_external_verification_uses_strict_retrieval_threshold_and_requires_enablement_and_key():
    assert should_trigger_external_verification(
        enabled=True, api_key_available=True, retrieval_quality=0.7499
    ) is True
    assert should_trigger_external_verification(
        enabled=True, api_key_available=True, retrieval_quality=0.75
    ) is False
    assert should_trigger_external_verification(
        enabled=False, api_key_available=True, retrieval_quality=0.2
    ) is False
    assert should_trigger_external_verification(
        enabled=True, api_key_available=False, retrieval_quality=0.2
    ) is False
