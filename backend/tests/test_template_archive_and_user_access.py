"""Regression tests for template archive/ready filtering and settings user deletion access removal."""

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


def _create_user(api_client, admin_headers, role: str = "editor"):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "username": f"test_user_{unique}",
        "full_name": f"TEST User {unique}",
        "password": "qa12345",
        "role": role,
    }
    response = api_client.post(f"{BASE_URL}/api/users", headers=admin_headers, json=payload, timeout=20)
    assert response.status_code == 200
    created = response.json()
    assert created["username"] == payload["username"]
    assert created["role"] == role
    return created, payload


class TestTemplateArchiveAndUserAccess:
    # template lifecycle check: clone -> ready -> archived; verify active/ready exclusion + archived inclusion
    def test_archived_template_excluded_from_ready_and_active_lists(self, api_client, admin_headers):
        list_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert list_resp.status_code == 200
        active_templates = list_resp.json()
        assert len(active_templates) >= 1

        source_template = active_templates[0]
        clone_name = f"TEST_ARCHIVE_FLOW_{uuid.uuid4().hex[:8]}"
        clone_resp = api_client.post(
            f"{BASE_URL}/api/template-library/clone",
            headers=admin_headers,
            json={"source_template_id": source_template["id"], "new_template_name": clone_name},
            timeout=20,
        )
        assert clone_resp.status_code == 200
        cloned = clone_resp.json()
        assert cloned["name"] == clone_name
        assert cloned["status"] == "draft"
        assert cloned["archived"] is False

        mark_ready_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned['id']}",
            headers=admin_headers,
            json={"name": cloned["name"], "status": "ready", "sections": cloned["sections"]},
            timeout=20,
        )
        assert mark_ready_resp.status_code == 200
        marked_ready = mark_ready_resp.json()
        assert marked_ready["status"] == "ready"

        ready_before_archive_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=admin_headers, timeout=20)
        assert ready_before_archive_resp.status_code == 200
        ready_before_archive = ready_before_archive_resp.json()
        assert any(item["id"] == cloned["id"] for item in ready_before_archive)

        archive_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned['id']}/archive",
            headers=admin_headers,
            timeout=20,
        )
        assert archive_resp.status_code == 200
        archived_template = archive_resp.json()
        assert archived_template["id"] == cloned["id"]
        assert archived_template["archived"] is True
        assert archived_template["status"] == "draft"

        active_after_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert active_after_resp.status_code == 200
        active_after = active_after_resp.json()
        assert all(item["id"] != cloned["id"] for item in active_after)

        ready_after_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=admin_headers, timeout=20)
        assert ready_after_resp.status_code == 200
        ready_after = ready_after_resp.json()
        assert all(item["id"] != cloned["id"] for item in ready_after)

        archived_list_resp = api_client.get(f"{BASE_URL}/api/template-library/archived", headers=admin_headers, timeout=20)
        assert archived_list_resp.status_code == 200
        archived_items = archived_list_resp.json()
        archived_match = next((item for item in archived_items if item["id"] == cloned["id"]), None)
        assert archived_match is not None
        assert archived_match["archived"] is True

    # permissions check: non-admin cannot archive template
    def test_editor_cannot_archive_template(self, api_client, admin_headers):
        created_user, payload = _create_user(api_client, admin_headers, role="editor")

        login_editor_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": payload["username"], "password": payload["password"]},
            timeout=20,
        )
        assert login_editor_resp.status_code == 200
        editor_token = login_editor_resp.json()["access_token"]
        editor_headers = {"Authorization": f"Bearer {editor_token}"}

        templates_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert templates_resp.status_code == 200
        target_template = templates_resp.json()[0]

        archive_attempt_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{target_template['id']}/archive",
            headers=editor_headers,
            timeout=20,
        )
        assert archive_attempt_resp.status_code == 403
        assert "permission" in archive_attempt_resp.json()["detail"].lower()

        cleanup_resp = api_client.delete(f"{BASE_URL}/api/users/{created_user['id']}", headers=admin_headers, timeout=20)
        assert cleanup_resp.status_code == 200

    # settings user delete behavior: deleted account can no longer authenticate
    def test_deleted_user_loses_login_access(self, api_client, admin_headers):
        created_user, payload = _create_user(api_client, admin_headers, role="editor")

        login_before_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": payload["username"], "password": payload["password"]},
            timeout=20,
        )
        assert login_before_resp.status_code == 200
        login_before_data = login_before_resp.json()
        assert login_before_data["user"]["username"] == payload["username"]

        delete_resp = api_client.delete(f"{BASE_URL}/api/users/{created_user['id']}", headers=admin_headers, timeout=20)
        assert delete_resp.status_code == 200
        delete_data = delete_resp.json()
        assert "deleted" in delete_data["message"].lower()

        login_after_resp = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": payload["username"], "password": payload["password"]},
            timeout=20,
        )
        assert login_after_resp.status_code == 401
        assert "invalid username or password" in login_after_resp.json()["detail"].lower()
