// Miniaturas dos quatro modelos da página de Apresentações Padrão.
//
// Cada uma é um slide 16:9 que sugere o tipo de apresentação — capa, linha do
// tempo, andamento, candidatos —, no mesmo traço das miniaturas da página
// inicial (AppPreview). Não são prints dos modelos do Canva: o modelo muda a
// cada ano e o desenho não precisaria mudar junto.
import type { ReactNode } from "react";

import { Linha } from "./AppPreview";

export type SlideId = "comercial" | "kickoff" | "status" | "shortlist";

export function SlidePreview({ id }: { id: SlideId }) {
  return (
    <Slide>
      {id === "comercial" && <Comercial />}
      {id === "kickoff" && <Kickoff />}
      {id === "status" && <Status />}
      {id === "shortlist" && <Shortlist />}
    </Slide>
  );
}

function Slide({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[190px]">
      <div className="absolute inset-x-3 -top-2 h-full rounded-md bg-white/15" />
      <div className="relative w-[190px] h-[107px] rounded-md bg-white shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** Capa institucional. */
function Comercial() {
  return (
    <div className="flex h-full">
      <div className="w-[45%] bg-neutral-900 p-3 flex flex-col justify-between">
        <span className="text-[9px] font-black tracking-[0.2em] text-white">TAILOR</span>
        <div className="space-y-1">
          <Linha w="85%" className="bg-primary" />
          <Linha w="60%" className="bg-white/40" />
        </div>
      </div>
      <div className="flex-1 p-3 flex flex-col justify-center gap-1.5">
        <div className="h-2 w-4/5 rounded-sm bg-neutral-800" />
        <Linha w="95%" />
        <Linha w="75%" />
        <Linha w="85%" />
      </div>
    </div>
  );
}

/** Linha do tempo do projeto. */
function Kickoff() {
  return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-2 w-1/2 rounded-sm bg-neutral-800" />
      <div className="relative mt-auto mb-4">
        <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-neutral-200" />
        <div className="absolute left-1 top-1/2 h-0.5 w-1/3 -translate-y-1/2 bg-primary" />
        <div className="relative flex justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  i <= 1 ? "border-primary bg-primary" : "border-neutral-300 bg-white"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between px-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-7 space-y-1">
            <Linha w="100%" className="bg-neutral-300" />
            <Linha w="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Andamento das etapas. */
function Status() {
  const etapas = [100, 72, 40];
  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="h-2 w-2/5 rounded-sm bg-neutral-800" />
        <span className="rounded bg-primary/10 px-1 text-[7px] font-bold text-primary">
          SEMANA 3
        </span>
      </div>
      <div className="mt-auto space-y-2">
        {etapas.map((pct, i) => (
          <div key={i} className="flex items-center gap-2">
            <Linha w="22%" className="bg-neutral-300" />
            <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${pct === 100 ? "bg-neutral-800" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Finalistas lado a lado. */
function Shortlist() {
  return (
    <div className="p-3 h-full flex flex-col">
      <div className="h-2 w-2/5 rounded-sm bg-neutral-800" />
      <div className="mt-auto flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-md border p-1.5 flex flex-col items-center gap-1 ${
              i === 0 ? "border-primary" : "border-neutral-200"
            }`}
          >
            <div className={`h-5 w-5 rounded-full ${i === 0 ? "bg-primary" : "bg-neutral-300"}`} />
            <Linha w="90%" className="bg-neutral-300" />
            <Linha w="65%" />
          </div>
        ))}
      </div>
    </div>
  );
}
