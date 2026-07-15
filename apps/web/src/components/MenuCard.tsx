interface MenuCardProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export default function MenuCard({ icon, label, onClick }: MenuCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[130px] w-full max-w-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-8 backdrop-blur-sm transition hover:border-[#e85d6f]/35 hover:bg-white/[0.06]"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#e85d6f] to-[#d44d62] text-white shadow-lg shadow-[#e85d6f]/15 transition group-hover:scale-105">
        {icon}
      </div>
      <span className="text-center text-[0.9rem] font-medium text-white/90">
        {label}
      </span>
    </button>
  );
}
