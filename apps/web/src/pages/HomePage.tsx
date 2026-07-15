import { Link, useNavigate } from "react-router-dom";
import MenuCard from "../components/MenuCard";
import OppiLogo from "../components/OppiLogo";

const GYM_BG = "/hero-gym.png";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${GYM_BG})` }}
      />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-6 md:px-10">
        <header className="flex items-center justify-between">
          <OppiLogo size="md" />
          <Link
            to="/login"
            className="text-[0.8rem] font-medium text-white/50 transition hover:text-white/80"
          >
            Acesso da equipe
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-16 pt-8">
          <h1 className="mb-14 text-center text-[clamp(1.5rem,3vw,2.2rem)] font-normal text-white/95">
            Seja bem vindo!
          </h1>

          <MenuCard
            icon={<UserIcon />}
            label="Área de Aluno"
            onClick={() => navigate("/aluno/login")}
          />
        </main>

        <footer className="flex items-center gap-2 text-[0.72rem] text-white/50">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#e85d6f] to-[#d44d62] text-[0.6rem] font-bold text-white">
            H
          </span>
          Home
        </footer>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-4 13.5-4 14 0" />
    </svg>
  );
}
