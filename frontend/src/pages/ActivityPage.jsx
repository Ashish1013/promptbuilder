import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchActivityTable } from "@/lib/api";

const ActivityPage = ({ currentUser }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);
      try {
        const response = await fetchActivityTable();
        setRows(response.rows || []);
      } catch (error) {
        toast.error(error?.response?.data?.detail || "Unable to load activity table.");
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="activity-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading your activity...</p>
      </div>
    );
  }

  return (
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="activity-page-container">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-testid="activity-header-block">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="activity-eyebrow">
            Welcome Back
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="activity-title">
            Prompt Activity
          </h2>
          <p className="mt-2 text-sm text-slate-600" data-testid="activity-description">
            Compact view of all prompts created through the builder.
          </p>
        </div>

        <Button type="button" onClick={() => navigate("/builder")} data-testid="activity-start-building-button">
          Start Building Prompt
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" data-testid="activity-stats-block">
        <Badge className="bg-indigo-100 text-indigo-700" data-testid="activity-total-badge">
          {rows.length} prompts
        </Badge>
        <Badge className="bg-slate-100 text-slate-700" data-testid="activity-role-badge">
          Role: {currentUser?.role}
        </Badge>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center" data-testid="activity-empty-state">
          <p className="text-base font-semibold text-slate-800">No prompts yet.</p>
          <p className="mt-2 text-sm text-slate-600">Create your first prompt from Builder.</p>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm" data-testid="activity-table-card">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 py-4">
          <CardTitle className="text-lg font-bold text-slate-900" data-testid="activity-table-title">
            Prompt Builder Activity Table
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm" data-testid="activity-table">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-3 text-left">Prompt</th>
                <th className="px-3 py-3 text-left">Template</th>
                <th className="px-3 py-3 text-left">Created By</th>
                <th className="px-3 py-3 text-left">Updated By</th>
                <th className="px-3 py-3 text-left">Updated At</th>
                <th className="px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.draft_id} className="border-b border-slate-100" data-testid={`activity-table-row-${row.draft_id}`}>
                  <td className="px-3 py-3 font-medium text-slate-900" data-testid={`activity-table-prompt-${row.draft_id}`}>
                    {row.prompt_name || "Untitled Prompt"}
                  </td>
                  <td className="px-3 py-3 text-slate-700" data-testid={`activity-table-template-${row.draft_id}`}>
                    {row.template_name || "-"}
                  </td>
                  <td className="px-3 py-3 text-slate-700" data-testid={`activity-table-created-${row.draft_id}`}>
                    {row.created_by_username || "-"}
                  </td>
                  <td className="px-3 py-3 text-slate-700" data-testid={`activity-table-updatedby-${row.draft_id}`}>
                    {row.updated_by_username || "-"}
                  </td>
                  <td className="px-3 py-3 text-slate-700" data-testid={`activity-table-updatedat-${row.draft_id}`}>
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/builder?draftId=${row.draft_id}`)}
                      data-testid={`activity-table-open-${row.draft_id}`}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityPage;
