// Miniaturas dos cards da página inicial.
//
// Desenhadas em código, não prints: as telas reais do TPM e do NPS mostram
// dados de clientes, e um print envelhece a cada mudança no app. Aqui cada
// miniatura só sugere o que o app faz — e fica nítida em qualquer tela.
//
// O fundo escuro com brilho vermelho é o mesmo do topo do gerador
// (TailorHero), para os cards parecerem parte da mesma marca.

import type { ReactNode } from "react";

export type PreviewId = "cv" | "nps" | "tpm" | "apresentacoes";

export function AppPreview({ id }: { id: PreviewId }) {
  return (
    <MolduraPreview>
      {id === "cv" && <Curriculo />}
      {id === "nps" && <Nps />}
      {id === "tpm" && <Briefing />}
      {id === "apresentacoes" && <Slides />}
    </MolduraPreview>
  );
}

/**
 * Metade de cima de um card: fundo escuro, brilho vermelho e a miniatura no
 * centro, que sobe um pouco no hover. O card que a usa precisa ter `group`.
 */
export function MolduraPreview({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative h-36 sm:h-40 overflow-hidden bg-[#0a0a0a] flex items-center justify-center"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-16 mx-auto h-32 w-4/5 rounded-[100%] blur-2xl opacity-50 transition-opacity group-hover:opacity-80"
        style={{
          background: "radial-gradient(closest-side, oklch(0.58 0.22 25 / 0.7), transparent)",
        }}
      />
      <div className="relative transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03]">
        {children}
      </div>
    </div>
  );
}

export const Linha = ({ w, className = "bg-neutral-200" }: { w: string; className?: string }) => (
  <div className={`h-1.5 rounded-full ${className}`} style={{ width: w }} />
);

/** Folha de currículo saindo do PDF para o Word. */
function Curriculo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-[72px] rounded-md bg-white/10 border border-white/15 flex flex-col items-center justify-center gap-1">
        <span className="text-[9px] font-bold text-white/60">PDF</span>
        <Linha w="60%" className="bg-white/20" />
        <Linha w="45%" className="bg-white/20" />
      </div>
      <span className="text-primary text-lg font-bold">→</span>
      <div className="w-[92px] h-[118px] rounded-md bg-white shadow-xl p-2.5 flex flex-col gap-1.5 rotate-2">
        <div className="h-2 w-3/4 rounded-sm bg-neutral-900" />
        <Linha w="50%" className="bg-primary" />
        <div className="mt-1 space-y-1">
          <Linha w="100%" />
          <Linha w="85%" />
          <Linha w="92%" />
        </div>
        <Linha w="40%" className="bg-neutral-400" />
        <div className="space-y-1">
          <Linha w="95%" />
          <Linha w="70%" />
        </div>
        <span className="mt-auto self-end rounded bg-primary px-1 text-[7px] font-bold text-white">
          DOCX
        </span>
      </div>
    </div>
  );
}

/** Painel com a nota e a distribuição de respostas. */
function Nps() {
  const barras = [30, 45, 38, 60, 72, 85];
  return (
    <div className="w-[170px] rounded-lg bg-white shadow-xl p-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">NPS</div>
          <div className="text-2xl font-black leading-none text-neutral-900">72</div>
        </div>
        <div className="flex items-end gap-1 h-10">
          {barras.map((h, i) => (
            <div
              key={i}
              className={`w-2 rounded-sm ${i === barras.length - 1 ? "bg-primary" : "bg-neutral-300"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full">
        <div className="w-[70%] bg-emerald-500" />
        <div className="w-[18%] bg-amber-400" />
        <div className="w-[12%] bg-primary" />
      </div>
      <div className="mt-1.5 flex justify-between text-[7px] font-semibold text-neutral-400">
        <span>Promotores</span>
        <span>Detratores</span>
      </div>
    </div>
  );
}

/** Briefing com busca e fontes. */
function Briefing() {
  return (
    <div className="w-[170px] rounded-lg bg-white shadow-xl p-3 space-y-2">
      <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-1">
        <div className="h-2 w-2 rounded-full border-[1.5px] border-neutral-500" />
        <Linha w="60%" className="bg-neutral-300" />
      </div>
      {[80, 65, 72].map((w, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="h-3 w-3 shrink-0 rounded-full bg-primary/15 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
          <Linha w={`${w}%`} />
          <span className="ml-auto rounded bg-neutral-100 px-1 text-[6px] font-bold text-neutral-500">
            FONTE
          </span>
        </div>
      ))}
    </div>
  );
}

/** Pilha de slides do Canva. */
function Slides() {
  return (
    <div className="relative w-[180px] h-[104px]">
      <div className="absolute left-6 top-0 w-[150px] h-[84px] rounded-md bg-white/15 border border-white/10 -rotate-6" />
      <div className="absolute left-3 top-2 w-[150px] h-[84px] rounded-md bg-white/30 -rotate-3" />
      <div className="absolute left-0 top-4 w-[150px] h-[84px] rounded-md bg-white shadow-xl overflow-hidden flex">
        <div className="w-[38%] bg-neutral-900 p-2 flex flex-col justify-end gap-1">
          <Linha w="80%" className="bg-primary" />
          <Linha w="60%" className="bg-white/40" />
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          <div className="h-2 w-3/4 rounded-sm bg-neutral-800" />
          <Linha w="90%" />
          <Linha w="70%" />
          <Linha w="80%" />
        </div>
      </div>
    </div>
  );
}
