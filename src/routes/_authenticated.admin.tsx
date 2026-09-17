import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Loader2,
  Check,
  X,
  ShieldX,
  ArrowLeft,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import TailorHeader from "@/components/TailorHeader";
import TailorFooter from "@/components/TailorFooter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Mínimo do /signup — a regra de senha do produto é uma só. */
const MIN_SENHA = 6;

// A senha gerada aqui vai ser ditada ou colada num chat pelo admin, então o
// alfabeto exclui o que se confunde na leitura (0/O, 1/l/I) e símbolos que
// trocam de posição entre teclados.
const ALFABETO_SENHA = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarSenha(tamanho = 14) {
  // Descarta os sorteios da cauda que não cabem num múltiplo do alfabeto: usar
  // o módulo direto tornaria as primeiras letras mais prováveis.
  const limite = Math.floor(0x100000000 / ALFABETO_SENHA.length) * ALFABETO_SENHA.length;
  const buf = new Uint32Array(1);
  let senha = "";
  while (senha.length < tamanho) {
    crypto.getRandomValues(buf);
    if (buf[0] >= limite) continue;
    senha += ALFABETO_SENHA[buf[0] % ALFABETO_SENHA.length];
  }
  return senha;
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { profile, user, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileStatus>("pending");
  const [period, setPeriod] = useState<7 | 30 | 90 | 0>(30);
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});
  const [pwTarget, setPwTarget] = useState<ProfileRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwDone, setPwDone] = useState(false);

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
      toast({
        title: "Erro ao carregar gerações",
        description: error.message,
        variant: "destructive",
      });
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
            <p className="text-sm text-muted-foreground">
              Esta página é exclusiva para administradores.
            </p>
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
    // A lista é filtrada por hub_status: atualizar qualquer outro campo deixa a
    // linha parada na aba anterior até o próximo refresh.
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, hub_status: status } : p)));
  };

  const abrirDialogoSenha = (p: ProfileRow) => {
    setPwTarget(p);
    setPwValue("");
    setPwConfirm("");
    setPwVisible(false);
    setPwDone(false);
  };

  const fecharDialogoSenha = () => {
    setPwTarget(null);
    setPwValue("");
    setPwConfirm("");
  };

  const copiarSenha = async () => {
    try {
      await navigator.clipboard.writeText(pwValue);
      toast({ title: "Senha copiada" });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione o texto e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const salvarSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    if (pwValue.length < MIN_SENHA) {
      toast({
        title: "Senha muito curta",
        description: `Mínimo de ${MIN_SENHA} caracteres.`,
        variant: "destructive",
      });
      return;
    }
    if (pwValue !== pwConfirm) {
      toast({
        title: "As senhas não coincidem",
        description: "Confira a confirmação.",
        variant: "destructive",
      });
      return;
    }

    setPwSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast({
          title: "Sessão expirada",
          description: "Entre novamente para continuar.",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/admin-set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: pwTarget.id, password: pwValue }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          title: "Erro ao alterar a senha",
          description: json.error ?? `Falha HTTP ${res.status}.`,
          variant: "destructive",
        });
        return;
      }

      // O diálogo continua aberto: o admin ainda precisa repassar a senha, e
      // fechar aqui apagaria a única cópia dela que existe.
      setPwDone(true);
      toast({ title: "Senha alterada" });
    } catch (err) {
      toast({
        title: "Erro ao alterar a senha",
        description: err instanceof Error ? err.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setPwSaving(false);
    }
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
          Aprove ou recuse o acesso ao gerador e redefina a senha de quem perdeu a dela.
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
        </div>

        <div className="tailor-card !p-0 overflow-hidden">
          {fetching ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum cadastro nesta categoria.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4"
                >
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
                        <p className="text-lg font-bold text-foreground leading-none">
                          {genCounts[p.id] ?? 0}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                          {period === 0 ? "currículos" : `em ${period}d`}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirDialogoSenha(p)}
                        title="Definir uma nova senha para este usuário"
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-border text-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-accent"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Senha
                      </button>
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

      <Dialog
        open={!!pwTarget}
        onOpenChange={(aberto) => {
          if (!aberto && !pwSaving) fecharDialogoSenha();
        }}
      >
        <DialogContent className="max-w-[440px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              {pwTarget?.full_name || "Sem nome"}
              {pwTarget?.email ? ` — ${pwTarget.email}` : ""}
            </DialogDescription>
          </DialogHeader>

          {pwDone ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground">
                Senha redefinida. Repasse-a agora — ela não pode ser consultada depois.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2.5 text-sm font-mono break-all">
                  {pwValue}
                </code>
                <button
                  type="button"
                  onClick={copiarSenha}
                  title="Copiar senha"
                  className="shrink-0 rounded-[10px] border border-border p-2.5 hover:bg-accent"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Peça ao usuário que troque a senha depois do primeiro acesso.
              </p>
              <button
                type="button"
                onClick={fecharDialogoSenha}
                className="w-full py-3 px-8 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] transition-all hover:brightness-90"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={salvarSenha} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">Nova senha</span>
                <div className="flex items-center gap-2">
                  <input
                    type={pwVisible ? "text" : "password"}
                    required
                    minLength={MIN_SENHA}
                    autoComplete="new-password"
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    className="flex-1 min-w-0 rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setPwVisible((v) => !v)}
                    title={pwVisible ? "Ocultar senha" : "Mostrar senha"}
                    className="shrink-0 rounded-[10px] border border-border p-3 hover:bg-accent"
                  >
                    {pwVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">Confirmar nova senha</span>
                <input
                  type={pwVisible ? "text" : "password"}
                  required
                  minLength={MIN_SENHA}
                  autoComplete="new-password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const nova = gerarSenha();
                  setPwValue(nova);
                  setPwConfirm(nova);
                  setPwVisible(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 self-start text-xs font-semibold text-primary hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Gerar senha forte
              </button>

              {pwTarget?.id === user?.id && (
                <p className="rounded-[10px] border border-[#f0c090] bg-[#fffaf2] px-3 py-2.5 text-xs text-[#7a4a0a] leading-relaxed">
                  Esta é a sua própria conta. Você pode precisar entrar de novo com a senha nova.
                </p>
              )}

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={fecharDialogoSenha}
                  className="flex-1 py-3 px-4 border border-border text-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] transition-all hover:brightness-90 disabled:opacity-50"
                >
                  {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <TailorFooter />
    </div>
  );
}
