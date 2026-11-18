import type { ReactNode } from "react";
import { Logo } from "./ui";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-indigo-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">AR Model Explorer</span>
        </div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Train models on the web.
            <br />
            Walk around them in AR.
          </h2>
          <p className="mt-4 max-w-md text-indigo-100">
            Upload a dataset, train and explain a machine learning model, then scan a QR code to
            explore the results in 3D.
          </p>
        </div>
        <p className="text-sm text-indigo-200">Dataset → Model → Explanation → QR → AR</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-indigo-600 lg:hidden">
            <Logo />
            <span className="font-semibold">AR Model Explorer</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}