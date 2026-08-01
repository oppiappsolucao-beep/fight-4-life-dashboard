interface OppiLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { img: "h-9 w-9", text: "text-[0.95rem]" },
  md: { img: "h-11 w-11", text: "text-[clamp(1rem,2.2vw,1.45rem)]" },
  lg: { img: "h-14 w-14", text: "text-[clamp(1.2rem,2.5vw,1.75rem)]" },
};

export default function OppiLogo({
  size = "md",
  showText = true,
  className = "",
}: OppiLogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/oppi-fit-icon.png?v=3"
        alt="OPPI Fit"
        className={`${s.img} rounded-xl object-contain`}
      />
      {showText ? (
        <div
          className={`${s.text} font-extrabold uppercase tracking-[0.12rem] text-white`}
        >
          OPPI{" "}
          <span className="bg-gradient-to-r from-[#3b9eff] to-[#ff2bd6] bg-clip-text text-transparent">
            Fit
          </span>
        </div>
      ) : null}
    </div>
  );
}
