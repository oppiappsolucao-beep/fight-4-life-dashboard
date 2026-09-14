interface DevSectionPageProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function DevSectionPage({
  title,
  description,
  children,
}: DevSectionPageProps) {
  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6 md:mb-8">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#5B7595]">
          Desenvolvimento • usemint
        </p>
        <h1 className="m-0 break-words text-xl font-semibold text-[#2E496C] sm:text-2xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </header>

      {children ?? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center backdrop-blur-sm sm:p-10">
          <p className="text-sm text-slate-500">
            Conteúdo em desenvolvimento. Em breve você verá suas informações aqui.
          </p>
        </div>
      )}
    </div>
  );
}
