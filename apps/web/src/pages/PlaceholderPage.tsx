import { Link } from "react-router-dom";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-400">{description}</p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-105"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
