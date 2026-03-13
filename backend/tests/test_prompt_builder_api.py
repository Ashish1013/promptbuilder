"""API regression tests for prompt builder templates, prompts CRUD, compile, and role restrictions."""

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
def tracked_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup_created_drafts(api_client, tracked_ids):
    yield
    for draft_id in tracked_ids:
        api_client.delete(
            f"{BASE_URL}/api/prompts/{draft_id}",
            headers={"x-user-role": "admin"},
            timeout=20,
        )


class TestPromptBuilderAPI:
    def test_roles_matrix_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/roles", timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert data["roles"]["admin"]["can_manage_templates"] is True
        assert data["roles"]["viewer"]["can_create_prompts"] is False

    def test_templates_list_returns_seeded_templates(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/templates", timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert isinstance(data[0]["id"], str)
        assert "template_text" in data[0]

    def test_templates_update_blocked_for_non_admin(self, api_client):
        templates_resp = api_client.get(f"{BASE_URL}/api/templates", timeout=20)
        template = templates_resp.json()[0]
        payload = {
            "name": template["name"],
            "description": template.get("description", ""),
            "template_text": template["template_text"],
            "variables": template.get("variables", []),
            "subsections": template.get("subsections", []),
            "enabled_by_default": template.get("enabled_by_default", True),
        }
        response = api_client.put(
            f"{BASE_URL}/api/templates/{template['id']}",
            json=payload,
            headers={"x-user-role": "viewer"},
            timeout=20,
        )
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    def test_compile_endpoint_returns_snippets(self, api_client):
        payload = {
            "sections": [
                {
                    "id": "s1",
                    "name": "Section One",
                    "enabled": True,
                    "raw_text": "Hello {name}",
                    "variable_values": {"name": "TEST_User"},
                    "subsections": [
                        {
                            "id": "ss1",
                            "title": "Sub 1",
                            "enabled": True,
                            "raw_text": "Use case: {use_case}",
                            "variable_values": {"use_case": "TEST_Onboarding"},
                        }
                    ],
                }
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/prompts/compile", json=payload, timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert "TEST_User" in data["compiled_prompt"]
        assert "TEST_Onboarding" in data["compiled_prompt"]
        assert "s1" in data["section_snippets"]

    def test_create_prompt_blocked_for_viewer(self, api_client):
        payload = {
            "title": "TEST_Viewer_Create",
            "customer_name": "TEST_Customer",
            "use_case": "TEST_Use_Case",
            "sections": [],
            "compiled_prompt": "",
        }
        response = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=payload,
            headers={"x-user-role": "viewer"},
            timeout=20,
        )
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    def test_create_prompt_for_editor_and_verify_persistence(self, api_client, tracked_ids):
        payload = {
            "title": "TEST_Create_Draft_Editor",
            "customer_name": "TEST_Customer",
            "use_case": "TEST_Use_Case",
            "sections": [
                {
                    "id": "s_create",
                    "name": "Agent Persona",
                    "enabled": True,
                    "raw_text": "# Agent Persona\nName = {agent_name}",
                    "variable_values": {"agent_name": "TEST_Agent"},
                    "subsections": [],
                }
            ],
            "compiled_prompt": "",
        }
        create_response = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=payload,
            headers={"x-user-role": "editor"},
            timeout=20,
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["title"] == payload["title"]
        assert created["updated_by_role"] == "editor"
        assert "TEST_Agent" in created["compiled_prompt"]
        tracked_ids.append(created["id"])

        get_response = api_client.get(f"{BASE_URL}/api/prompts/{created['id']}", timeout=20)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["id"] == created["id"]
        assert fetched["customer_name"] == "TEST_Customer"

    def test_list_prompts_includes_created_draft(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/prompts", timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(item["title"] == "TEST_Create_Draft_Editor" for item in data)

    def test_update_prompt_blocked_for_viewer(self, api_client):
        drafts = api_client.get(f"{BASE_URL}/api/prompts", timeout=20).json()
        target = next((d for d in drafts if d["title"] == "TEST_Create_Draft_Editor"), None)
        if not target:
            pytest.skip("No test draft available for viewer update restriction test")

        payload = {
            "title": "TEST_Create_Draft_Editor",
            "customer_name": "TEST_Customer",
            "use_case": "TEST_Viewer_Update_Attempt",
            "sections": target["sections"],
            "compiled_prompt": target["compiled_prompt"],
        }
        response = api_client.put(
            f"{BASE_URL}/api/prompts/{target['id']}",
            json=payload,
            headers={"x-user-role": "viewer"},
            timeout=20,
        )
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    def test_update_prompt_for_editor_and_verify_persistence(self, api_client):
        drafts = api_client.get(f"{BASE_URL}/api/prompts", timeout=20).json()
        target = next((d for d in drafts if d["title"] == "TEST_Create_Draft_Editor"), None)
        if not target:
            pytest.skip("No test draft available for editor update test")

        payload = {
            "title": "TEST_Create_Draft_Editor",
            "customer_name": "TEST_Customer_Updated",
            "use_case": "TEST_Updated_Use_Case",
            "sections": target["sections"],
            "compiled_prompt": "",
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/prompts/{target['id']}",
            json=payload,
            headers={"x-user-role": "editor"},
            timeout=20,
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["customer_name"] == "TEST_Customer_Updated"
        assert updated["updated_by_role"] == "editor"

        get_response = api_client.get(f"{BASE_URL}/api/prompts/{target['id']}", timeout=20)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["use_case"] == "TEST_Updated_Use_Case"

    def test_delete_prompt_blocked_for_viewer(self, api_client):
        drafts = api_client.get(f"{BASE_URL}/api/prompts", timeout=20).json()
        target = next((d for d in drafts if d["title"] == "TEST_Create_Draft_Editor"), None)
        if not target:
            pytest.skip("No test draft available for viewer delete restriction test")

        response = api_client.delete(
            f"{BASE_URL}/api/prompts/{target['id']}",
            headers={"x-user-role": "viewer"},
            timeout=20,
        )
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    def test_delete_prompt_for_editor_and_verify_removal(self, api_client):
        drafts = api_client.get(f"{BASE_URL}/api/prompts", timeout=20).json()
        target = next((d for d in drafts if d["title"] == "TEST_Create_Draft_Editor"), None)
        if not target:
            pytest.skip("No test draft available for delete test")

        delete_response = api_client.delete(
            f"{BASE_URL}/api/prompts/{target['id']}",
            headers={"x-user-role": "editor"},
            timeout=20,
        )
        assert delete_response.status_code == 200
        assert "deleted" in delete_response.json()["message"].lower()

        get_response = api_client.get(f"{BASE_URL}/api/prompts/{target['id']}", timeout=20)
        assert get_response.status_code == 404
