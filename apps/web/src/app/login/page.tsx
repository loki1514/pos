import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Aurora } from "@/components/ui/Aurora";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-16">
      <Aurora dense />

      <Link
        href="/"
        className="press absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-[13.5px] font-semibold text-muted hover:bg-[rgb(18_21_15_/_0.05)] hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={2.6} />
        Back
      </Link>

      <div className="relative z-10 w-full max-w-[400px] rise">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={44} withWordmark={false} />
          <h1 className="t-h2 mt-5">Sign in</h1>
          <p className="mt-2 t-small text-muted">
            One login for Vini POS — Vini staff and organizations alike.
          </p>
        </div>

        <div className="glass rounded-[var(--r-2xl)] p-6 sm:p-7">
          <div className="relative z-10">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
