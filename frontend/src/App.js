import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthSession,
  fetchMe,
  getAuthUserFromStorage,
  saveAuthSession,
} from "@/lib/api";
import ActivityPage from "@/pages/ActivityPage";
import BuilderPage from "@/pages/BuilderPage";
import LoginPage from "@/pages/LoginPage";
import TemplatesPage from "@/pages/TemplatesPage";
import UserManagementPage from "@/pages/UserManagementPage";

const ProtectedApp = ({ currentUser, onLogout }) => {
  return (
    <div className="app-shell" data-testid="reachall-prompt-builder-root">
      <AppShell currentUser={currentUser} onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/activity" replace />} />
          <Route path="/activity" element={<ActivityPage currentUser={currentUser} />} />
          <Route path="/builder" element={<BuilderPage currentUser={currentUser} />} />
          <Route path="/templates" element={<TemplatesPage role={currentUser.role} />} />
          <Route path="/settings" element={<UserManagementPage currentUser={currentUser} />} />
          <Route path="*" element={<Navigate to="/activity" replace />} />
        </Routes>
      </AppShell>
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => getAuthUserFromStorage());
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const hydrateSession = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const storedUser = getAuthUserFromStorage();

      if (!token || !storedUser) {
        setAuthLoading(false);
        return;
      }

      try {
        const user = await fetchMe();
        saveAuthSession(token, user);
        setCurrentUser(user);
      } catch (error) {
        clearAuthSession();
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    hydrateSession();
  }, []);

  const handleLoginSuccess = (token, user) => {
    saveAuthSession(token, user);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="auth-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading session...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/activity" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />}
        />
        <Route
          path="/*"
          element={currentUser ? <ProtectedApp currentUser={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
      </Routes>
      <Toaster richColors position="top-right" data-testid="global-toast-container" />
    </BrowserRouter>
  );
}

export default App;
