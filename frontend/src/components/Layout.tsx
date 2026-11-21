import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { Button, Logo } from "./ui";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-indigo-50 text-indigo-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <Logo className="h-7 w-7" />
              <span className="font-semibold tracking-tight text-slate-900">AR Model Explorer</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/projects" className={navClass}>
                Projects
              </NavLink>
            </nav>
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