import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { label: "Builder", path: "/builder", testId: "nav-builder-link" },
  { label: "Template Library", path: "/templates", testId: "nav-templates-link" },
  { label: "Drafts", path: "/drafts", testId: "nav-drafts-link" },
  { label: "Role Access", path: "/access", testId: "nav-access-link" },
];

export const AppShell = ({ children, role, onRoleChange }) => {
  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md"
        data-testid="app-shell-header"
      >
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-8 lg:px-10">
          <div className="space-y-1" data-testid="app-branding-block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500" data-testid="app-brand-eyebrow">
              ReachAll Internal Workspace
            </p>
            <h1 className="text-xl font-extrabold text-slate-900" data-testid="app-main-title">
              Prompt Automation Studio
            </h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2" data-testid="primary-navigation-group">
            {NAV_ITEMS.map((item) => (
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

          <div className="flex items-center gap-3" data-testid="role-control-container">
            <Badge className="border-slate-300 bg-white text-slate-700" data-testid="current-role-badge">
              Current Role: {role}
            </Badge>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="role-selector" data-testid="role-selector-label">
              Switch Role
            </label>
            <select
              id="role-selector"
              value={role}
              onChange={(event) => onRoleChange(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none ring-indigo-500 transition-colors duration-200 focus:ring-2"
              data-testid="role-selector-input"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-0" data-testid="app-main-content-wrapper">
        {children}
      </main>
    </div>
  );
};
