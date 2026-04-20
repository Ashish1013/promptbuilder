"""
Iteration 12: Auth/Session and Role/User API Tests
Tests for:
- Login flow works end-to-end
- Auth token validation via /api/auth/me
- Session hydration (token reuse)
- Role/User APIs (list users, update role, delete user)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from /app/memory/test_credentials.md
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


class TestAuthLoginFlow:
    """Test login flow works end-to-end after session storage migration"""

    def test_login_success_returns_token_and_user(self):
        """Login with valid credentials returns access_token and user object"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["token_type"] == "bearer"
        
        user = data["user"]
        assert user["username"] == ADMIN_USERNAME
        assert user["role"] == "admin"
        assert "id" in user
        assert "full_name" in user
        print(f"✓ Login success: token={data['access_token'][:20]}..., user={user['username']}")

    def test_login_invalid_credentials_returns_401(self):
        """Login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "wronguser", "password": "wrongpass"},
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")

    def test_login_wrong_password_returns_401(self):
        """Login with correct username but wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": "wrongpassword"},
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Wrong password correctly rejected with 401")


class TestAuthTokenValidation:
    """Test auth token validation via /api/auth/me endpoint"""

    @pytest.fixture
    def auth_token(self):
        """Get valid auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        return response.json()["access_token"]

    def test_auth_me_with_valid_token(self, auth_token):
        """GET /api/auth/me with valid token returns user profile"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        user = response.json()
        assert user["username"] == ADMIN_USERNAME
        assert user["role"] == "admin"
        assert "id" in user
        print(f"✓ Auth/me success: user={user['username']}, role={user['role']}")

    def test_auth_me_without_token_returns_401(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Auth/me without token correctly rejected with 401")

    def test_auth_me_with_invalid_token_returns_401(self):
        """GET /api/auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"},
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Auth/me with invalid token correctly rejected with 401")


class TestSessionHydration:
    """Test session hydration - token can be reused for multiple requests"""

    @pytest.fixture
    def auth_token(self):
        """Get valid auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        return response.json()["access_token"]

    def test_token_reuse_for_multiple_requests(self, auth_token):
        """Same token can be used for multiple authenticated requests"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Request 1: Get user profile
        r1 = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r1.status_code == 200, "First request failed"
        
        # Request 2: Get activity
        r2 = requests.get(f"{BASE_URL}/api/activity", headers=headers)
        assert r2.status_code == 200, "Second request failed"
        
        # Request 3: Get templates
        r3 = requests.get(f"{BASE_URL}/api/template-library", headers=headers)
        assert r3.status_code == 200, "Third request failed"
        
        print("✓ Token reuse works for multiple requests (session hydration)")


class TestRoleUserAPIs:
    """Test role/user APIs from backend side"""

    @pytest.fixture
    def admin_headers(self):
        """Get admin auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_list_users_as_admin(self, admin_headers):
        """GET /api/users returns list of users for admin"""
        response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        assert response.status_code == 200, f"List users failed: {response.text}"
        
        users = response.json()
        assert isinstance(users, list)
        assert len(users) >= 1, "Should have at least admin user"
        
        # Verify user structure
        admin_user = next((u for u in users if u["username"] == ADMIN_USERNAME), None)
        assert admin_user is not None, "Admin user not found in list"
        assert admin_user["role"] == "admin"
        print(f"✓ List users success: {len(users)} users found")

    def test_get_roles_matrix(self, admin_headers):
        """GET /api/roles returns role permissions matrix"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=admin_headers)
        assert response.status_code == 200, f"Get roles failed: {response.text}"
        
        data = response.json()
        assert "roles" in data
        roles = data["roles"]
        
        # Verify all roles exist
        assert "admin" in roles
        assert "editor" in roles
        assert "viewer" in roles
        
        # Verify admin has all permissions
        assert roles["admin"]["can_manage_templates"] is True
        assert roles["admin"]["can_create_prompts"] is True
        
        # Verify viewer has restricted permissions
        assert roles["viewer"]["can_manage_templates"] is False
        assert roles["viewer"]["can_create_prompts"] is False
        
        print("✓ Roles matrix retrieved successfully")

    def test_create_and_delete_test_user(self, admin_headers):
        """Create a test user and then delete it"""
        test_username = "test_iter12_user"
        
        # Create user
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=admin_headers,
            json={
                "username": test_username,
                "full_name": "Test Iter12 User",
                "password": "testpass123",
                "role": "editor",
            },
        )
        
        # Handle case where user already exists
        if create_response.status_code == 400 and "already exists" in create_response.text:
            # Find and delete existing user first
            users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
            users = users_response.json()
            existing_user = next((u for u in users if u["username"] == test_username), None)
            if existing_user:
                requests.delete(f"{BASE_URL}/api/users/{existing_user['id']}", headers=admin_headers)
            # Retry create
            create_response = requests.post(
                f"{BASE_URL}/api/users",
                headers=admin_headers,
                json={
                    "username": test_username,
                    "full_name": "Test Iter12 User",
                    "password": "testpass123",
                    "role": "editor",
                },
            )
        
        assert create_response.status_code == 200, f"Create user failed: {create_response.text}"
        created_user = create_response.json()
        assert created_user["username"] == test_username
        assert created_user["role"] == "editor"
        user_id = created_user["id"]
        print(f"✓ Created test user: {test_username}")
        
        # Delete user
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers=admin_headers,
        )
        assert delete_response.status_code == 200, f"Delete user failed: {delete_response.text}"
        print(f"✓ Deleted test user: {test_username}")

    def test_update_user_role(self, admin_headers):
        """Create user, update role, then delete"""
        test_username = "test_iter12_role_update"
        
        # Create user as editor
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=admin_headers,
            json={
                "username": test_username,
                "full_name": "Test Role Update User",
                "password": "testpass123",
                "role": "editor",
            },
        )
        
        # Handle existing user
        if create_response.status_code == 400:
            users_response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
            users = users_response.json()
            existing_user = next((u for u in users if u["username"] == test_username), None)
            if existing_user:
                requests.delete(f"{BASE_URL}/api/users/{existing_user['id']}", headers=admin_headers)
            create_response = requests.post(
                f"{BASE_URL}/api/users",
                headers=admin_headers,
                json={
                    "username": test_username,
                    "full_name": "Test Role Update User",
                    "password": "testpass123",
                    "role": "editor",
                },
            )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update role to viewer
        update_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/role",
            headers=admin_headers,
            json={"role": "viewer"},
        )
        assert update_response.status_code == 200, f"Update role failed: {update_response.text}"
        updated_user = update_response.json()
        assert updated_user["role"] == "viewer"
        print("✓ Updated user role from editor to viewer")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)
        print("✓ Cleaned up test user")


class TestCoreAPIsWithAuth:
    """Test core APIs work with authentication"""

    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_activity_endpoint(self, auth_headers):
        """GET /api/activity works with auth"""
        response = requests.get(f"{BASE_URL}/api/activity", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        print(f"✓ Activity endpoint works: {len(data['rows'])} rows")

    def test_template_library_endpoint(self, auth_headers):
        """GET /api/template-library works with auth"""
        response = requests.get(f"{BASE_URL}/api/template-library", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)
        print(f"✓ Template library endpoint works: {len(templates)} templates")

    def test_ready_templates_endpoint(self, auth_headers):
        """GET /api/template-library/ready works with auth"""
        response = requests.get(f"{BASE_URL}/api/template-library/ready", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)
        print(f"✓ Ready templates endpoint works: {len(templates)} ready templates")

    def test_prompts_endpoint(self, auth_headers):
        """GET /api/prompts works with auth"""
        response = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        print(f"✓ Prompts endpoint works: {len(prompts)} prompts")
