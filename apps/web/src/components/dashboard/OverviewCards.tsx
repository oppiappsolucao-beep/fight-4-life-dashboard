import { Link } from "react-router-dom";
import { formatPlanCurrency } from "../../lib/plans";
import { formatAcademyName } from "../../lib/format";
import type { OverviewGoalMetric } from "../../types/overview";

export function OverviewHero({
  eyebrow,
  brand,
  title,
  subtitle,
}: {
  eyebrow: string;
  brand?: string;
  title: string;
  subtitle: string;
}) {
  const brandLabel = formatAcademyName(brand) || undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#5B7595]/30 bg-[#d5dee8] p-5 shadow-[0_8px_30px_rgba(46,73,108,0.08)] sm:p-6">
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#5B7595]">
        {eyebrow}
      </p>
      {brandLabel ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="m-0 break-words text-xl font-semibold leading-snug text-[#2E496C] sm:text-2xl">
            {brandLabel}
          </h2>
          <p className="m-0 text-base font-medium text-slate-500 sm:text-lg">{title}</p>
        </div>
      ) : (
        <h2 className="m-0 mt-1 text-2xl font-semibold text-[#2E496C]">{title}</h2>
      )}
      <p className="m-0 mt-2 text-sm text-slate-600">{subtitle}</p>
    </section>
  );
}

export function OverviewMetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>;
}) {
  const tones = [
    "bg-[#c5d0dc]",
    "bg-[#cdd6e4]",
    "bg-[#c5d4c8]",
    "bg-[#d0c8dc]",
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`rounded-2xl border border-slate-200/80 p-4 ${tones[index % tones.length]}`}
        >
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
            {item.label}
          </p>
          <p className="m-0 mt-2 text-2xl font-semibold text-[#2E496C]">{item.value}</p>
          {item.hint ? <p className="m-0 mt-1 text-xs text-slate-500">{item.hint}</p> : null}
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
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(46,73,108,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-[#2E496C]">{meta.label}</p>
              {emBreve ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500">
                  Em breve
                </span>
              ) : onTrack ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-700">
                  No alvo
                </span>
              ) : null}
            </div>
            <p className="m-0 mt-2 text-xl font-semibold text-[#2E496C]">{valueLabel}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  emBreve ? "bg-slate-300" : onTrack ? "bg-emerald-400" : "bg-[#5B7595]"
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
          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-[#2E496C] transition hover:border-[#5B7595]/40 hover:text-[#2E496C]"
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
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return null;
}
