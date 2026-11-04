import unittest

from app.core.config import clean_provider_secret, resolve_mongodb_uri


class ProviderSecretTests(unittest.TestCase):
    def test_placeholder_provider_secret_is_not_treated_as_configured(self):
        self.assertEqual(
            clean_provider_secret("AIzaSy-REPLACE-WITH-YOUR-KEY-FROM-AISTUDIO-GOOGLE-COM"),
            "",
        )

    def test_real_provider_secret_is_preserved(self):
        value = "AIzaSy-realistic-test-value"
        self.assertEqual(clean_provider_secret(value), value)


class MongoUriConfigurationTests(unittest.TestCase):
    def test_uses_valid_environment_uri(self):
        environment_uri = "mongodb+srv://db.example/trustrag?retryWrites=true&w=majority"
        self.assertEqual(
            resolve_mongodb_uri(environment_uri, "mongodb://localhost/trustrag", production=False),
            environment_uri,
        )

    def test_local_mode_falls_back_from_cmd_escaped_uri_to_project_env(self):
        malformed_environment_uri = (
            "mongodb+srv://other.example/trustrag?retryWrites=true^&w=majority^"
        )
        configured_uri = (
            "mongodb+srv://db.example/trustrag?retryWrites=true&w=majority"
        )
        self.assertEqual(
            resolve_mongodb_uri(malformed_environment_uri, configured_uri, production=False),
            configured_uri,
        )

    def test_production_mode_rejects_malformed_environment_uri(self):
        malformed_environment_uri = (
            "mongodb+srv://other.example/trustrag?retryWrites=true^&w=majority^"
        )
        with self.assertRaisesRegex(ValueError, "MONGODB_URI"):
            resolve_mongodb_uri(
                malformed_environment_uri,
                "mongodb://localhost/trustrag",
                production=True,
            )


if __name__ == "__main__":
    unittest.main()
