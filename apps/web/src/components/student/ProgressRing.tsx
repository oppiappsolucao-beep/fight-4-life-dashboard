import type { WorkoutCompletionStatus } from "../../lib/workout";

export default function ProgressRing({
  percent,
  status,
}: {
  percent: number;
  status: WorkoutCompletionStatus;
}) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const stroke =
    status === "done" ? "#34d399" : status === "partial" ? "#fbbf24" : "#e85d6f";

  return (
    <div className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-white">{percent}%</span>
      </div>
    </div>
  );
}
