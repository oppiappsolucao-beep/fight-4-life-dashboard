import { Link } from "react-router-dom";
import { formatPlanCurrency } from "../../lib/plans";
import type { OverviewGoalMetric } from "../../types/overview";

export function OverviewHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-5">
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
        {eyebrow}
      </p>
      <h2 className="m-0 mt-1 text-2xl font-semibold text-white">{title}</h2>
      <p className="m-0 mt-2 text-sm text-white/60">{subtitle}</p>
    </section>
  );
}

export function OverviewMetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-white/45">
            {item.label}
          </p>
          <p className="m-0 mt-2 text-2xl font-semibold text-white">{item.value}</p>
          {item.hint ? <p className="m-0 mt-1 text-xs text-white/45">{item.hint}</p> : null}
        </div>
      ))}
    </section>
  );
}

export function OverviewGoalsGrid({ metas }: { metas: OverviewGoalMetric[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {metas.map((meta) => {
        const emBreve = meta.status === "em_breve";
        const lowerIsBetter = meta.direction === "down";
        const percent = (() => {
          if (emBreve || meta.meta <= 0) return 0;
          if (lowerIsBetter) {
            if (meta.atual <= meta.meta) return 100;
            return Math.max(0, Math.round((meta.meta / meta.atual) * 100));
          }
          return Math.min(100, Math.round((meta.atual / meta.meta) * 100));
        })();
        const onTrack = lowerIsBetter ? meta.atual <= meta.meta : meta.atual >= meta.meta;
        const valueLabel =
          meta.unidade === "R$"
            ? formatPlanCurrency(meta.atual)
            : `${meta.atual} / ${meta.meta} ${meta.unidade}`;

        return (
          <div
            key={meta.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-white">{meta.label}</p>
              {emBreve ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/55">
                  Em breve
                </span>
              ) : onTrack ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-300">
                  No alvo
                </span>
              ) : null}
            </div>
            <p className="m-0 mt-2 text-xl font-semibold text-white">{valueLabel}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div
                className={`h-full rounded-full transition-all ${
                  emBreve ? "bg-white/20" : onTrack ? "bg-emerald-400" : "bg-[#e85d6f]"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function OverviewQuickLinks({
  links,
}: {
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-center text-sm font-semibold text-white/80 transition hover:border-[#e85d6f]/40 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </section>
  );
}

export function OverviewState({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }

  return null;
}
