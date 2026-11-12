import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { DailyNotice } from "../../components/NoticeBoard";
import OwnerSectionPage from "./OwnerSectionPage";

type Audience = "ALUNO" | "PROFESSOR";

interface AvisosResponse {
  noticeDate: string;
  avisos: Record<Audience, DailyNotice | null>;
}

const BOARDS: Array<{
  audience: Audience;
  title: string;
  placeholder: string;
  fallback: string;
}> = [
  {
    audience: "ALUNO",
    title: "Alunos",
    placeholder: "Recado de hoje para os alunos",
    fallback: "Bom treino!",
  },
  {
    audience: "PROFESSOR",
    title: "Professores",
    placeholder: "Recado de hoje para os professores",
    fallback: "Um bom dia de trabalho!",
  },
];

function formatNoticeDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export default function OwnerQuadroAvisosPage() {
  const [noticeDate, setNoticeDate] = useState("");
  const [drafts, setDrafts] = useState<Record<Audience, string>>({
    ALUNO: "",
    PROFESSOR: "",
  });
  const [automatic, setAutomatic] = useState<Record<Audience, boolean>>({
    ALUNO: false,
    PROFESSOR: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Audience | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResponse = useCallback((data: AvisosResponse) => {
    setNoticeDate(data.noticeDate);
    setDrafts({
      ALUNO: data.avisos.ALUNO?.message ?? "",
      PROFESSOR: data.avisos.PROFESSOR?.message ?? "",
    });
    setAutomatic({
      ALUNO: data.avisos.ALUNO?.automatic ?? false,
      PROFESSOR: data.avisos.PROFESSOR?.automatic ?? false,
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<AvisosResponse>("/owner/avisos")
      .then(applyResponse)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar o quadro de avisos."),
      )
      .finally(() => setLoading(false));
  }, [applyResponse]);

  useEffect(() => {
    load();
  }, [load]);

  async function publish(audience: Audience) {
    setSaving(audience);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string; aviso: DailyNotice }>("/owner/avisos", {
        method: "PUT",
        body: JSON.stringify({ audience, message: drafts[audience] }),
      });
      setDrafts((current) => ({ ...current, [audience]: result.aviso.message }));
      setAutomatic((current) => ({ ...current, [audience]: result.aviso.automatic }));
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao publicar o recado.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <OwnerSectionPage
      title="Quadro de avisos"
      description="Envie o recado do dia para os alunos e outro para os professores. Se o dia começar sem recado, à 00:01 entra a mensagem padrão."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : (
        <div className="space-y-4">
          {noticeDate ? (
            <p className="m-0 text-sm text-slate-500">Recado de {formatNoticeDate(noticeDate)}</p>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {BOARDS.map((board) => (
              <form
                key={board.audience}
                onSubmit={(event) => {
                  event.preventDefault();
                  void publish(board.audience);
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-[#2E496C]">{board.title}</p>
                  {automatic[board.audience] ? (
                    <span className="rounded-full bg-[#E8EEF4] px-2.5 py-1 text-[0.65rem] font-semibold text-[#2E496C]">
                      Mensagem padrão
                    </span>
                  ) : drafts[board.audience].trim() ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-700">
                      Enviado por você
                    </span>
                  ) : null}
                </div>
                <label className="mt-4 block text-xs text-slate-500">
                  Mensagem
                  <textarea
                    value={drafts[board.audience]}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [board.audience]: event.target.value,
                      }))
                    }
                    maxLength={400}
                    rows={4}
                    placeholder={board.placeholder}
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                  />
                </label>
                <p className="m-0 mt-2 text-[0.7rem] text-slate-400">
                  Sem recado às 00:01, todo mundo desta turma vê: {board.fallback}
                </p>
                <button
                  type="submit"
                  disabled={saving !== null}
                  className="mt-4 w-full rounded-xl bg-[#5B7595] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving === board.audience ? "Publicando..." : `Publicar para ${board.title.toLowerCase()}`}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </OwnerSectionPage>
  );
}
