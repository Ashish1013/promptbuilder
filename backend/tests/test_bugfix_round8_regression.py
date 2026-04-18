"""Bugfix regression tests: settings user delete and template archive flows."""

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
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert isinstance(body["access_token"], str)
    return body


@pytest.fixture
def admin_headers(admin_auth):
    return {"Authorization": f"Bearer {admin_auth['access_token']}"}


class TestBugfixRound8Regression:
    # user-management settings flow: create/delete user and verify login revoked after deletion
    def test_delete_user_revokes_login_access(self, api_client, admin_headers):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "username": f"test_round8_del_{unique}",
            "full_name": f"TEST Round8 Delete {unique}",
            "password": "qa12345",
            "role": "editor",
        }

        create_resp = api_client.post(f"{BASE_URL}/api/users", headers=admin_headers, json=payload, timeout=20)
        assert create_resp.status_code == 200
        created_user = create_resp.json()
        assert created_user["username"] == payload["username"]

        login_before_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": payload["username"], "password": payload["password"]},
            timeout=20,
        )
        assert login_before_resp.status_code == 200
        assert login_before_resp.json()["user"]["username"] == payload["username"]

        delete_resp = api_client.delete(f"{BASE_URL}/api/users/{created_user['id']}", headers=admin_headers, timeout=20)
        assert delete_resp.status_code == 200
        assert "deleted" in delete_resp.json()["message"].lower()

        list_after_resp = api_client.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=20)
        assert list_after_resp.status_code == 200
        users_after = list_after_resp.json()
        assert all(user["id"] != created_user["id"] for user in users_after)

        login_after_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": payload["username"], "password": payload["password"]},
            timeout=20,
        )
        assert login_after_resp.status_code == 401
        assert "invalid username or password" in login_after_resp.json()["detail"].lower()

    # template archive flow: archive endpoint should move template to archived list and remove from active list
    def test_archive_template_moves_item_to_archived_list(self, api_client, admin_headers):
        list_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert list_resp.status_code == 200
        active_templates = list_resp.json()
        assert len(active_templates) >= 1

        source_template = active_templates[0]
        clone_name = f"TEST_R8_ARCHIVE_{uuid.uuid4().hex[:8]}"
        clone_resp = api_client.post(
            f"{BASE_URL}/api/template-library/clone",
            headers=admin_headers,
            json={"source_template_id": source_template["id"], "new_template_name": clone_name},
            timeout=20,
        )
        assert clone_resp.status_code == 200
        cloned = clone_resp.json()
        assert cloned["name"] == clone_name
        assert cloned["archived"] is False

        archive_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned['id']}/archive",
            headers=admin_headers,
            timeout=20,
        )
        assert archive_resp.status_code == 200
        archived_item = archive_resp.json()
        assert archived_item["id"] == cloned["id"]
        assert archived_item["archived"] is True
        assert archived_item["status"] == "draft"

        active_after_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert active_after_resp.status_code == 200
        active_after = active_after_resp.json()
        assert all(item["id"] != cloned["id"] for item in active_after)

        archived_list_resp = api_client.get(f"{BASE_URL}/api/template-library/archived", headers=admin_headers, timeout=20)
        assert archived_list_resp.status_code == 200
        archived_list = archived_list_resp.json()
        archived_match = next((item for item in archived_list if item["id"] == cloned["id"]), None)
        assert archived_match is not None
        assert archived_match["archived"] is True
