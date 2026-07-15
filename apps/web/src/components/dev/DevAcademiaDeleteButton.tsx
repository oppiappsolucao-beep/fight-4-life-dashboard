import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { notifyDevAcademiasChanged } from "../../lib/devAcademias";

interface DevAcademiaDeleteButtonProps {
  academiaId: string;
  academiaName: string;
  onDeleted?: () => void;
}

export default function DevAcademiaDeleteButton({
  academiaId,
  academiaName,
  onDeleted,
}: DevAcademiaDeleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Excluir permanentemente a academia "${academiaName}"?\n\nIsso remove o cadastro, o acesso do dono e os dados vinculados. Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      await apiFetch(`/dev/academias/${academiaId}`, { method: "DELETE" });
      notifyDevAcademiasChanged();
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir academia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg border border-red-400/30 px-3 py-1.5 text-[0.72rem] font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 disabled:opacity-50"
      >
        {loading ? "Excluindo..." : "Excluir"}
      </button>
      {error && <span className="text-[0.65rem] text-red-300">{error}</span>}
    </div>
  );
}
