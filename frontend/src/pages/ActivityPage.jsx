import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMyActivity } from "@/lib/api";

const ActivityPage = ({ currentUser }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);
      try {
        const response = await fetchMyActivity();
        setActivities(response.activities || []);
      } catch (error) {
        toast.error(error?.response?.data?.detail || "Unable to load your activity.");
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
            {currentUser?.full_name || currentUser?.username} Activity
          </h2>
          <p className="mt-2 text-sm text-slate-600" data-testid="activity-description">
            Start from here, then move to prompt building.
          </p>
        </div>

        <Button type="button" onClick={() => navigate("/builder")} data-testid="activity-start-building-button">
          Start Building Prompt
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" data-testid="activity-stats-block">
        <Badge className="bg-indigo-100 text-indigo-700" data-testid="activity-total-badge">
          {activities.length} recent items
        </Badge>
        <Badge className="bg-slate-100 text-slate-700" data-testid="activity-role-badge">
          Role: {currentUser?.role}
        </Badge>
      </div>

      {activities.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center" data-testid="activity-empty-state">
          <p className="text-base font-semibold text-slate-800">No activity yet.</p>
          <p className="mt-2 text-sm text-slate-600">Create your first prompt draft to start tracking activity.</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="activity-card-grid">
        {activities.map((item) => (
          <Card key={item.draft_id} className="border-slate-200 shadow-sm" data-testid={`activity-card-${item.draft_id}`}>
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900" data-testid={`activity-draft-title-${item.draft_id}`}>
                {item.draft_title || "Untitled Prompt"}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-5">
              <div data-testid={`activity-customer-${item.draft_id}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</p>
                <p className="text-sm font-medium text-slate-900">{item.customer_name || "Not specified"}</p>
              </div>

              <div data-testid={`activity-updated-${item.draft_id}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Updated</p>
                <p className="text-sm text-slate-700">{new Date(item.updated_at).toLocaleString()}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="bg-slate-100 text-slate-700" data-testid={`activity-role-${item.draft_id}`}>
                  Updated by {item.updated_by_role}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/builder?draftId=${item.draft_id}`)}
                  data-testid={`activity-open-draft-${item.draft_id}`}
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ActivityPage;
