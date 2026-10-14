import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/tailor-logo.png";
import { AppPreview, type PreviewId } from "@/components/hub/AppPreview";
import { AvisosFaixa } from "@/components/hub/AvisosFaixa";
import { BlogRecente } from "@/components/hub/BlogRecente";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Tailor Hub Apps" },
      { name: "description", content: "Central de aplicativos Tailor." },
    ],
  }),
  component: HubPage,
});

type AppTile = {
  id: PreviewId;
  /** Curto de propósito: o título do card cabe numa linha só. */
  name: string;
  description: string;
  /** Rota do hub ("/tpm") ou endereço de fora (TailorBoard). */
  href: string;
};

const APPS: AppTile[] = [
  {
    id: "cv",
    name: "Gerador de Currículo",
    description: "Crie currículos no padrão Tailor a partir dos seus dados.",
    href: "/generator",
  },
  {
    id: "apresentacoes",
    name: "Apresentações 2026",
    description:
      "Comercial, propostas, kickoff, status e shortlist: os modelos padrão da Tailor no Canva.",
    href: "/apresentacoes",
  },
  {
    id: "tpm",
    name: "TPM Pré-Reunião",
    description: "Briefing estratégico antes da reunião, com pesquisa e cases Tailor.",
    href: "/tpm",
  },
  {
    id: "nps",
    name: "NPS",
    description: "Dashboard e formulário de pesquisa de experiência (NPS).",
    href: "/nps",
  },
  {
    id: "board",
    name: "TailorBoard",
    description: "Dashboard de gestão de vagas: posições, placements, backouts e metas.",
    href: "https://tailorboard.tailorexec.com.br",
  },
];

function HubPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 h-16 md:h-20 flex items-center justify-between">
          <img src={logo} alt="Tailor" className="h-7 md:h-9 w-auto" />
          <span className="hidden md:inline-flex items-center rounded-full border border-border px-4 py-1.5 text-[11px] font-bold tracking-[0.18em] text-foreground/80">
            TAILOR HUB APPS
          </span>
        </div>
      </header>

      <AvisosFaixa />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
        <div className="mb-6 md:mb-10">
          <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
            Tailor Hub Apps
          </h1>
          <p className="mt-1.5 md:mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
            Selecione um aplicativo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
            {APPS.map((app) => (
              // Todo card abre em nova aba, de propósito: o hub fica aberto
              // como ponto de partida. A sessão vale na aba nova também.
              <a
                key={app.id}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col"
              >
                <AppPreview id={app.id} />
                <div className="p-4">
                  <div
                    className="truncate text-[15px] font-bold leading-6 text-foreground"
                    title={app.name}
                  >
                    {app.name}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-3">
                    {app.description}
                  </p>
                </div>
              </a>
            ))}
          </div>

          <aside>
            <BlogRecente />
          </aside>
        </div>
      </main>
    </div>
  );
}
