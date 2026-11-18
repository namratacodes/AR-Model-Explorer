import { useId } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-indigo-600">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="m3 7 9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-500"
      : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50";
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, className = "", ...rest }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
        className={`block w-full rounded-lg border-0 px-3.5 py-2.5 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm ${className}`}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "bg-red-50 text-red-800 ring-red-200"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${styles}`}
    >
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  );
}