"""
Backend tests for Builder Page iteration 10:
- P0: Builder page load reliability
- Builder home shows existing team prompts
- Create New flow with READY template selection
- Critical bug regression: variable input -> prompt output sync
- /api/prompts/compile case-insensitive placeholder substitution
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Auth headers for API calls"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestBuilderPageAPIs:
    """Tests for Builder page backend APIs"""
    
    def test_api_health(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert "message" in response.json()
        print("API health check passed")
    
    def test_list_prompt_drafts(self, auth_headers):
        """Test GET /api/prompts - Builder home shows existing team prompts"""
        response = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing prompt drafts")
    
    def test_list_ready_templates(self, auth_headers):
        """Test GET /api/template-library/ready - Create New modal template selection"""
        response = requests.get(f"{BASE_URL}/api/template-library/ready", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "At least one READY template should exist"
        # Verify template structure
        template = data[0]
        assert "id" in template
        assert "name" in template
        assert "status" in template
        assert template["status"] == "ready"
        print(f"Found {len(data)} READY templates for Create New modal")
    
    def test_list_template_library(self, auth_headers):
        """Test GET /api/template-library - Full template library"""
        response = requests.get(f"{BASE_URL}/api/template-library", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Template library has {len(data)} templates")


class TestPromptDraftCRUD:
    """Tests for prompt draft CRUD operations"""
    
    def test_create_prompt_draft(self, auth_headers):
        """Test POST /api/prompts - Create new prompt draft"""
        # First get a READY template
        templates_response = requests.get(f"{BASE_URL}/api/template-library/ready", headers=auth_headers)
        assert templates_response.status_code == 200
        templates = templates_response.json()
        assert len(templates) > 0
        template = templates[0]
        
        # Create draft payload
        payload = {
            "title": "TEST_ITER10_Draft",
            "customer_name": "Test Customer",
            "use_case": "Testing",
            "template_id": template["id"],
            "template_name": template["name"],
            "sections": [
                {
                    "id": "test_section",
                    "name": "Test Section",
                    "enabled": True,
                    "raw_text": "Hello {name}, welcome to {company}!",
                    "variable_values": {"name": "John", "company": "Acme"},
                    "subsections": []
                }
            ],
            "compiled_prompt": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == "TEST_ITER10_Draft"
        print(f"Created prompt draft with ID: {data['id']}")
        return data["id"]
    
    def test_get_prompt_draft(self, auth_headers):
        """Test GET /api/prompts/{draft_id} - Open existing prompt"""
        # First create a draft
        draft_id = self.test_create_prompt_draft(auth_headers)
        
        # Then fetch it
        response = requests.get(f"{BASE_URL}/api/prompts/{draft_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == draft_id
        assert data["title"] == "TEST_ITER10_Draft"
        print(f"Successfully fetched prompt draft: {draft_id}")
    
    def test_update_prompt_draft(self, auth_headers):
        """Test PUT /api/prompts/{draft_id} - Update existing prompt"""
        # First create a draft
        templates_response = requests.get(f"{BASE_URL}/api/template-library/ready", headers=auth_headers)
        template = templates_response.json()[0]
        
        create_payload = {
            "title": "TEST_ITER10_Update",
            "customer_name": "",
            "use_case": "",
            "template_id": template["id"],
            "template_name": template["name"],
            "sections": [
                {
                    "id": "test_section",
                    "name": "Test Section",
                    "enabled": True,
                    "raw_text": "Hello {name}!",
                    "variable_values": {"name": "Original"},
                    "subsections": []
                }
            ],
            "compiled_prompt": ""
        }
        
        create_response = requests.post(f"{BASE_URL}/api/prompts", headers=auth_headers, json=create_payload)
        assert create_response.status_code == 200
        draft_id = create_response.json()["id"]
        
        # Update the draft
        update_payload = {
            "title": "TEST_ITER10_Update",
            "customer_name": "Updated Customer",
            "use_case": "Updated Use Case",
            "template_id": template["id"],
            "template_name": template["name"],
            "sections": [
                {
                    "id": "test_section",
                    "name": "Test Section",
                    "enabled": True,
                    "raw_text": "Hello {name}!",
                    "variable_values": {"name": "Updated"},
                    "subsections": []
                }
            ],
            "compiled_prompt": "Hello Updated!"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/prompts/{draft_id}", headers=auth_headers, json=update_payload)
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["customer_name"] == "Updated Customer"
        print(f"Successfully updated prompt draft: {draft_id}")


class TestCompileEndpoint:
    """Tests for /api/prompts/compile - Critical bug regression"""
    
    def test_compile_basic(self, auth_headers):
        """Test basic compile functionality"""
        payload = {
            "sections": [
                {
                    "id": "section1",
                    "name": "Section 1",
                    "enabled": True,
                    "raw_text": "Hello {name}, welcome to {company}!",
                    "variable_values": {"name": "John", "company": "Acme"},
                    "subsections": []
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts/compile", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "compiled_prompt" in data
        assert "section_snippets" in data
        assert "John" in data["compiled_prompt"]
        assert "Acme" in data["compiled_prompt"]
        print(f"Compile result: {data['compiled_prompt']}")
    
    def test_compile_case_insensitive_placeholders(self, auth_headers):
        """Test case-insensitive placeholder substitution - Critical bug fix"""
        # Template has {Name} but variable_values has "name" (lowercase)
        payload = {
            "sections": [
                {
                    "id": "section1",
                    "name": "Section 1",
                    "enabled": True,
                    "raw_text": "Hello {Name}, welcome to {COMPANY}!",
                    "variable_values": {"name": "John", "company": "Acme"},
                    "subsections": []
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts/compile", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        compiled = data["compiled_prompt"]
        
        # Should substitute despite case mismatch
        assert "John" in compiled, f"Expected 'John' in compiled prompt but got: {compiled}"
        assert "Acme" in compiled, f"Expected 'Acme' in compiled prompt but got: {compiled}"
        print(f"Case-insensitive compile result: {compiled}")
    
    def test_compile_mixed_case_variables(self, auth_headers):
        """Test mixed case variable keys"""
        payload = {
            "sections": [
                {
                    "id": "section1",
                    "name": "Section 1",
                    "enabled": True,
                    "raw_text": "Agent: {agent_name}, Role: {Agent_Role}, Gender: {AGENT_GENDER}",
                    "variable_values": {
                        "agent_name": "Riya",
                        "agent_role": "HR Executive",
                        "agent_gender": "female"
                    },
                    "subsections": []
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts/compile", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        compiled = data["compiled_prompt"]
        
        assert "Riya" in compiled
        assert "HR Executive" in compiled
        assert "female" in compiled
        print(f"Mixed case compile result: {compiled}")
    
    def test_compile_with_subsections(self, auth_headers):
        """Test compile with subsections"""
        payload = {
            "sections": [
                {
                    "id": "section1",
                    "name": "Section 1",
                    "enabled": True,
                    "raw_text": "Main: {main_var}",
                    "variable_values": {"main_var": "MainValue"},
                    "subsections": [
                        {
                            "id": "sub1",
                            "title": "Subsection 1",
                            "enabled": True,
                            "raw_text": "Sub: {sub_var}",
                            "variable_values": {"sub_var": "SubValue"}
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts/compile", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        compiled = data["compiled_prompt"]
        
        assert "MainValue" in compiled
        assert "SubValue" in compiled
        print(f"Compile with subsections: {compiled}")
    
    def test_compile_empty_variable_shows_placeholder(self, auth_headers):
        """Test that empty variables show blank text (not placeholder)"""
        payload = {
            "sections": [
                {
                    "id": "section1",
                    "name": "Section 1",
                    "enabled": True,
                    "raw_text": "Hello {name}, welcome!",
                    "variable_values": {"name": ""},
                    "subsections": []
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/prompts/compile", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        compiled = data["compiled_prompt"]
        
        # Empty variable should keep placeholder format {name}
        assert "{name}" in compiled, f"Expected placeholder to remain for empty value: {compiled}"
        print(f"Empty variable compile result: {compiled}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_drafts(self, auth_headers):
        """Delete TEST_ITER10_ prefixed drafts"""
        response = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
        assert response.status_code == 200
        drafts = response.json()
        
        deleted_count = 0
        for draft in drafts:
            if draft.get("title", "").startswith("TEST_ITER10_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/prompts/{draft['id']}", 
                    headers=auth_headers
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test drafts")
