"""Auth, activity, users/roles, and auth-header regression tests for prompt APIs."""

import os
import time
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
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"
    return data


@pytest.fixture(scope="session")
def tracked_prompt_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup_prompts(api_client, tracked_prompt_ids):
    yield
    for draft_id in tracked_prompt_ids:
        api_client.delete(
            f"{BASE_URL}/api/prompts/{draft_id}",
            headers={"x-user-role": "admin"},
            timeout=20,
        )


class TestAuthAndUserRoleFlows:
    def test_login_invalid_credentials(self, api_client):
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "wrong-pass"},
            timeout=20,
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_auth_me_with_jwt(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"

    def test_activity_me_with_jwt(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        response = api_client.get(
            f"{BASE_URL}/api/activity/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert isinstance(data["activities"], list)

    def test_admin_can_list_users(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        response = api_client.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(user["username"] == "admin" for user in data)

    def test_admin_create_user_and_update_role(self, api_client, admin_auth):
        token = admin_auth["access_token"]
        suffix = str(uuid.uuid4())[:8]
        username = f"test_user_{suffix}"

        create_response = api_client.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": username,
                "full_name": "TEST Created User",
                "password": "Pass@1234",
                "role": "editor",
            },
            timeout=20,
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["username"] == username
        assert created["role"] == "editor"
        assert isinstance(created["id"], str)

        role_update_response = api_client.put(
            f"{BASE_URL}/api/users/{created['id']}/role",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "viewer"},
            timeout=20,
        )
        assert role_update_response.status_code == 200
        updated = role_update_response.json()
        assert updated["id"] == created["id"]
        assert updated["role"] == "viewer"

        list_response = api_client.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert list_response.status_code == 200
        users = list_response.json()
        matched = next((u for u in users if u["id"] == created["id"]), None)
        assert matched is not None
        assert matched["role"] == "viewer"

    def test_editor_restricted_from_user_management_endpoints(self, api_client, admin_auth):
        admin_token = admin_auth["access_token"]
        suffix = str(uuid.uuid4())[:8]
        editor_username = f"test_editor_{suffix}"

        create_response = api_client.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": editor_username,
                "full_name": "TEST Editor",
                "password": "Pass@1234",
                "role": "editor",
            },
            timeout=20,
        )
        assert create_response.status_code == 200

        login_response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": editor_username, "password": "Pass@1234"},
            timeout=20,
        )
        assert login_response.status_code == 200
        editor_token = login_response.json()["access_token"]

        list_users_response = api_client.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {editor_token}"},
            timeout=20,
        )
        assert list_users_response.status_code == 403
        assert "permission" in list_users_response.json()["detail"].lower()


class TestPromptCrudRegressionWithAuthHeaders:
    def test_prompt_create_and_update_with_auth_session_headers(self, api_client, admin_auth, tracked_prompt_ids):
        token = admin_auth["access_token"]
        unique = str(uuid.uuid4())[:8]
        base_title = f"TEST_Auth_Session_Draft_{unique}"

        create_payload = {
            "title": base_title,
            "customer_name": "TEST Customer",
            "use_case": "TEST Use Case",
            "sections": [
                {
                    "id": "session_test",
                    "name": "Session Test",
                    "enabled": True,
                    "raw_text": "Hello {name}",
                    "variable_values": {"name": "TEST Name"},
                    "subsections": [],
                }
            ],
            "compiled_prompt": "",
        }
        create_response = api_client.post(
            f"{BASE_URL}/api/prompts",
            json=create_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert create_response.status_code == 200
        created = create_response.json()
        tracked_prompt_ids.append(created["id"])
        assert created["title"] == base_title
        assert created["created_by_username"] == "admin"
        assert "TEST Name" in created["compiled_prompt"]

        update_payload = {
            "title": f"{base_title}_UPDATED",
            "customer_name": "TEST Customer Updated",
            "use_case": "TEST Use Case Updated",
            "sections": create_payload["sections"],
            "compiled_prompt": "",
        }
        update_response = api_client.put(
            f"{BASE_URL}/api/prompts/{created['id']}",
            json=update_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "x-user-role": "admin",
                "x-user-name": "admin",
            },
            timeout=20,
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["id"] == created["id"]
        assert updated["title"] == f"{base_title}_UPDATED"

        get_response = api_client.get(f"{BASE_URL}/api/prompts/{created['id']}", timeout=20)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["customer_name"] == "TEST Customer Updated"

        activity_response = api_client.get(
            f"{BASE_URL}/api/activity/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert activity_response.status_code == 200
        activities = activity_response.json()["activities"]
        assert any(item["draft_id"] == created["id"] for item in activities)
