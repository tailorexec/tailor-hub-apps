import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, X, Copy, ArrowLeft, ShieldX, Trash2, MessageSquareText } from "lucide-react";
import TailorHeader from "@/components/TailorHeader";
import TailorFooter from "@/components/TailorFooter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type NpsStatus = "pending" | "approved" | "rejected" | "admin";

interface NpsResponse {
  id: string;
  nome: string | null;
  consultor: string | null;
  contratado: boolean;
  nps_score: number;
  entendimento: number | null;
  atendimento: number | null;
  projeto: number | null;
  comentarios: string | null;
  created_at: string;
}

interface AccessRow {
  id: string;
  user_id: string;
  status: NpsStatus;
  created_at: string;
  email?: string;
  full_name?: string | null;
}

export const Route = createFileRoute("/_authenticated/nps")({
  component: NpsPage,
});

function classifyNps(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

function NpsPage() {
  const { profile, signOut, loading, user } = useAuth();
  const navigate = useNavigate();
  const [accessStatus, setAccessStatus] = useState<NpsStatus | "none" | null>(null);
  const [responses, setResponses] = useState<NpsResponse[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [tab, setTab] = useState<"dashboard" | "users">("dashboard");
  const [fetching, setFetching] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90 | 0>(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);

  const isAdmin = accessStatus === "admin";
  const hasAccess = accessStatus === "approved" || accessStatus === "admin";

  const formUrl =
    typeof window !== "undefined" ? `${window.location.origin}/nps/form` : "/nps/form";

  // Load my access status
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("nps_access")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setAccessStatus(((data?.status as NpsStatus) ?? "none") as NpsStatus | "none");
    })();
  }, [user]);

  // Load responses if we have access
  useEffect(() => {
    if (!hasAccess) return;
    setFetching(true);
    (async () => {
      let q = supabase
        .from("nps_responses")
        .select("*")
        .order("created_at", { ascending: false });
      if (period > 0) {
        const since = new Date(Date.now() - period * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q.limit(5000);
      setFetching(false);
      if (error) {
        toast({ title: "Erro ao carregar respostas", description: error.message, variant: "destructive" });
        return;
      }
      setResponses((data ?? []) as NpsResponse[]);
    })();
  }, [hasAccess, period]);

  // Load users if admin
  const loadAccess = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("nps_access")
      .select("id,user_id,status,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data ?? []) as AccessRow[];
    const ids = rows.map((r) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.user_id);
        if (p) {
          r.email = p.email;
          r.full_name = p.full_name;
        }
      });
    }
    setAccess(rows);
  };

  useEffect(() => {
    if (isAdmin) loadAccess();
  }, [isAdmin]);

  const metrics = useMemo(() => {
    const total = responses.length;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    let sum = 0;
    let hired = 0;
    let ent = 0,
      entN = 0,
      ate = 0,
      ateN = 0,
      proj = 0,
      projN = 0;
    responses.forEach((r) => {
      const c = classifyNps(r.nps_score);
      if (c === "promoter") promoters++;
      else if (c === "passive") passives++;
      else detractors++;
      sum += r.nps_score;
      if (r.contratado) hired++;
      if (r.entendimento != null) {
        ent += r.entendimento;
        entN++;
      }
      if (r.atendimento != null) {
        ate += r.atendimento;
        ateN++;
      }
      if (r.projeto != null) {
        proj += r.projeto;
        projN++;
      }
    });
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    const avg = total > 0 ? (sum / total).toFixed(1) : "—";
    return {
      total,
      promoters,
      passives,
      detractors,
      nps,
      avg,
      hired,
      hiredPct: total > 0 ? Math.round((hired / total) * 100) : 0,
      entAvg: entN > 0 ? (ent / entN).toFixed(2) : "—",
      ateAvg: ateN > 0 ? (ate / ateN).toFixed(2) : "—",
      projAvg: projN > 0 ? (proj / projN).toFixed(2) : "—",
    };
  }, [responses]);

  if (loading || accessStatus === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  // No access yet → request access
  if (!hasAccess) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TailorHeader userEmail={profile?.email} isAdmin={false} onSignOut={handleSignOut} />
        <main className="flex-1 w-full max-w-[640px] mx-auto px-4 py-16">
          <button
            onClick={() => navigate({ to: "/" })}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao hub
          </button>
          <div className="tailor-card text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#fff5f5] border-[1.5px] border-[#f09090] flex items-center justify-center mb-4">
              <ShieldX className="w-5 h-5 text-[#8a1a1a]" />
            </div>
            <h2 className="text-xl font-bold mb-2">Acesso ao NPS</h2>
            {accessStatus === "pending" ? (
              <p className="text-sm text-muted-foreground">
                Sua solicitação está pendente. Aguarde a aprovação do administrador.
              </p>
            ) : accessStatus === "rejected" ? (
              <p className="text-sm text-muted-foreground">
                Seu acesso foi recusado. Entre em contato com o administrador.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Você ainda não tem acesso ao dashboard NPS. Solicite acesso ao administrador.
                </p>
                <button
                  onClick={async () => {
                    if (!user) return;
                    const { error } = await supabase
                      .from("nps_access")
                      .insert({ user_id: user.id, status: "pending" });
                    if (error) {
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }
                    setAccessStatus("pending");
                    toast({ title: "Solicitação enviada" });
                  }}
                  className="inline-flex items-center gap-2 rounded-[8px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:brightness-110"
                >
                  Solicitar acesso
                </button>
              </>
            )}
          </div>
        </main>
        <TailorFooter />
      </div>
    );
  }

  const copyFormLink = async () => {
    await navigator.clipboard.writeText(formUrl);
    toast({ title: "Link copiado!" });
  };

  const updateAccess = async (id: string, status: NpsStatus) => {
    setBusyId(id);
    const { error } = await supabase.from("nps_access").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setAccess((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    toast({ title: "Atualizado" });
  };

  const removeAccess = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("nps_access").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setAccess((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Removido" });
  };

  const deleteResponse = async (id: string) => {
    if (!confirm("Excluir esta resposta?")) return;
    const { error } = await supabase.from("nps_responses").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setResponses((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader userEmail={profile?.email} isAdmin={false} onSignOut={handleSignOut} />
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 py-10">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao hub
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">NPS Tailor</h1>
            <p className="text-sm text-muted-foreground">
              Métricas e respostas da pesquisa de experiência.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={formUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-[280px] md:w-[360px] rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
            />
            <button
              onClick={copyFormLink}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide hover:brightness-110"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar link
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 mb-5 border-b border-border">
            {(
              [
                { k: "dashboard", l: "Dashboard" },
                { k: "users", l: "Usuários" },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t.k
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
        )}

        {tab === "dashboard" && (
          <>
            <div className="flex items-center gap-1.5 mb-5">
              <span className="text-xs text-muted-foreground mr-1">Período:</span>
              {(
                [
                  { v: 7, label: "7d" },
                  { v: 30, label: "30d" },
                  { v: 90, label: "90d" },
                  { v: 0, label: "Todo" },
                ] as const
              ).map((opt) => (
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="NPS" value={String(metrics.nps)} accent />
              <MetricCard label="Respostas" value={String(metrics.total)} />
              <MetricCard label="Nota média" value={String(metrics.avg)} />
              <MetricCard
                label="Contratados"
                value={`${metrics.hired} (${metrics.hiredPct}%)`}
              />
              <MetricCard label="Promotores" value={String(metrics.promoters)} color="#1a6a35" />
              <MetricCard label="Neutros" value={String(metrics.passives)} color="#b07a00" />
              <MetricCard label="Detratores" value={String(metrics.detractors)} color="#941010" />
              <MetricCard
                label="Médias 1-7"
                value={`${metrics.entAvg} / ${metrics.ateAvg} / ${metrics.projAvg}`}
                small
              />
            </div>

            <div className="tailor-card !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-sm font-bold uppercase tracking-wide">Respostas</h2>
              </div>
              {fetching ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : responses.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhuma resposta no período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2">Data</th>
                        <th className="text-left px-4 py-2">Nome</th>
                        <th className="text-left px-4 py-2">Consultor</th>
                        <th className="text-center px-2 py-2">Contr.</th>
                        <th className="text-center px-2 py-2">NPS</th>
                        <th className="text-center px-2 py-2">Ent.</th>
                        <th className="text-center px-2 py-2">Atend.</th>
                        <th className="text-center px-2 py-2">Proj.</th>
                        <th className="text-left px-4 py-2">Comentários</th>
                        {isAdmin && <th className="px-2 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map((r) => {
                        const c = classifyNps(r.nps_score);
                        const dotColor =
                          c === "promoter" ? "#1a6a35" : c === "passive" ? "#b07a00" : "#941010";
                        return (
                          <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-4 py-2">{r.nome || "—"}</td>
                            <td className="px-4 py-2">{r.consultor || "—"}</td>
                            <td className="text-center px-2 py-2">{r.contratado ? "Sim" : "Não"}</td>
                            <td className="text-center px-2 py-2">
                              <span
                                className="inline-flex items-center gap-1.5 font-bold"
                                style={{ color: dotColor }}
                              >
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ background: dotColor }}
                                />
                                {r.nps_score}
                              </span>
                            </td>
                            <td className="text-center px-2 py-2">{r.entendimento ?? "—"}</td>
                            <td className="text-center px-2 py-2">{r.atendimento ?? "—"}</td>
                            <td className="text-center px-2 py-2">{r.projeto ?? "—"}</td>
                            <td className="px-4 py-2 max-w-[280px]">
                              {r.comentarios ? (
                                <button
                                  onClick={() => setOpenComment(r.comentarios!)}
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline truncate max-w-full"
                                  title="Ler comentário completo"
                                >
                                  <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{r.comentarios}</span>
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => deleteResponse(r.id)}
                                  className="text-muted-foreground hover:text-[#941010]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "users" && isAdmin && (
          <div className="tailor-card !p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Usuários com acesso ao NPS
              </h2>
            </div>
            {access.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum usuário ainda.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {access.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {a.full_name || a.email || a.user_id}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Status: <span className="font-semibold">{a.status}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {a.status !== "admin" && a.status !== "approved" && (
                        <button
                          disabled={busyId === a.id}
                          onClick={() => updateAccess(a.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1a6a35] text-white px-3 py-2 text-xs font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Aprovar
                        </button>
                      )}
                      {a.status !== "rejected" && a.status !== "admin" && (
                        <button
                          disabled={busyId === a.id}
                          onClick={() => updateAccess(a.id, "rejected")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border text-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-accent disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Recusar
                        </button>
                      )}
                      {a.status !== "admin" && (
                        <button
                          disabled={busyId === a.id}
                          onClick={() => removeAccess(a.id)}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border text-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-accent disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <TailorFooter />
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  color,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
  small?: boolean;
}) {
  return (
    <div className="tailor-card">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </p>
      <p
        className={`mt-1 font-bold ${small ? "text-lg" : "text-3xl"} ${accent ? "text-primary" : ""}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
