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
      <div className="absolute inset-0 bg-[#071525]/78" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1f3a]/40 via-transparent to-[#071525]/90" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-6 md:px-10">
        <header className="flex items-center justify-between">
          <OppiLogo size="sm" />
          <Link
            to="/login"
            className="text-[0.8rem] font-medium text-white/50 transition hover:text-white/80"
          >
            Acesso da equipe
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-16 pt-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <OppiLogo size="lg" className="mb-6" />
            <p className="m-0 text-[0.7rem] font-semibold uppercase tracking-[0.18rem] text-[#7ebef0]">
              Plataforma de gestão fitness
            </p>
            <h1 className="m-0 mt-3 max-w-md text-[clamp(1.55rem,4vw,2.35rem)] font-semibold leading-tight text-white">
              Seja bem-vindo à{" "}
              <span className="bg-gradient-to-r from-[#3b9eff] to-[#ff2bd6] bg-clip-text text-transparent">
                OPPI Fit
              </span>
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Treinos, dietas e gestão da academia em um só lugar.
            </p>
          </div>

          <MenuCard
            icon={<UserIcon />}
            label="Área de Aluno"
            onClick={() => navigate("/aluno/login")}
          />
        </main>

        <footer className="flex items-center gap-2 text-[0.72rem] text-white/50">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#3b9eff] to-[#ff2bd6] text-[0.55rem] font-bold text-white">
            OF
          </span>
          OPPI Fit
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
