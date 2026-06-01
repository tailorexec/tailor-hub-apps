import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import logo from "@/assets/tailor-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const Route = createFileRoute("/nps/form")({
  head: () => ({
    meta: [
      { title: "Sua experiência Tailor" },
      { name: "description", content: "Pesquisa NPS Tailor — sua opinião é muito importante." },
    ],
  }),
  component: NpsFormPage,
});

const SCALE_7_LABELS = ["1", "2", "3", "4", "5", "6", "7"];
const SCALE_11 = Array.from({ length: 11 }, (_, i) => i);

function ScaleRow({
  value,
  onChange,
  options,
  leftLabel,
  rightLabel,
}: {
  value: number | null;
  onChange: (v: number) => void;
  options: (number | string)[];
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const num = Number(opt);
          const active = value === num;
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(num)}
              className={`min-w-[40px] h-10 px-2 rounded-md border text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NpsFormPage() {
  const [nome, setNome] = useState("");
  const [consultor, setConsultor] = useState("");
  const [contratado, setContratado] = useState<boolean | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [entendimento, setEntendimento] = useState<number | null>(null);
  const [atendimento, setAtendimento] = useState<number | null>(null);
  const [projeto, setProjeto] = useState<number | null>(null);
  const [comentarios, setComentarios] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contratado === null) {
      toast({ title: "Responda se foi contratado", variant: "destructive" });
      return;
    }
    if (npsScore === null) {
      toast({ title: "Dê uma nota de 0 a 10", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("nps_responses").insert({
      nome: nome.trim() || null,
      consultor: consultor.trim() || null,
      contratado,
      nps_score: npsScore,
      entendimento,
      atendimento,
      projeto,
      comentarios: comentarios.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full tailor-card text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#e7f5ec] border-[1.5px] border-[#1a6a35] flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-[#1a6a35]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Obrigado!</h1>
          <p className="text-sm text-muted-foreground">
            Sua resposta foi registrada. Agradecemos o seu tempo e seu feedback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-[820px] mx-auto px-6 h-20 flex items-center">
          <img src={logo} alt="Tailor" className="h-8 w-auto" />
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-foreground mb-3">Sua experiência Tailor</h1>
        <p className="text-sm text-muted-foreground mb-2">
          É um <strong>prazer contarmos com você</strong> em nossos processos e podermos fazer parte
          da sua trajetória profissional. Para que possamos melhorar e crescer cada vez mais,{" "}
          <strong>sua opinião é muito importante.</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          São só 4 perguntas rápidas (<strong>não leva mais que 5 minutos</strong>), apuradas de{" "}
          <strong>forma sigilosa</strong> e os dados tratados coletivamente e atemporalmente,{" "}
          <strong>sem identificação do respondente</strong> (se desejar).
        </p>

        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="tailor-card space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Nome <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={255}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="tailor-card space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Consultor(a)(es) Tailor que te atenderam{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={consultor}
              onChange={(e) => setConsultor(e.target.value)}
              maxLength={255}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="tailor-card space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Você foi o(a) candidato(a) contratado(a) ao final? *
            </label>
            <div className="flex gap-2">
              {[
                { label: "Sim", v: true },
                { label: "Não", v: false },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setContratado(opt.v)}
                  className={`px-5 py-2 rounded-md border text-sm font-semibold transition-colors ${
                    contratado === opt.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tailor-card space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              1 — Em uma escala de 0 a 10, o quanto você indicaria a Tailor a um amigo ou familiar? *
            </label>
            <ScaleRow
              value={npsScore}
              onChange={setNpsScore}
              options={SCALE_11}
              leftLabel="Nada provável"
              rightLabel="Muito provável"
            />
          </div>

          <div className="tailor-card space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              2 — Em uma escala de 1 a 7, qual o seu nível de concordância:
            </label>
            <p className="text-sm text-muted-foreground">
              O Consultor da Tailor demonstrou grande entendimento da minha carreira, atuação,
              momento profissional e objetivos profissionais.
            </p>
            <ScaleRow
              value={entendimento}
              onChange={setEntendimento}
              options={SCALE_7_LABELS}
              leftLabel="Discordo Fortemente"
              rightLabel="Concordo Fortemente"
            />
          </div>

          <div className="tailor-card space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              3 — Em uma escala de 1 a 7, qual o seu nível de concordância:
            </label>
            <p className="text-sm text-muted-foreground">
              O Consultor da Tailor me atendeu de forma encantadora, com disponibilidade, simpatia e
              atenção em todos os contatos.
            </p>
            <ScaleRow
              value={atendimento}
              onChange={setAtendimento}
              options={SCALE_7_LABELS}
              leftLabel="Discordo Fortemente"
              rightLabel="Concordo Fortemente"
            />
          </div>

          <div className="tailor-card space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              4 — Em uma escala de 1 a 7, qual o seu nível de concordância:
            </label>
            <p className="text-sm text-muted-foreground">
              O Consultor da Tailor me apresentou um projeto atrativo, alinhado à minha expectativa
              e me manteve constantemente informado sobre ele.
            </p>
            <ScaleRow
              value={projeto}
              onChange={setProjeto}
              options={SCALE_7_LABELS}
              leftLabel="Discordo Fortemente"
              rightLabel="Concordo Fortemente"
            />
          </div>

          <div className="tailor-card space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Comentários adicionais e feedbacks
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[8px] bg-primary text-primary-foreground px-6 py-3 text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Enviar resposta
          </button>
        </form>
      </main>
    </div>
  );
}
