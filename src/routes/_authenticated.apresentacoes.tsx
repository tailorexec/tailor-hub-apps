import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Copy,
  ExternalLink,
  ListChecks,
  Rocket,
  ShieldAlert,
} from "lucide-react";

import TailorFooter from "@/components/TailorFooter";
import TailorHeader from "@/components/TailorHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/apresentacoes")({
  head: () => ({
    meta: [{ title: "Apresentações Padrão Tailor 2026" }],
  }),
  component: ApresentacoesPage,
});

// Os links abrem o ORIGINAL no Canva, em modo de edição. Por isso o aviso de
// "faça uma cópia" vem antes dos botões, e não depois: quem chega aqui com
// pressa clica no primeiro botão que vê.
const APRESENTACOES = [
  {
    id: "comercial",
    nome: "Apresentação Comercial",
    descricao: "Para a primeira reunião com o cliente: quem é a Tailor e como trabalhamos.",
    icone: Briefcase,
    url: "https://canva.link/apresentacao-comercial-tailor-2026",
  },
  {
    id: "kickoff",
    nome: "Kickoff",
    descricao: "Para abrir o projeto com o cliente: escopo, perfil da posição e cronograma.",
    icone: Rocket,
    url: "https://canva.link/kickoff-padrao-tailor-2026",
  },
  {
    id: "status",
    nome: "Status",
    descricao: "Para as reuniões de acompanhamento: andamento do processo e próximos passos.",
    icone: ClipboardList,
    url: "https://canva.link/status-padrao-tailor-2026",
  },
  {
    id: "shortlist",
    nome: "Shortlist",
    descricao: "Para apresentar ao cliente os candidatos finalistas.",
    icone: ListChecks,
    url: "https://canva.link/shortlist-padrao-tailor-2026",
  },
] as const;

const PASSOS = [
  {
    titulo: "Abra a apresentação",
    texto: "Clique em “Abrir no Canva” no modelo que você precisa. Ele abre numa nova aba.",
  },
  {
    titulo: "Faça a sua cópia",
    texto: "No menu do Canva, vá em Arquivo → Fazer uma cópia. Não digite nada antes disso.",
  },
  {
    titulo: "Confira e renomeie",
    texto:
      "A cópia abre com o nome “Cópia de …”. Confira o título no topo e renomeie com o nome do cliente.",
  },
  {
    titulo: "Edite só a cópia",
    texto: "Pronto: a cópia é sua e fica em Projetos, no seu Canva. Pode editar à vontade.",
  },
] as const;

function ApresentacoesPage() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader
        userEmail={profile?.email}
        isAdmin={isAdmin}
        onAdmin={() => navigate({ to: "/admin" })}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      />

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 md:px-6 py-8 md:py-10">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao hub
        </button>

        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Apresentações Padrão Tailor 2026
        </h1>
        <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
          Os modelos oficiais da Tailor no Canva. Use sempre estes como ponto de partida para manter
          o padrão visual em todos os clientes.
        </p>

        <div
          role="alert"
          className="mt-6 flex gap-4 rounded-2xl border-[1.5px] border-primary/50 bg-primary/5 p-5"
        >
          <ShieldAlert className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">Nunca edite o original.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os botões abaixo abrem o arquivo oficial, que é o mesmo para toda a equipe. Qualquer
              alteração feita nele aparece para todo mundo.{" "}
              <strong>Antes de mexer em qualquer coisa, faça uma cópia para o seu Canva</strong> — o
              passo a passo está logo abaixo.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {APRESENTACOES.map(({ id, nome, descricao, icone: Icone, url }) => (
            <div
              key={id}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-5 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icone className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{nome}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
                </div>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Abrir no Canva <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Copy className="w-5 h-5 text-primary" /> Como fazer a sua cópia
          </h2>
          <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="rounded-2xl border border-border bg-card p-5">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {i + 1}
                </span>
                <div className="mt-3 font-bold text-foreground">{passo.titulo}</div>
                <p className="mt-1 text-sm text-muted-foreground">{passo.texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Mexeu no original sem querer?</strong> Desfaça na
            hora com Ctrl+Z e avise o administrador do hub, mesmo que pareça ter dado certo.
          </p>
        </section>
      </main>

      <TailorFooter />
    </div>
  );
}
