"""Regression tests for template unarchive flow and subsection removal persistence."""

import os
import uuid
from pathlib import Path

import pytest
import requests


def _load_backend_url() -> str:
    backend_url = os.environ.get("REACT_APP_BACKEND_URL")
    if backend_url:
        return backend_url.rstrip("/")

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
def admin_headers(api_client):
    login_resp = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=20,
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["user"]["role"] == "admin"
    return {"Authorization": f"Bearer {login_data['access_token']}"}


@pytest.fixture
def cloned_template(api_client, admin_headers):
    active_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
    assert active_resp.status_code == 200
    active_templates = active_resp.json()
    assert len(active_templates) > 0

    source = active_templates[0]
    template_name = f"TEST_UNARCHIVE_{uuid.uuid4().hex[:8]}"
    clone_resp = api_client.post(
        f"{BASE_URL}/api/template-library/clone",
        headers=admin_headers,
        json={"source_template_id": source["id"], "new_template_name": template_name},
        timeout=20,
    )
    assert clone_resp.status_code == 200
    cloned = clone_resp.json()
    assert cloned["name"] == template_name
    assert cloned["archived"] is False
    assert cloned["status"] == "draft"
    return cloned


class TestTemplateUnarchiveAndSubsectionRemoval:
    # template edit flow: removing subsections should persist even when count reaches zero
    def test_update_template_to_zero_subsections_persists(self, api_client, admin_headers, cloned_template):
        sections = cloned_template["sections"]
        assert len(sections) > 0

        target_index = next((idx for idx, section in enumerate(sections) if len(section.get("subsections", [])) > 0), 0)
        updated_sections = [dict(section) for section in sections]
        updated_sections[target_index]["subsections"] = []

        update_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned_template['id']}",
            headers=admin_headers,
            json={
                "name": cloned_template["name"],
                "status": cloned_template["status"],
                "sections": updated_sections,
            },
            timeout=20,
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["id"] == cloned_template["id"]
        assert len(updated["sections"][target_index]["subsections"]) == 0

        active_after_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert active_after_resp.status_code == 200
        active_after = active_after_resp.json()
        persisted = next((item for item in active_after if item["id"] == cloned_template["id"]), None)
        assert persisted is not None
        assert len(persisted["sections"][target_index]["subsections"]) == 0

    # template archive lifecycle: unarchive should restore active template as draft and not ready
    def test_unarchive_returns_to_active_as_draft_not_ready(self, api_client, admin_headers, cloned_template):
        archive_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned_template['id']}/archive",
            headers=admin_headers,
            timeout=20,
        )
        assert archive_resp.status_code == 200
        archived = archive_resp.json()
        assert archived["archived"] is True
        assert archived["status"] == "draft"

        archived_list_resp = api_client.get(f"{BASE_URL}/api/template-library/archived", headers=admin_headers, timeout=20)
        assert archived_list_resp.status_code == 200
        archived_list = archived_list_resp.json()
        archived_item = next((item for item in archived_list if item["id"] == cloned_template["id"]), None)
        assert archived_item is not None
        assert archived_item["archived"] is True

        ready_when_archived_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=admin_headers, timeout=20)
        assert ready_when_archived_resp.status_code == 200
        ready_when_archived = ready_when_archived_resp.json()
        assert all(item["id"] != cloned_template["id"] for item in ready_when_archived)

        unarchive_resp = api_client.put(
            f"{BASE_URL}/api/template-library/{cloned_template['id']}/unarchive",
            headers=admin_headers,
            timeout=20,
        )
        assert unarchive_resp.status_code == 200
        unarchived = unarchive_resp.json()
        assert unarchived["archived"] is False
        assert unarchived["status"] == "draft"

        active_after_resp = api_client.get(f"{BASE_URL}/api/template-library", headers=admin_headers, timeout=20)
        assert active_after_resp.status_code == 200
        active_after = active_after_resp.json()
        active_item = next((item for item in active_after if item["id"] == cloned_template["id"]), None)
        assert active_item is not None
        assert active_item["archived"] is False
        assert active_item["status"] == "draft"

        ready_after_unarchive_resp = api_client.get(f"{BASE_URL}/api/template-library/ready", headers=admin_headers, timeout=20)
        assert ready_after_unarchive_resp.status_code == 200
        ready_after_unarchive = ready_after_unarchive_resp.json()
        assert all(item["id"] != cloned_template["id"] for item in ready_after_unarchive)
