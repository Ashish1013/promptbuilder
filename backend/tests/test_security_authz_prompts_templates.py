"""Security hardening regression: JWT auth + role enforcement for prompts/templates write APIs."""

import os
import uuid
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
def admin_auth(api_client):
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "admin"
    return data


@pytest.fixture(scope="session")
def tracked_prompt_ids():
    return []


@pytest.fixture(scope="session")
def role_users(api_client, admin_auth):
    token = admin_auth["access_token"]
    suffix = str(uuid.uuid4())[:8]
    users = {
        "editor": {
            "username": f"sec_editor_{suffix}",
            "full_name": "SEC Editor",
            "password": "Pass@1234",
            "role": "editor",
        },
        "viewer": {
            "username": f"sec_viewer_{suffix}",
            "full_name": "SEC Viewer",
            "password": "Pass@1234",
            "role": "viewer",
        },
    }

    for user_payload in users.values():
        create_resp = api_client.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"},
            json=user_payload,
            timeout=20,
        )
        assert create_resp.status_code == 200

    auth = {}
    for role, user_payload in users.items():
        login_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": user_payload["username"], "password": user_payload["password"]},
            timeout=20,
        )
        assert login_resp.status_code == 200
        auth[role] = login_resp.json()

    return auth


@pytest.fixture(scope="session", autouse=True)
def cleanup_prompts(api_client, tracked_prompt_ids, admin_auth):
    yield
    token = admin_auth["access_token"]
    for draft_id in tracked_prompt_ids:
        api_client.delete(
            f"{BASE_URL}/api/prompts/{draft_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )


class TestPromptTemplateJwtSecurity:
    # prompts/templates write APIs must reject forged x-user-role/x-user-name without valid JWT
    def test_prompt_create_requires_bearer_token_even_if_forged_headers(self, api_client):
        payload = {
            "title": "TEST_NoToken_Forge",
            "customer_name": "TEST",
            "use_case": "TEST",
            "sections": [],
            "compiled_prompt": "",
        }
        response = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=payload,
            headers={"x-user-role": "admin", "x-user-name": "admin"},
            timeout=20,
        )
        assert response.status_code == 401

    def test_template_update_requires_bearer_token_even_if_forged_headers(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        templates_resp = api_client.get(
            f"{BASE_URL}/api/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert templates_resp.status_code == 200
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
            headers={"x-user-role": "admin", "x-user-name": "admin"},
            timeout=20,
        )
        assert response.status_code == 401

    def test_invalid_token_rejected_on_prompt_and_template_writes(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        templates_resp = api_client.get(
            f"{BASE_URL}/api/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert templates_resp.status_code == 200
        template = templates_resp.json()[0]

        prompt_payload = {
            "title": "TEST_InvalidToken_Forge",
            "customer_name": "TEST",
            "use_case": "TEST",
            "sections": [],
            "compiled_prompt": "",
        }
        prompt_resp = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=prompt_payload,
            headers={
                "Authorization": "Bearer fake.invalid.token",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert prompt_resp.status_code == 401

        template_payload = {
            "name": template["name"],
            "description": template.get("description", ""),
            "template_text": template["template_text"],
            "variables": template.get("variables", []),
            "subsections": template.get("subsections", []),
            "enabled_by_default": template.get("enabled_by_default", True),
        }
        template_resp = api_client.put(
            f"{BASE_URL}/api/templates/{template['id']}",
            json=template_payload,
            headers={
                "Authorization": "Bearer fake.invalid.token",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert template_resp.status_code == 401

    def test_editor_cannot_mutate_template_even_with_forged_admin_headers(self, api_client, role_users, admin_auth):
        admin_token = admin_auth["access_token"]
        editor_token = role_users["editor"]["access_token"]
        templates_resp = api_client.get(
            f"{BASE_URL}/api/templates",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert templates_resp.status_code == 200
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
            headers={
                "Authorization": f"Bearer {editor_token}",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert response.status_code == 403

    def test_viewer_cannot_create_prompt_even_with_forged_admin_headers(self, api_client, role_users):
        viewer_token = role_users["viewer"]["access_token"]
        payload = {
            "title": "TEST_Viewer_Forge_Attempt",
            "customer_name": "TEST",
            "use_case": "TEST",
            "sections": [],
            "compiled_prompt": "",
        }
        response = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=payload,
            headers={
                "Authorization": f"Bearer {viewer_token}",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert response.status_code == 403

    def test_editor_can_create_update_prompt_and_server_uses_jwt_user_context(
        self,
        api_client,
        role_users,
        tracked_prompt_ids,
    ):
        editor_auth = role_users["editor"]
        editor_token = editor_auth["access_token"]
        editor_username = editor_auth["user"]["username"]

        payload = {
            "title": f"TEST_Sec_Edit_{uuid.uuid4().hex[:6]}",
            "customer_name": "TEST Customer",
            "use_case": "TEST Use Case",
            "sections": [
                {
                    "id": "s1",
                    "name": "Sec",
                    "enabled": True,
                    "raw_text": "Hi {name}",
                    "variable_values": {"name": "Editor"},
                    "subsections": [],
                }
            ],
            "compiled_prompt": "",
        }
        create_resp = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=payload,
            headers={
                "Authorization": f"Bearer {editor_token}",
                "x-user-role": "admin",
                "x-user-name": "forged_admin",
            },
            timeout=20,
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        tracked_prompt_ids.append(created["id"])
        assert created["created_by_username"] == editor_username
        assert created["updated_by_role"] == "editor"

        update_payload = {
            **payload,
            "customer_name": "TEST Customer Updated",
        }
        update_resp = api_client.put(
            f"{BASE_URL}/api/prompts/{created['id']}",
            json=update_payload,
            headers={
                "Authorization": f"Bearer {editor_token}",
                "x-user-role": "admin",
                "x-user-name": "forged_admin",
            },
            timeout=20,
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["updated_by_username"] == editor_username
        assert updated["updated_by_role"] == "editor"

        get_resp = api_client.get(
            f"{BASE_URL}/api/prompts/{created['id']}",
            headers={"Authorization": f"Bearer {editor_token}"},
            timeout=20,
        )
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["customer_name"] == "TEST Customer Updated"
