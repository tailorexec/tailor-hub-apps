import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Check, X, ShieldX, ArrowLeft } from "lucide-react";
import TailorHeader from "@/components/TailorHeader";
import TailorFooter from "@/components/TailorFooter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ProfileStatus = "pending" | "approved" | "rejected";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  /** Permissão do HUB. `profiles.status` é do site (autor do blog). */
  hub_status: ProfileStatus;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { profile, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileStatus>("pending");
  const [period, setPeriod] = useState<7 | 30 | 90 | 0>(30);
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,hub_status,created_at")
      .order("created_at", { ascending: false });
    setFetching(false);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      return;
    }
    setProfiles((data ?? []) as ProfileRow[]);
  };

  const loadGenerations = async () => {
    let query = supabase.from("generations").select("user_id,created_at");
    if (period > 0) {
      const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }
    const { data, error } = await query.limit(10000);
    if (error) {
      toast({ title: "Erro ao carregar gerações", description: error.message, variant: "destructive" });
      return;
    }
    const counts: Record<string, number> = {};
    (data ?? []).forEach((g: { user_id: string }) => {
      counts[g.user_id] = (counts[g.user_id] ?? 0) + 1;
    });
    setGenCounts(counts);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadGenerations();
  }, [isAdmin, period]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TailorHeader
          userEmail={profile?.email}
          isAdmin={false}
          onSignOut={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        />
        <main className="flex-1 w-full max-w-[640px] mx-auto px-4 py-16">
          <div className="tailor-card text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#fff5f5] border-[1.5px] border-[#f09090] flex items-center justify-center mb-4">
              <ShieldX className="w-5 h-5 text-[#8a1a1a]" />
            </div>
            <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">Esta página é exclusiva para administradores.</p>
          </div>
        </main>
        <TailorFooter />
      </div>
    );
  }

  const updateStatus = async (id: string, status: ProfileStatus) => {
    setBusyId(id);
    const { error } = await supabase.from("profiles").update({ hub_status: status }).eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Cadastro aprovado" : "Cadastro recusado" });
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const filtered = profiles.filter((p) => p.hub_status === tab);
  const counts = {
    pending: profiles.filter((p) => p.hub_status === "pending").length,
    approved: profiles.filter((p) => p.hub_status === "approved").length,
    rejected: profiles.filter((p) => p.hub_status === "rejected").length,
  };

  const tabs: { key: ProfileStatus; label: string }[] = [
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Recusados" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader
        userEmail={profile?.email}
        isAdmin={isAdmin}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      />
      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 md:px-6 py-12">
        <button
          onClick={() => navigate({ to: "/generator" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao gerador
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Aprovação de cadastros</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Aprove ou recuse o acesso de novos usuários ao gerador.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-border">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {t.label} <span className="ml-1 text-xs opacity-70">({counts[t.key]})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 pb-2">
            <span className="text-xs text-muted-foreground mr-1">Período:</span>
            {([
              { v: 7, label: "7d" },
              { v: 30, label: "30d" },
              { v: 90, label: "90d" },
              { v: 0, label: "Todo" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setPeriod(opt.v)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  period === opt.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tailor-card !p-0 overflow-hidden">
          {fetching ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum cadastro nesta categoria.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {p.full_name || "Sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cadastrado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {p.hub_status === "approved" && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground leading-none">{genCounts[p.id] ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                          {period === 0 ? "currículos" : `em ${period}d`}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {p.hub_status !== "approved" && (
                        <button
                          disabled={busyId === p.id}
                          onClick={() => updateStatus(p.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1a6a35] text-white px-3 py-2 text-xs font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                      )}
                      {p.hub_status !== "rejected" && (
                        <button
                          disabled={busyId === p.id}
                          onClick={() => updateStatus(p.id, "rejected")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border text-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-accent disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Recusar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <TailorFooter />
    </div>
  );
}
