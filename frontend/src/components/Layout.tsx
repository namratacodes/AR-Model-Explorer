import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { Button, Logo } from "./ui";

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 text-indigo-600">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-slate-900">AR Model Explorer</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.email}</span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}