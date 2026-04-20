import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRolesMatrix } from "@/lib/api";

const PERMISSION_LABELS = {
  can_manage_templates: "Manage template library",
  can_create_prompts: "Create prompt drafts",
  can_update_prompts: "Update existing drafts",
  can_delete_prompts: "Delete drafts",
};

const RoleAccessPage = ({ role }) => {
  const [roleMatrix, setRoleMatrix] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchRolesMatrix();
      setRoleMatrix(response);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load role permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="access-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading role access matrix...</p>
      </div>
    );
  }

  if (!roleMatrix) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="access-error-state">
        <p className="text-base font-semibold text-slate-700">Role matrix not available.</p>
      </div>
    );
  }

  const roles = Object.keys(roleMatrix);
  const permissions = Object.keys(PERMISSION_LABELS);

  return (
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="access-page-container">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3" data-testid="access-header-block">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="access-eyebrow">
            Internal Governance
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="access-main-title">
            Role Access Matrix
          </h2>
          <p className="mt-2 text-sm text-slate-600" data-testid="access-description">
            Review what each role can do in the prompt automation workflow.
          </p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-700" data-testid="access-current-role-badge">
          Active Role: {role}
        </Badge>
      </div>

      <Card className="border-slate-200 shadow-sm" data-testid="access-matrix-card">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70">
          <CardTitle className="text-xl font-bold text-slate-900" data-testid="access-matrix-title">
            Permissions by Role
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse" data-testid="access-matrix-table">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" data-testid="access-table-header-permission">
                  Permission
                </th>
                {roles.map((roleName) => (
                  <th
                    key={roleName}
                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                    data-testid={`access-table-header-${roleName}`}
                  >
                    {roleName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission} className="border-b border-slate-100" data-testid={`access-row-${permission}`}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900" data-testid={`access-label-${permission}`}>
                    {PERMISSION_LABELS[permission]}
                  </td>

                  {roles.map((roleName) => {
                    const enabled = roleMatrix[roleName][permission];
                    return (
                      <td key={`${permission}-${roleName}`} className="px-6 py-4" data-testid={`access-value-${permission}-${roleName}`}>
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            enabled ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                          ].join(" ")}
                        >
                          {enabled ? "Allowed" : "Blocked"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleAccessPage;
