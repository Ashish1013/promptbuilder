import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createUser, deleteUser, fetchRolesMatrix, fetchUsers, updateRolesMatrix, updateUserRole } from "@/lib/api";

const ROLE_OPTIONS = ["admin", "editor", "viewer"];

const UserManagementPage = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [rolesMatrix, setRolesMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "editor",
  });

  const isAdmin = currentUser?.role === "admin";

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResponse, matrixResponse] = await Promise.all([fetchUsers(), fetchRolesMatrix()]);
      setUsers(usersResponse);
      setRolesMatrix(matrixResponse);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load user roles page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    loadData();
  }, [isAdmin]);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      toast.error("Only admin can create users.");
      return;
    }

    setCreating(true);
    try {
      const created = await createUser(newUser);
      setUsers((prev) => [created, ...prev]);
      setNewUser({ full_name: "", username: "", password: "", role: "editor" });
      toast.success("User created.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to create user.");
    } finally {
      setCreating(false);
    }
  };

  const handleRoleUpdate = async (userId, nextRole) => {
    if (!isAdmin) {
      toast.error("Only admin can update roles.");
      return;
    }

    setSavingUserId(userId);
    try {
      const updated = await updateUserRole(userId, { role: nextRole });
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      toast.success("Role updated.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to update role.");
    } finally {
      setSavingUserId("");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdmin) {
      toast.error("Only admin can delete users.");
      return;
    }

    const confirmDelete = window.confirm("Delete this user and remove access immediately?");
    if (!confirmDelete) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success("User deleted.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to delete user.");
    }
  };

  const handlePermissionToggle = (roleName, permissionKey, nextValue) => {
    setRolesMatrix((prev) => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [permissionKey]: nextValue,
      },
    }));
  };

  const handleSavePermissions = async () => {
    if (!isAdmin || !rolesMatrix) {
      return;
    }

    setSavingPermissions(true);
    try {
      const updated = await updateRolesMatrix({ roles: rolesMatrix });
      setRolesMatrix(updated);
      toast.success("Role permissions updated.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to update role permissions.");
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="user-management-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading users and role controls...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="user-management-forbidden-state">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
          <p className="text-base font-semibold text-rose-800">Only admin can configure team roles.</p>
        </div>
      </div>
    );
  }

  const permissionKeys = rolesMatrix ? Object.keys(rolesMatrix.admin || {}) : [];

  return (
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="user-management-page-container">
      <div className="mb-8" data-testid="user-management-header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="user-management-eyebrow">
          Internal Admin Control
        </p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="user-management-title">
          Team Users & Roles
        </h2>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm" data-testid="create-user-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900" data-testid="create-user-title">
            Create User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreateUser} data-testid="create-user-form">
            <Input
              placeholder="Full name"
              value={newUser.full_name}
              onChange={(event) => setNewUser((prev) => ({ ...prev, full_name: event.target.value }))}
              data-testid="create-user-fullname-input"
            />
            <Input
              placeholder="Username"
              value={newUser.username}
              onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
              data-testid="create-user-username-input"
            />
            <Input
              placeholder="Password"
              type="text"
              value={newUser.password}
              onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              data-testid="create-user-password-input"
            />
            <div className="flex gap-2">
              <select
                value={newUser.role}
                onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                data-testid="create-user-role-select"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={creating} data-testid="create-user-submit-button">
                {creating ? "Creating..." : "Add"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6 border-slate-200 shadow-sm" data-testid="user-list-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900" data-testid="user-list-title">
            User Role Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              data-testid={`user-row-${user.id}`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900" data-testid={`user-fullname-${user.id}`}>
                  {user.full_name}
                </p>
                <p className="text-xs text-slate-600" data-testid={`user-username-${user.id}`}>
                  @{user.username}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-700" data-testid={`user-current-role-badge-${user.id}`}>
                  Current: {user.role}
                </Badge>
                <select
                  value={user.role}
                  onChange={(event) => handleRoleUpdate(user.id, event.target.value)}
                  disabled={savingUserId === user.id}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  data-testid={`user-role-select-${user.id}`}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={`${user.id}-${role}`} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteUser(user.id)}
                  data-testid={`user-delete-button-${user.id}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {rolesMatrix && (
        <Card className="border-slate-200 shadow-sm" data-testid="roles-matrix-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-xl font-bold text-slate-900" data-testid="roles-matrix-title">
              Permission Matrix (Editable)
            </CardTitle>
            <Button type="button" onClick={handleSavePermissions} disabled={savingPermissions} data-testid="roles-matrix-save-button">
              {savingPermissions ? "Saving..." : "Save Permissions"}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="roles-matrix-table">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Permission</th>
                  {ROLE_OPTIONS.map((role) => (
                    <th
                      key={`header-${role}`}
                      className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                      data-testid={`roles-matrix-header-${role}`}
                    >
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionKeys.map((permission) => (
                  <tr key={permission} className="border-b border-slate-100" data-testid={`roles-matrix-row-${permission}`}>
                    <td className="px-2 py-2 text-sm text-slate-700">{permission}</td>
                    {ROLE_OPTIONS.map((role) => (
                      <td key={`${permission}-${role}`} className="px-2 py-2">
                        <label
                          className="inline-flex items-center gap-2 text-sm text-slate-700"
                          data-testid={`roles-matrix-value-${permission}-${role}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(rolesMatrix[role][permission])}
                            onChange={(event) => handlePermissionToggle(role, permission, event.target.checked)}
                            data-testid={`roles-matrix-toggle-${permission}-${role}`}
                          />
                          {rolesMatrix[role][permission] ? "Allowed" : "Blocked"}
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserManagementPage;
