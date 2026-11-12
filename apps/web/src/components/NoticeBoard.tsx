import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export interface DailyNotice {
  audience: "ALUNO" | "PROFESSOR";
  noticeDate: string;
  message: string;
  automatic: boolean;
}

function formatNoticeDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

interface NoticeBoardProps {
  path: string;
  studentId?: string;
}

export default function NoticeBoard({ path, studentId }: NoticeBoardProps) {
  const [notice, setNotice] = useState<DailyNotice | null>(null);
  const [noticeDate, setNoticeDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<{ noticeDate: string; aviso: DailyNotice | null }>(path, {}, studentId)
      .then((data) => {
        if (!active) return;
        setNotice(data.aviso);
        setNoticeDate(data.noticeDate);
      })
      .catch(() => {
        if (!active) return;
        setNotice(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, studentId]);

  return (
    <section className="rounded-2xl border border-[#5B7595]/30 bg-[#E8EEF4] p-5">
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#5B7595]">
        Quadro de avisos
      </p>
      {loading ? (
        <p className="m-0 mt-3 text-sm text-slate-500">Carregando recado...</p>
      ) : notice ? (
        <>
          <p className="m-0 mt-3 text-xl font-semibold leading-snug text-[#2E496C]">
            {notice.message}
          </p>
          <p className="m-0 mt-3 text-xs text-slate-500">
            Recado de {formatNoticeDate(notice.noticeDate)}
            {notice.automatic ? " · mensagem do dia" : " · enviado pela academia"}
          </p>
        </>
      ) : (
        <p className="m-0 mt-3 text-sm text-slate-500">
          {noticeDate
            ? `Ainda não há recado para ${formatNoticeDate(noticeDate)}.`
            : "Ainda não há recado para hoje."}
        </p>
      )}
    </section>
  );
}
