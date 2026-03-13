import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import BuilderPage from "@/pages/BuilderPage";
import DraftsPage from "@/pages/DraftsPage";
import RoleAccessPage from "@/pages/RoleAccessPage";
import TemplatesPage from "@/pages/TemplatesPage";

const ROLE_STORAGE_KEY = "reachall-current-role";

function App() {
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_STORAGE_KEY) || "editor");

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }, [role]);

  return (
    <BrowserRouter>
      <div className="app-shell" data-testid="reachall-prompt-builder-root">
        <AppShell role={role} onRoleChange={setRole}>
          <Routes>
            <Route path="/" element={<Navigate to="/builder" replace />} />
            <Route path="/builder" element={<BuilderPage role={role} />} />
            <Route path="/templates" element={<TemplatesPage role={role} />} />
            <Route path="/drafts" element={<DraftsPage role={role} />} />
            <Route path="/access" element={<RoleAccessPage role={role} />} />
          </Routes>
        </AppShell>
      </div>
      <Toaster richColors position="top-right" data-testid="global-toast-container" />
    </BrowserRouter>
  );
}

export default App;
