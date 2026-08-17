import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export function CTA() {
  return (
    <section className="relative z-10 px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <div
          className="relative overflow-hidden rounded-[var(--r-2xl)] px-6 py-16 text-center sm:px-16"
          style={{
            background: "linear-gradient(165deg, #171b12, #0b0e08)",
            boxShadow: "0 40px 90px -30px rgb(18 21 15 / 0.5)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgb(180 238 42 / 0.34), transparent 65%)",
              filter: "blur(50px)",
            }}
          />
          <div className="relative">
            <h2 className="t-h1 text-balance text-white">
              Start with one organization.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16.5px] leading-[1.65] text-white/55">
              Everything in Vini POS grows from the organization — its locations,
              its users, its roles, its workflow.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <ButtonLink
                href="/login"
                variant="lime"
                size="lg"
                feedback="medium"
              >
                Open the console
                <ArrowRight size={17} strokeWidth={2.6} />
              </ButtonLink>
            </div>
          </div>
        </div>

        <footer className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-[var(--line)] pt-8 sm:flex-row">
          <Logo size={28} />
          <p className="t-small text-muted">
            © {new Date().getFullYear()} Vini POS. One modular platform.
          </p>
        </footer>
      </div>
    </section>
  );
}
