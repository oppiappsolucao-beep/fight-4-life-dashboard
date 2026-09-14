interface StudentSectionPageProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function StudentSectionPage({
  title,
  description,
  children,
}: StudentSectionPageProps) {
  return (
    <div className="px-3 py-4 sm:px-6 md:px-10 md:py-8">
      <header className="mb-4 md:mb-8">
        <h1 className="m-0 break-words text-xl font-semibold text-[#2E496C] sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 md:mt-2 md:text-slate-500">
          {description}
        </p>
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
