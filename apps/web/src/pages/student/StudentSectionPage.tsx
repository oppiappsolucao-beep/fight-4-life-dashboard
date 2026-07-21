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
        <h1 className="m-0 break-words text-xl font-semibold text-white sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/55 md:mt-2 md:text-white/60">
          {description}
        </p>
      </header>

      {children ?? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-sm sm:p-10">
          <p className="text-sm text-white/50">
            Conteúdo em desenvolvimento. Em breve você verá suas informações aqui.
          </p>
        </div>
      )}
    </div>
  );
}
