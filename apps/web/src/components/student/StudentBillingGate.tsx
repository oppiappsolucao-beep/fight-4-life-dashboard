import { useEffect, useState, type ReactNode } from "react";
import { ApiError, apiFetch, type BillingScreenNotice } from "../../lib/api";
import { dismissBillingNotice, isBillingNoticeDismissed } from "../../lib/billingNotice";
import { clearStudentSession, getStudentSession } from "../../lib/studentSession";
import StudentBillingNoticeModal from "./StudentBillingNoticeModal";

const BLOCKED_MESSAGE = "Por favor entrar em contato com a academia.";

export default function StudentBillingGate({ children }: { children: ReactNode }) {
  const session = getStudentSession();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<BillingScreenNotice | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (!session?.id) {
      setChecking(false);
      return;
    }

    apiFetch<{ aviso: BillingScreenNotice | null }>("/student/aviso-fatura", {}, session.id)
      .then((data) => {
        const aviso = data.aviso;
        setNotice(aviso);
        setNoticeOpen(Boolean(aviso) && !isBillingNoticeDismissed(aviso!));
      })
      .catch((err) => {
        const blockedByBilling =
          (err instanceof ApiError && err.code === "BILLING_BLOCKED") ||
          (err instanceof Error && err.message.includes("contato com a academia"));
        if (!blockedByBilling) return;
        setBlocked(true);
        const aviso = err instanceof ApiError ? err.avisoFatura : undefined;
        if (aviso && !isBillingNoticeDismissed(aviso)) {
          setNotice(aviso);
          setNoticeOpen(true);
        }
      })
      .finally(() => setChecking(false));
  }, [session?.id]);

  function closeNotice() {
    if (notice) dismissBillingNotice(notice);
    setNoticeOpen(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Verificando acesso...
      </div>
    );
  }

  return (
    <>
      {blocked ? (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-8">
            <p className="m-0 text-lg font-semibold text-red-100">{BLOCKED_MESSAGE}</p>
            <p className="m-0 mt-3 text-sm text-red-700/80">
              Seu plano está vencido. Regularize na recepção para voltar a acessar o app.
            </p>
            <button
              type="button"
              onClick={() => {
                clearStudentSession();
                window.location.href = "/";
              }}
              className="mt-6 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Sair
            </button>
          </div>
        </div>
      ) : (
        children
      )}
      {noticeOpen && notice ? (
        <StudentBillingNoticeModal message={notice.message} onClose={closeNotice} />
      ) : null}
    </>
  );
}
