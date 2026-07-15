import { useState } from "react";
import { Link } from "react-router-dom";
import DevAcademiaEditModal from "../../components/dev/DevAcademiaEditModal";
import DevAcademiaDeleteButton from "../../components/dev/DevAcademiaDeleteButton";
import { useDevAcademias, type DevAcademia } from "../../hooks/useDevAcademias";
import DevSectionPage from "./DevSectionPage";

export default function DevDonosAcademiasPage() {
  const { academias, loading, error, reload } = useDevAcademias();
  const [editingAcademia, setEditingAcademia] = useState<DevAcademia | null>(null);

  return (
    <DevSectionPage
      title="Donos de Academias"
      description="Visualize, edite os dados das academias e gerencie o acesso do dono em /dono/login."
    >
      <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        <strong>Como o dono entra:</strong> use o e-mail abaixo em{" "}
        <Link to="/dono/login" className="font-semibold text-[#e85d6f] hover:underline">
          /dono/login
        </Link>{" "}
        com a senha definida no cadastro. Clique em <strong>Editar</strong> para alterar dados ou redefinir a senha.
      </div>

      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando academias...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && academias.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/60">Nenhuma academia cadastrada ainda.</p>
          <Link
            to="/dev/cadastro-academias"
            className="mt-4 inline-block text-sm font-medium text-[#e85d6f] hover:underline"
          >
            Cadastrar primeira academia →
          </Link>
        </div>
      )}

      {!loading && !error && academias.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[0.65rem] font-semibold uppercase tracking-wide text-white/50">
                  <th className="px-5 py-3">Academia</th>
                  <th className="px-5 py-3">E-mail de login (dono)</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {academias.map((academia) => (
                  <tr key={academia.id} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{academia.name}</p>
                      <p className="mt-0.5 text-xs text-white/40">{academia.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      {academia.owner ? (
                        <code className="rounded bg-black/30 px-2 py-1 text-[0.8rem] text-emerald-300">
                          {academia.owner.email}
                        </code>
                      ) : (
                        <span className="text-white/40">Sem dono cadastrado</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-white/70">
                      {academia.owner?.name ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={academia.active && (academia.owner?.active ?? false)} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingAcademia(academia)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-[0.72rem] font-medium text-white/80 transition hover:border-[#e85d6f]/50 hover:text-[#e85d6f]"
                        >
                          Editar
                        </button>
                        <DevAcademiaDeleteButton
                          academiaId={academia.id}
                          academiaName={academia.name}
                          onDeleted={reload}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingAcademia && (
        <DevAcademiaEditModal
          academiaId={editingAcademia.id}
          academiaName={editingAcademia.name}
          onClose={() => setEditingAcademia(null)}
          onSaved={reload}
        />
      )}
    </DevSectionPage>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-red-500/15 text-red-300"
      }`}
    >
      {active ? "Ativo" : "Bloqueado"}
    </span>
  );
}
