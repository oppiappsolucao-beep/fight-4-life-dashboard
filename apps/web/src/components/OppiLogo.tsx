interface OppiLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { img: "h-9 w-9", text: "text-[0.95rem]" },
  md: { img: "h-11 w-11", text: "text-[clamp(1rem,2.2vw,1.45rem)]" },
  lg: { img: "h-14 w-14", text: "text-[clamp(1.2rem,2.5vw,1.75rem)]" },
};

export default function OppiLogo({ size = "md", showText = true }: OppiLogoProps) {
  const s = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <img
        src="/oppi_logo.png?v=2"
        alt="Oppi Tech"
        className={`${s.img} rounded-xl object-cover shadow-lg shadow-black/30`}
      />
      {showText && (
        <div className={`${s.text} font-extrabold uppercase tracking-[0.12rem] text-white`}>
          <span className="text-[#e85d6f]">Oppi</span> Tech
        </div>
      )}
    </div>
  );
}
