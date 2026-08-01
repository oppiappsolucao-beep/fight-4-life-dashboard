interface OppiLogoProps {
  size?: "sm" | "md" | "lg";
  /** Mantido por compatibilidade; o lockup já inclui o texto OPPI FIT. */
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: "h-8 sm:h-9",
  md: "h-11 sm:h-12",
  lg: "h-14 sm:h-16",
} as const;

export default function OppiLogo({
  size = "md",
  showText: _showText = true,
  className = "",
}: OppiLogoProps) {
  return (
    <div
      className={`inline-flex items-center rounded-xl bg-white px-2.5 py-1.5 shadow-lg shadow-black/25 ${className}`}
    >
      <img
        src="/oppi-fit-logo.png"
        alt="OPPI Fit"
        className={`${sizes[size]} w-auto max-w-full object-contain object-left`}
      />
    </div>
  );
}
