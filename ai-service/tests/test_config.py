import unittest

from app.core.config import clean_provider_secret


class ProviderSecretTests(unittest.TestCase):
    def test_placeholder_provider_secret_is_not_treated_as_configured(self):
        self.assertEqual(
            clean_provider_secret("AIzaSy-REPLACE-WITH-YOUR-KEY-FROM-AISTUDIO-GOOGLE-COM"),
            "",
        )

    def test_real_provider_secret_is_preserved(self):
        value = "AIzaSy-realistic-test-value"
        self.assertEqual(clean_provider_secret(value), value)


if __name__ == "__main__":
    unittest.main()
