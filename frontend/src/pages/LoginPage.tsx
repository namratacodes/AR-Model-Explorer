import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, TextField } from "../components/ui";
import { errorMessage } from "../lib/api";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your projects.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{" "}
        <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}