import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../../lib/api";
import { clearStudentSession, getStudentSession } from "../../lib/studentSession";

const BLOCKED_MESSAGE = "Por favor entrar em contato com a academia.";

export default function StudentBillingGate({ children }: { children: ReactNode }) {
  const session = getStudentSession();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!session?.id) {
      setChecking(false);
      return;
    }

    apiFetch("/student/treino-modalidades", {}, session.id)
      .catch((err) => {
        if (err instanceof Error && err.message.includes("contato com a academia")) {
          setBlocked(true);
        }
      })
      .finally(() => setChecking(false));
  }, [session?.id]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/50">
        Verificando acesso...
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-8">
          <p className="m-0 text-lg font-semibold text-red-100">{BLOCKED_MESSAGE}</p>
          <p className="m-0 mt-3 text-sm text-red-200/80">
            Seu plano está vencido. Regularize na recepção para voltar a acessar o app.
          </p>
          <button
            type="button"
            onClick={() => {
              clearStudentSession();
              window.location.href = "/";
            }}
            className="mt-6 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
