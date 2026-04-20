import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginUser } from "@/lib/api";

const LoginPage = ({ onLoginSuccess }) => {
  const [formState, setFormState] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await loginUser({
        username: formState.username,
        password: formState.password,
      });

      onLoginSuccess(response.access_token, response.user);
      toast.success("Login successful.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Invalid credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6" data-testid="login-page-container">
      <Card className="w-full max-w-md border-slate-200 shadow-lg" data-testid="login-card">
        <CardHeader>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="login-eyebrow">
            ReachAll Internal Access
          </p>
          <CardTitle className="text-3xl font-extrabold text-slate-900" data-testid="login-title">
            Sign In
          </CardTitle>
          <p className="text-sm text-slate-600" data-testid="login-description">
            Use your internal username and password to access activity and prompt builder.
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin} data-testid="login-form">
            <div className="space-y-2">
              <label
                htmlFor="login-username"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                data-testid="login-username-label"
              >
                Username
              </label>
              <Input
                id="login-username"
                value={formState.username}
                onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
                data-testid="login-username-input"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                data-testid="login-password-label"
              >
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                data-testid="login-password-input"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting} data-testid="login-submit-button">
              {submitting ? "Signing in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
