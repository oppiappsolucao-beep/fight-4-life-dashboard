import { ReactNode } from "react";
import { Link } from "react-router-dom";
import OppiLogo from "./OppiLogo";

export default function AuthEntryLayout({
  title,
  subtitle,
  backTo = "/",
  showBack = true,
  children,
}: {
  title: string;
  subtitle: string;
  backTo?: string;
  showBack?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-white">
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6 sm:px-6">
        <header className="flex flex-col items-center gap-4 pt-6">
          <OppiLogo variant="full" size="lg" />
          {showBack ? (
            <Link
              to={backTo}
              className="text-[0.72rem] font-medium text-[#5B7595] transition hover:text-[#2E496C]"
            >
              Voltar ao início
            </Link>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="mb-6 text-center">
            <h1 className="m-0 text-[clamp(1.35rem,5vw,1.85rem)] font-semibold text-[#2E496C]">
              {title}
            </h1>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-600">{subtitle}</p>
          </div>
          <div className="w-full rounded-2xl border border-[#5B7595]/25 bg-[#eef2f6] p-5 shadow-[0_12px_40px_rgba(46,73,108,0.08)] sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-[0.9rem] text-[#2E496C] outline-none transition placeholder:text-slate-400 focus:border-[#5B7595] focus:ring-2 focus:ring-[#5B7595]/20";

export const authLabelClass =
  "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-[#2E496C]";
