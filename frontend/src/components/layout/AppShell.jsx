import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Activity", path: "/activity", testId: "nav-activity-link" },
  { label: "Builder", path: "/builder", testId: "nav-builder-link" },
  { label: "Template Library", path: "/templates", testId: "nav-templates-link" },
  { label: "Drafts", path: "/drafts", testId: "nav-drafts-link" },
  { label: "Team Roles", path: "/users", testId: "nav-users-link" },
];

export const AppShell = ({ children, currentUser, onLogout }) => {
  const visibleNavItems = NAV_ITEMS.filter((item) => item.path !== "/users" || currentUser?.role === "admin");

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md"
        data-testid="app-shell-header"
      >
        <div className="mx-auto grid max-w-[1800px] gap-4 px-6 py-4 md:px-8 lg:grid-cols-[280px_1fr_auto] lg:px-10">
          <div className="space-y-1" data-testid="app-branding-block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500" data-testid="app-brand-eyebrow">
              ReachAll Internal Workspace
            </p>
            <h1 className="text-xl font-extrabold text-slate-900" data-testid="app-main-title">
              Prompt Automation Studio
            </h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2" data-testid="primary-navigation-group">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={item.testId}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
                    isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-2" data-testid="user-control-container">
            <Badge className="max-w-[200px] border-slate-300 bg-white text-slate-700" data-testid="current-user-badge">
              <span className="truncate">{currentUser?.username}</span>
            </Badge>
            <Badge className="border-slate-300 bg-white text-slate-700" data-testid="current-role-badge">
              {currentUser?.role}
            </Badge>
            <Button type="button" variant="outline" onClick={onLogout} data-testid="logout-button">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-0" data-testid="app-main-content-wrapper">
        {children}
      </main>
    </div>
  );
};
