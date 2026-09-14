interface OppiLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  onDark?: boolean;
  variant?: "mark" | "full";
}

const sizes = {
  sm: { img: "h-9 w-9", text: "text-[0.95rem]", full: "h-9" },
  md: { img: "h-11 w-11", text: "text-[clamp(1rem,2.2vw,1.45rem)]", full: "h-12" },
  lg: { img: "h-14 w-14", text: "text-[clamp(1.2rem,2.5vw,1.75rem)]", full: "h-[4.75rem] sm:h-24" },
};

export default function OppiLogo({
  size = "md",
  showText = true,
  className = "",
  onDark = false,
  variant = "mark",
}: OppiLogoProps) {
  const s = sizes[size];

  if (variant === "full") {
    return (
      <img
        src="/usemint-wordmark.png?v=2"
        alt="usemint — sua academia mais organizada"
        className={`${s.full} w-auto max-w-[min(92vw,420px)] bg-transparent object-contain ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/usemint-icon.png"
        alt="usemint"
        className={`${s.img} rounded-xl object-contain`}
      />
      {showText ? (
        <div
          className={`${s.text} font-extrabold lowercase tracking-[0.04rem] ${
            onDark ? "text-white" : "text-[#2E496C]"
          }`}
        >
          use
          <span className="text-[#5B7595]">mint</span>
        </div>
      ) : null}
    </div>
  );
}
