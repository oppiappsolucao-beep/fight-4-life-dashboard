import { FormEvent, useEffect, useState } from "react";

type YesNo = "" | "sim" | "nao";

const QUESTIONS = [
  {
    id: "q1",
    text: "Algum médico já disse que você possui um problema de coração e que só deveria realizar atividade física supervisionada?",
  },
  {
    id: "q2",
    text: "Você sente dores no peito quando pratica atividade física?",
  },
  {
    id: "q3",
    text: "No último mês, você sentiu dores no peito quando praticava atividade física?",
  },
  {
    id: "q4",
    text: "Você perde o equilíbrio devido a tonturas ou alguma vez perdeu a consciência?",
  },
  {
    id: "q5",
    text: "Você possui algum problema ósseo ou articular (por exemplo, nas costas, joelho ou quadril) que poderia piorar com a atividade física?",
  },
  {
    id: "q6",
    text: "Um médico já lhe receitou medicamentos para pressão arterial ou coração?",
  },
  {
    id: "q7",
    text: "Você tem conhecimento de qualquer outra razão pela qual não deva praticar atividade física sem supervisão médica?",
  },
] as const;

type QuestionId = (typeof QUESTIONS)[number]["id"];

const INITIAL_ANSWERS = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, ""]),
) as Record<QuestionId, YesNo>;

interface AcceptanceRecord {
  data: string;
  hora: string;
  ip: string;
}

export default function StudentTermoSaudeForm() {
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [alergia, setAlergia] = useState("");
  const [cirurgia, setCirurgia] = useState("");
  const [historicoFamiliar, setHistoricoFamiliar] = useState("");
  const [gravida, setGravida] = useState(false);
  const [termoAceito, setTermoAceito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptance, setAcceptance] = useState<AcceptanceRecord | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("termoSaudeAceite");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data.data && data.hora) {
        setAcceptance({ data: data.data, hora: data.hora, ip: data.ip ?? "—" });
      }
    } catch {
      /* ignore */
    }
  }, []);

  function setAnswer(id: QuestionId, value: YesNo) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError("");
  }

  async function fetchIp(): Promise<string> {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) return "Não disponível";
      const data = await response.json();
      return data.ip ?? "Não disponível";
    } catch {
      return "Não disponível";
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const unanswered = QUESTIONS.find((q) => !answers[q.id]);
    if (unanswered) {
      setError("Responda todas as perguntas com Sim ou Não.");
      return;
    }
    if (!termoAceito) {
      setError("Você precisa aceitar o termo de responsabilidade.");
      return;
    }

    setLoading(true);
    const ip = await fetchIp();
    const now = new Date();

    const record: AcceptanceRecord = {
      data: now.toLocaleDateString("pt-BR"),
      hora: now.toLocaleTimeString("pt-BR"),
      ip,
    };

    sessionStorage.setItem(
      "termoSaudeAceite",
      JSON.stringify({ ...record, answers, alergia, cirurgia, historicoFamiliar, gravida }),
    );

    setAcceptance(record);
    setLoading(false);
  }

  if (acceptance) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 backdrop-blur-sm">
          <p className="text-sm font-semibold text-emerald-300">
            Termo assinado e aceito com sucesso!
          </p>
          <p className="mt-2 text-sm text-white/70">
            Seu aceite eletrônico foi registrado para validade jurídica.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.08rem] text-white/50">
            Registro de assinatura digital
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Data</dt>
              <dd className="font-medium text-white">{acceptance.data}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Hora</dt>
              <dd className="font-medium text-white">{acceptance.hora}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">IP do dispositivo</dt>
              <dd className="font-medium text-white">{acceptance.ip}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm md:p-6">
        <h2 className="mb-5 border-b border-white/10 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-white">
          Questionário PAR-Q
        </h2>
        <div className="space-y-5">
          {QUESTIONS.map((question, index) => (
            <div
              key={question.id}
              className="rounded-lg border border-white/10 bg-black/20 p-4"
            >
              <p className="text-[0.82rem] leading-relaxed text-white/90">
                <span className="mr-1 font-semibold text-[#e85d6f]">{index + 1}.</span>
                {question.text}
              </p>
              <div className="mt-3 flex gap-3">
                <YesNoButton
                  label="Sim"
                  selected={answers[question.id] === "sim"}
                  onClick={() => setAnswer(question.id, "sim")}
                />
                <YesNoButton
                  label="Não"
                  selected={answers[question.id] === "nao"}
                  onClick={() => setAnswer(question.id, "nao")}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm md:p-6">
        <h2 className="mb-5 border-b border-white/10 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-white">
          Informações Complementares
        </h2>
        <p className="mb-4 text-[0.65rem] text-white/40">Opcional, mas recomendado.</p>
        <div className="space-y-4">
          <Field label="Possui alguma alergia? Se sim, qual?">
            <Textarea
              value={alergia}
              onChange={(e) => setAlergia(e.target.value)}
              placeholder="Ex: lactose, amendoim..."
            />
          </Field>
          <Field label="Passou por alguma cirurgia recente? (últimos 6 a 12 meses)">
            <Textarea
              value={cirurgia}
              onChange={(e) => setCirurgia(e.target.value)}
              placeholder="Descreva se aplicável"
            />
          </Field>
          <Field label="Histórico familiar relevante?">
            <Textarea
              value={historicoFamiliar}
              onChange={(e) => setHistoricoFamiliar(e.target.value)}
              placeholder="Ex: infarto fulminante, diabetes..."
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <input
              type="checkbox"
              checked={gravida}
              onChange={(e) => setGravida(e.target.checked)}
              className="h-4 w-4 accent-[#e85d6f]"
            />
            <span className="text-[0.82rem] text-white/90">Está grávida?</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm md:p-6">
        <h2 className="mb-5 border-b border-white/10 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-white">
          Termo de Responsabilidade
        </h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={termoAceito}
            onChange={(e) => setTermoAceito(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#e85d6f]"
            required
          />
          <span className="text-[0.82rem] leading-relaxed text-white/80">
            Declaro que as informações acima são verdadeiras e assumo total
            responsabilidade por omitir qualquer condição médica preexistente.
            <span className="text-[#e85d6f]"> *</span>
          </span>
        </label>
        <p className="mt-4 text-[0.65rem] text-white/40">
          Ao assinar, seu aceite eletrônico será registrado com data, hora e IP do
          dispositivo para validade jurídica.
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {loading ? "Registrando..." : "Assinar e Aceitar"}
      </button>
    </form>
  );
}

function YesNoButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[72px] rounded-lg px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-wide transition ${
        selected
          ? "bg-gradient-to-r from-[#e85d6f] to-[#d44d62] text-white"
          : "border border-white/15 bg-black/20 text-white/60 hover:border-[#e85d6f]/40 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
        {label}
      </span>
      {children}
    </label>
  );
}

const textareaClass =
  "w-full resize-none rounded-lg border border-white/20 bg-white px-3 py-2.5 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15";

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={textareaClass} />;
}
