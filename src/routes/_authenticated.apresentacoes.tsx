import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, ShieldAlert } from "lucide-react";

import TailorFooter from "@/components/TailorFooter";
import TailorHeader from "@/components/TailorHeader";
import { MolduraPreview } from "@/components/hub/AppPreview";
import { SlidePreview, type SlideId } from "@/components/hub/SlidePreview";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/apresentacoes")({
  head: () => ({
    meta: [{ title: "Apresentações Padrão Tailor 2026" }],
  }),
  component: ApresentacoesPage,
});

// Os links abrem o ORIGINAL no Canva. Desde 09/10/2026 o compartilhamento é só
// de visualização, mas o aviso de "faça uma cópia" continua antes dos cards:
// quem chega com pressa clica no primeiro que vê.
const APRESENTACOES: { id: SlideId; nome: string; descricao: string; url: string }[] = [
  {
    id: "comercial",
    nome: "Comercial",
    descricao: "Para a primeira reunião com o cliente: quem é a Tailor e como trabalhamos.",
    url: "https://canva.link/apresentacao-comercial-tailor-2026",
  },
  {
    id: "kickoff",
    nome: "Kickoff",
    descricao: "Para abrir o projeto com o cliente: escopo, perfil da posição e cronograma.",
    url: "https://canva.link/kickoff-padrao-tailor-2026",
  },
  {
    id: "status",
    nome: "Status",
    descricao: "Para as reuniões de acompanhamento: andamento do processo e próximos passos.",
    url: "https://canva.link/status-padrao-tailor-2026",
  },
  {
    id: "shortlist",
    nome: "Shortlist",
    descricao: "Para apresentar ao cliente os candidatos finalistas.",
    url: "https://canva.link/shortlist-padrao-tailor-2026",
  },
];

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

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao hub
        </button>

        <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
          Apresentações Padrão Tailor 2026
        </h1>

        {/* Uma linha só no desktop, do tamanho do texto. No celular quebra em
            vez de cortar: cortado, o aviso perderia justamente o "faça uma cópia". */}
        <div
          role="alert"
          className="mt-5 md:mt-6 flex w-fit max-w-full items-start md:items-center gap-2.5 rounded-xl border border-primary/50 bg-primary/5 px-4 py-2.5"
        >
          <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5 md:mt-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Nunca edite o original.</strong> Faça sempre uma
            cópia para o seu Canva e edite só a cópia — o passo a passo está logo abaixo.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {APRESENTACOES.map(({ id, nome, descricao, url }) => (
            <a
              key={id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col"
            >
              <MolduraPreview>
                <SlidePreview id={id} />
              </MolduraPreview>
              <div className="flex flex-1 flex-col p-4">
                <div className="truncate text-[15px] font-bold leading-6 text-foreground">
                  {nome}
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-3">
                  {descricao}
                </p>
                <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Abrir no Canva
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </a>
          ))}
        </div>

        <section className="mt-10 md:mt-14">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Como fazer a sua cópia
          </h2>
          <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="rounded-2xl border border-border bg-card p-4">
                <span className="text-3xl font-black leading-none text-primary">{i + 1}</span>
                <div className="mt-3 text-[15px] font-bold leading-6 text-foreground">
                  {passo.titulo}
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{passo.texto}</p>
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
