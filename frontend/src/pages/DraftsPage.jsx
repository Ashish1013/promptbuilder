import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePromptDraft, fetchPromptDrafts } from "@/lib/api";

const DraftsPage = ({ role }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingDraftId, setDeletingDraftId] = useState("");
  const navigate = useNavigate();

  const canDelete = role === "admin" || role === "editor";

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchPromptDrafts();
      setDrafts(response);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load drafts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleDeleteDraft = async (draftId) => {
    if (!canDelete) {
      toast.error("Current role cannot delete drafts.");
      return;
    }

    setDeletingDraftId(draftId);
    try {
      await deletePromptDraft(draftId, role);
      setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
      toast.success("Draft deleted.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to delete draft.");
    } finally {
      setDeletingDraftId("");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="drafts-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading prompt drafts...</p>
      </div>
    );
  }

  return (
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="drafts-page-container">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3" data-testid="drafts-header-block">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="drafts-eyebrow">
            Prompt Draft Repository
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="drafts-main-title">
            Drafts
          </h2>
          <p className="mt-2 text-sm text-slate-600" data-testid="drafts-description">
            Reopen previous drafts, continue editing, and maintain delivery consistency.
          </p>
        </div>
        <Badge className="bg-slate-100 text-slate-700" data-testid="drafts-role-badge">
          Active Role: {role}
        </Badge>
      </div>

      {drafts.length === 0 && (
        <div
          className="noise-overlay rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
          data-testid="drafts-empty-state"
        >
          <p className="text-base font-semibold text-slate-800">No drafts saved yet.</p>
          <p className="mt-2 text-sm text-slate-600">Create your first prompt draft from the Builder page.</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="drafts-card-grid">
        {drafts.map((draft) => (
          <Card key={draft.id} className="border-slate-200 shadow-sm" data-testid={`draft-card-${draft.id}`}>
            <CardHeader className="space-y-3 border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-lg font-bold text-slate-900" data-testid={`draft-title-${draft.id}`}>
                {draft.title || "Untitled Prompt"}
              </CardTitle>
              <div className="flex flex-wrap gap-2" data-testid={`draft-meta-badges-${draft.id}`}>
                <Badge className="bg-indigo-100 text-indigo-700" data-testid={`draft-updated-role-${draft.id}`}>
                  Updated by: {draft.updated_by_role}
                </Badge>
                <Badge className="bg-slate-100 text-slate-700" data-testid={`draft-updated-at-${draft.id}`}>
                  {new Date(draft.updated_at).toLocaleString()}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              <div className="space-y-1" data-testid={`draft-customer-block-${draft.id}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</p>
                <p className="text-sm font-medium text-slate-900">{draft.customer_name || "Not specified"}</p>
              </div>

              <div className="space-y-1" data-testid={`draft-usecase-block-${draft.id}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Use Case</p>
                <p className="line-clamp-3 text-sm text-slate-700">{draft.use_case || "No notes provided."}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid={`draft-actions-${draft.id}`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/builder?draftId=${draft.id}`)}
                  data-testid={`draft-open-button-${draft.id}`}
                >
                  Open in Builder
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteDraft(draft.id)}
                  disabled={!canDelete || deletingDraftId === draft.id}
                  data-testid={`draft-delete-button-${draft.id}`}
                >
                  {deletingDraftId === draft.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DraftsPage;
