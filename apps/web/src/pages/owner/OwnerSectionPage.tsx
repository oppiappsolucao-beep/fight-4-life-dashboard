interface OwnerSectionPageProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function OwnerSectionPage({
  title,
  description,
  children,
}: OwnerSectionPageProps) {
  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
          Dono da Academia
        </p>
        <h1 className="m-0 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">{description}</p>
      </header>

      {children ?? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Conteúdo em desenvolvimento. Em breve você verá suas informações aqui.
          </p>
        </div>
      )}
    </div>
  );
}
