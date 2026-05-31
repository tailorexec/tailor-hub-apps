import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Lock } from "lucide-react";
import logo from "@/assets/tailor-logo.png";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tailor Hub Apps" },
      { name: "description", content: "Central de aplicativos Tailor." },
    ],
  }),
  component: HubPage,
});

type AppTile = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  to?: string;
  available: boolean;
};

function HubPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const apps: AppTile[] = [
    {
      id: "cv",
      name: "Gerador de Currículo",
      description: "Crie currículos no padrão Tailor a partir dos seus dados.",
      icon: <FileText className="w-8 h-8" />,
      to: session ? "/" : "/login",
      available: true,
    },
  ];

  const handleClick = (app: AppTile) => {
    if (!app.available || !app.to) return;
    navigate({ to: app.to });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
          <img src={logo} alt="Tailor" className="h-8 md:h-9 w-auto" />
          <span className="hidden md:inline-flex items-center rounded-full border border-border px-4 py-1.5 text-[11px] font-bold tracking-[0.18em] text-foreground/80">
            TAILOR HUB APPS
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Tailor Hub Apps
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
            Selecione um aplicativo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => handleClick(app)}
              disabled={!app.available}
              className="group relative aspect-square rounded-2xl border border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-between"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {app.icon}
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{app.name}</div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                  {app.description}
                </p>
              </div>
              {!app.available && (
                <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lock className="w-3 h-3" /> Em breve
                </span>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
