import { FormEvent, useState } from "react";

interface StudentAreaModalProps {
  open: boolean;
  onClose: () => void;
  onContinue?: (identifier: string) => void;
}

export default function StudentAreaModal({
  open,
  onClose,
  onContinue,
}: StudentAreaModalProps) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError("Informe CPF, e-mail ou ID cadastrado.");
      return;
    }

    onContinue?.(value);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="m-0 text-[0.95rem] font-bold uppercase tracking-wide text-white">
            Área de Aluno
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-white/40 transition hover:text-white/70"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-4 py-2 text-white">
              <MailIcon />
              <span className="text-[0.75rem] font-semibold uppercase tracking-wide">
                E-mail/CPF
              </span>
            </div>
          </div>

          <p className="mb-3 text-center text-[0.72rem] text-[#8f8f8f]">
            Informe CPF (CIN), e-mail ou ID cadastrados
          </p>

          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="CPF, e-mail ou ID"
            className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
          />

          {error && (
            <p className="mb-2 text-center text-[0.75rem] text-red-300/90">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105"
            >
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}
