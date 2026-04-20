"""Template structure regression for agent persona + language detection sections."""

import os
from pathlib import Path

import pytest
import requests


def _load_backend_url() -> str:
    base_url = os.environ.get("REACT_APP_BACKEND_URL")
    if base_url:
        return base_url.rstrip("/")

    env_path = Path("/app/frontend/.env")
    if not env_path.exists():
        pytest.skip("frontend/.env missing; cannot resolve REACT_APP_BACKEND_URL")

    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"').rstrip("/")

    pytest.skip("REACT_APP_BACKEND_URL missing; cannot run API tests")


BASE_URL = _load_backend_url()


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client):
    login_response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    assert login_response.status_code == 200
    data = login_response.json()
    assert isinstance(data.get("access_token"), str)
    return data["access_token"]


@pytest.fixture
def templates(api_client, admin_token):
    response = api_client.get(
        f"{BASE_URL}/api/templates",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    return data


class TestTemplateStructurePersonaLanguage:
    # Agent Persona template structure + mandatory variables
    def test_agent_persona_has_required_fields_and_gender_dropdown(self, templates):
        persona = next((item for item in templates if item["id"] == "agent_persona"), None)
        assert persona is not None
        assert "Agent Persona" in persona["name"]

        variable_map = {variable["key"]: variable for variable in persona.get("variables", [])}
        assert variable_map["agent_name"]["required"]
        assert variable_map["agent_role"]["required"]
        assert variable_map["agent_objective"]["required"]

        gender = variable_map["agent_gender"]
        assert gender["required"]
        assert gender["input_type"] == "select"
        assert set(gender.get("options", [])) == {"male", "female", "neutral"}

    # Agent Persona optional subsection: company details
    def test_agent_persona_has_optional_company_details_subsection(self, templates):
        persona = next((item for item in templates if item["id"] == "agent_persona"), None)
        assert persona is not None

        company_details = next(
            (subsection for subsection in persona.get("subsections", []) if subsection["id"] == "company_details"),
            None,
        )
        assert company_details is not None
        assert not company_details["enabled_by_default"]

        company_variables = {variable["key"]: variable for variable in company_details.get("variables", [])}
        assert not company_variables["company_name"]["required"]
        assert not company_variables["company_context"]["required"]
        assert company_variables["company_context"]["input_type"] == "textarea"
        assert not company_variables["company_business_outcome"]["required"]

    # Language Detection section subsections + supported language controls
    def test_language_guidelines_contains_required_subsections_and_controls(self, templates):
        language = next((item for item in templates if item["id"] == "language_guidelines"), None)
        assert language is not None
        assert language["name"] == "Language Detection & Consistency"

        sub_map = {subsection["id"]: subsection for subsection in language.get("subsections", [])}
        required_ids = {
            "supported_languages",
            "switching_between_languages",
            "unsupported_language_switch",
            "language_switch_samples",
            "allow_switch_back",
        }
        assert required_ids.issubset(set(sub_map.keys()))

        supported_vars = {variable["key"]: variable for variable in sub_map["supported_languages"].get("variables", [])}
        assert supported_vars["supported_languages"]["input_type"] == "multiselect"
        assert set(supported_vars["supported_languages"]["options"]) == {
            "English",
            "Hindi/Hinglish",
            "Tamil/Tanglish",
        }

        switch_vars = {
            variable["key"]: variable for variable in sub_map["switching_between_languages"].get("variables", [])
        }
        assert switch_vars["switch_trigger_mode"]["input_type"] == "select"
        assert set(switch_vars["switch_trigger_mode"]["options"]) == {
            "Based on user language",
            "Based on explicit request only",
        }

    # Compile behavior: if no language subsections selected, base line still remains
    def test_compile_keeps_language_base_policy_when_subsections_disabled(self, api_client, admin_token):
        sections = [
            {
                "id": "language_guidelines",
                "name": "Language Detection & Consistency",
                "enabled": True,
                "raw_text": "## Language Detection & Consistency\\nIf no subsection is selected, follow this supported-language policy: {default_supported_policy}",
                "variable_values": {
                    "default_supported_policy": "Continue in the language established by call flow unless explicit switch request.",
                },
                "subsections": [
                    {
                        "id": "supported_languages",
                        "title": "Supported Languages",
                        "enabled": False,
                        "raw_text": "### Supported Languages\\nConfigured supported languages: {supported_languages}",
                        "variable_values": {"supported_languages": "English, Hindi/Hinglish"},
                    },
                    {
                        "id": "switching_between_languages",
                        "title": "Switching Between Languages",
                        "enabled": False,
                        "raw_text": "### Switching Between Languages\\nSwitch trigger mode: {switch_trigger_mode}",
                        "variable_values": {"switch_trigger_mode": "Based on explicit request only"},
                    },
                ],
            }
        ]

        compile_response = api_client.post(
            f"{BASE_URL}/api/prompts/compile",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"sections": sections},
            timeout=20,
        )
        assert compile_response.status_code == 200
        body = compile_response.json()
        compiled = body["compiled_prompt"]
        assert "Language Detection & Consistency" in compiled
        assert "supported-language policy" in compiled
        assert "### Supported Languages" not in compiled
        assert "### Switching Between Languages" not in compiled
