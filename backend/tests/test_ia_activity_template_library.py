"""IA regression: activity table, template library lifecycle, and settings role-permissions endpoints."""

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


@pytest.fixture(scope="session")
def tracked_prompt_ids():
    return []


@pytest.fixture(scope="session")
def tracked_template_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup_created_records(api_client, admin_auth, tracked_prompt_ids, tracked_template_ids):
    yield
    token = admin_auth["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    for draft_id in tracked_prompt_ids:
        api_client.delete(f"{BASE_URL}/api/prompts/{draft_id}", headers=headers, timeout=20)

    for template_id in tracked_template_ids:
        api_client.put(
            f"{BASE_URL}/api/template-library/{template_id}",
            headers=headers,
            json={"name": f"ARCHIVE_{template_id}", "status": "draft", "sections": []},
            timeout=20,
        )


@pytest.fixture
def role_matrix_restore(api_client, admin_auth):
    token = admin_auth["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    original_resp = api_client.get(f"{BASE_URL}/api/roles", headers=headers, timeout=20)
    assert original_resp.status_code == 200
    original_roles = original_resp.json()["roles"]
    yield original_roles
    api_client.put(f"{BASE_URL}/api/roles", headers=headers, json={"roles": original_roles}, timeout=20)


class TestActivityTemplateLibraryAndSettings:
    # auth protection checks for activity + template library endpoints
    def test_activity_and_template_library_require_auth(self, api_client):
        activity_resp = api_client.get(f"{BASE_URL}/api/activity", timeout=20)
        assert activity_resp.status_code == 401
        assert "unauthorized" in activity_resp.json()["detail"].lower()

        templates_resp = api_client.get(f"{BASE_URL}/api/template-library", timeout=20)
        assert templates_resp.status_code == 401
        assert "unauthorized" in templates_resp.json()["detail"].lower()

    # template clone flow + status ready/draft behavior for builder source endpoint
    def test_cloned_template_is_draft_then_can_become_ready(self, api_client, admin_auth, tracked_template_ids):
        token = admin_auth["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=headers, timeout=20)
        assert list_resp.status_code == 200
        existing_templates = list_resp.json()
        assert len(existing_templates) >= 1

        source = existing_templates[0]
        clone_name = f"TEST_IA_CLONE_{uuid.uuid4().hex[:8]}"
        clone_resp = api_client.post(
            f"{BASE_URL}/api/template-library/clone",
            headers=headers,
            json={"source_template_id": source["id"], "new_template_name": clone_name},
            timeout=20,
        )
        assert clone_resp.status_code == 200
        cloned = clone_resp.json()
        tracked_template_ids.append(cloned["id"])
        assert cloned["name"] == clone_name
        assert cloned["status"] == "draft"
        assert cloned["source_template_id"] == source["id"]

        ready_before_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=headers, timeout=20)
        assert ready_before_resp.status_code == 200
        ready_before = ready_before_resp.json()
        assert all(item["id"] != cloned["id"] for item in ready_before)

        update_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned['id']}",
            headers=headers,
            json={"name": clone_name, "status": "ready", "sections": cloned["sections"]},
            timeout=20,
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["id"] == cloned["id"]
        assert updated["status"] == "ready"

        ready_after_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=headers, timeout=20)
        assert ready_after_resp.status_code == 200
        ready_after = ready_after_resp.json()
        matched = next((item for item in ready_after if item["id"] == cloned["id"]), None)
        assert matched is not None
        assert matched["status"] == "ready"

    # activity table should include prompt only after first save/create
    def test_prompt_appears_in_activity_after_first_save(self, api_client, admin_auth, tracked_prompt_ids):
        token = admin_auth["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        unique = uuid.uuid4().hex[:8]
        title = f"TEST_IA_PROMPT_{unique}"

        before_resp = api_client.get(f"{BASE_URL}/api/activity", headers=headers, timeout=20)
        assert before_resp.status_code == 200
        before_rows = before_resp.json()["rows"]
        assert all(row["prompt_name"] != title for row in before_rows)

        create_resp = api_client.post(
            f"{BASE_URL}/api/prompts",
            headers=headers,
            json={
                "title": title,
                "customer_name": "TEST Customer",
                "use_case": "TEST Use Case",
                "template_id": "",
                "template_name": "",
                "sections": [
                    {
                        "id": "s_activity",
                        "name": "Activity Section",
                        "enabled": True,
                        "raw_text": "Hello {name}",
                        "variable_values": {"name": "ReachAll"},
                        "subsections": [],
                    }
                ],
                "compiled_prompt": "",
            },
            timeout=20,
        )
        assert create_resp.status_code == 200
        created = create_resp.json()
        tracked_prompt_ids.append(created["id"])
        assert created["title"] == title
        assert created["created_by_username"] == "admin"

        after_resp = api_client.get(f"{BASE_URL}/api/activity", headers=headers, timeout=20)
        assert after_resp.status_code == 200
        after_rows = after_resp.json()["rows"]
        found = next((row for row in after_rows if row["draft_id"] == created["id"]), None)
        assert found is not None
        assert found["prompt_name"] == title
        assert found["updated_by_username"] == "admin"

    # settings matrix update/save and persistence check
    def test_admin_can_edit_role_permissions_and_persist(self, api_client, admin_auth, role_matrix_restore):
        token = admin_auth["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        original = role_matrix_restore

        flipped = {
            role: permissions.copy() for role, permissions in original.items()
        }
        flipped["viewer"]["can_create_prompts"] = not bool(original["viewer"].get("can_create_prompts", False))

        update_resp = api_client.put(
            f"{BASE_URL}/api/roles",
            headers=headers,
            json={"roles": flipped},
            timeout=20,
        )
        assert update_resp.status_code == 200
        updated_roles = update_resp.json()["roles"]
        assert updated_roles["viewer"]["can_create_prompts"] == flipped["viewer"]["can_create_prompts"]

        get_resp = api_client.get(f"{BASE_URL}/api/roles", headers=headers, timeout=20)
        assert get_resp.status_code == 200
        fetched_roles = get_resp.json()["roles"]
        assert fetched_roles["viewer"]["can_create_prompts"] == flipped["viewer"]["can_create_prompts"]
