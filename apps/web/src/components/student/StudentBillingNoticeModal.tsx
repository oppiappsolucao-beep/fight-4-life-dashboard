import { useEffect } from "react";
import { createPortal } from "react-dom";

interface StudentBillingNoticeModalProps {
  message: string;
  onClose: () => void;
}

export default function StudentBillingNoticeModal({
  message,
  onClose,
}: StudentBillingNoticeModalProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-notice-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <p
          id="billing-notice-title"
          className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#5B7595]"
        >
          Aviso da academia
        </p>
        <p className="m-0 mt-3 text-base leading-relaxed text-[#2E496C]">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#5B7595] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2E496C]"
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body,
  );
}
