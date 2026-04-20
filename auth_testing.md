# Auth Testing Playbook

## API checks

1. Login:
```bash
curl -X POST "$REACT_APP_BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. Validate authenticated session:
```bash
curl "$REACT_APP_BACKEND_URL/api/auth/me" -H "Authorization: Bearer <token>"
```

## Frontend checks

1. Login via `/login` with admin credentials.
2. Confirm token appears in `sessionStorage` key `reachall-auth-token`.
3. Confirm token is absent from `localStorage`.
4. Reload page and verify session hydrates (user remains logged in).
5. Open Activity, Builder, Templates, and Settings pages to confirm no runtime errors.