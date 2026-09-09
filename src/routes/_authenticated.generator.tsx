import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, Download, Loader2, CheckCircle, AlertCircle, Clock, ShieldX } from "lucide-react";
import TailorHeader from "@/components/TailorHeader";
import TailorHero from "@/components/TailorHero";
import TailorUploadZone from "@/components/TailorUploadZone";
import TailorFooter from "@/components/TailorFooter";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "loading" | "success" | "error";

export const Route = createFileRoute("/_authenticated/generator")({
  component: Index,
});

function Index() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ pct: 0, label: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const downloadNameRef = useRef<string>("Candidato_CV_Tailor.docx");

  const fetchUsage = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/usage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = (await res.json()) as { used: number; limit: number };
        setUsage(j);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (profile?.hub_status === "approved") fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hub_status]);

  const toTailorFilename = (rawName?: string | null) => {
    const decoded = rawName ? decodeURIComponent(rawName.replace(/^"|"$/g, "").trim()) : "";
    const withoutExt = decoded.replace(/\.docx$/i, "").replace(/\.pdf$/i, "");
    const base = withoutExt.replace(/_CV_Tailor$/i, "").trim() || "Candidato";
    return `${base}_CV_Tailor.docx`;
  };

  const handleGenerate = async () => {
    if (!file) return;
    setStatus("loading");
    setProgress({ pct: 0, label: "Enviando o arquivo" });
    setErrorMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch("/api/generate-resume", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Erros de auth/quota chegam como JSON antes do stream comecar
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${response.status}`);
      }
      if (!response.body) throw new Error("Resposta sem conteúdo.");

      // O servidor emite eventos SSE com o progresso e, no fim, o documento
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: { filename?: string; used?: number; limit?: number; docx?: string } | null = null;

      while (!final) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const partes = buffer.split("\n\n");
        buffer = partes.pop() ?? "";
        for (const parte of partes) {
          const linha = parte.split("\n").find((l) => l.startsWith("data:"));
          if (!linha) continue;
          const evento = JSON.parse(linha.slice(5).trim());

          if (evento.stage === "erro") throw new Error(evento.error || "Falha ao gerar.");
          if (evento.stage === "pronto") {
            setProgress({ pct: 100, label: evento.label ?? "Concluído" });
            final = evento;
          } else if (typeof evento.pct === "number") {
            setProgress({ pct: evento.pct, label: evento.label ?? "" });
          }
        }
      }

      if (!final?.docx) throw new Error("O servidor não devolveu o documento.");

      const binario = atob(final.docx);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      downloadNameRef.current = toTailorFilename(final.filename ?? null);
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(blob);

      if (typeof final.used === "number" && typeof final.limit === "number") {
        setUsage({ used: final.used, limit: final.limit });
      } else {
        fetchUsage();
      }

      setStatus("success");
    } catch (e) {
      console.error("Generate error:", e);
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setErrorMsg(msg);
      setStatus("error");
      toast({ title: "Erro ao gerar currículo", description: msg, variant: "destructive" });
      fetchUsage();
    }
  };

  const handleDownload = () => {
    if (!downloadUrlRef.current) return;
    const a = document.createElement("a");
    a.href = downloadUrlRef.current;
    a.download = downloadNameRef.current;
    a.click();
  };

  // Pending / rejected gate
  if (profile && profile.hub_status !== "approved") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <TailorHeader
          userEmail={profile.email}
          isAdmin={isAdmin}
          onAdmin={() => navigate({ to: "/admin" })}
          onSignOut={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        />
        <main className="flex-1 w-full max-w-[640px] mx-auto px-4 md:px-6 py-16">
          <div className="tailor-card text-center">
            {profile.hub_status === "pending" ? (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-[#fffbf0] border-[1.5px] border-[#f0d060] flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5 text-[#8a6a00]" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Aguardando aprovação</h2>
                <p className="text-sm text-muted-foreground">
                  Seu cadastro foi recebido. Um administrador da Tailor precisa aprovar seu acesso antes de você poder usar o gerador.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-[#fff5f5] border-[1.5px] border-[#f09090] flex items-center justify-center mb-4">
                  <ShieldX className="w-5 h-5 text-[#8a1a1a]" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Acesso recusado</h2>
                <p className="text-sm text-muted-foreground">
                  Seu cadastro foi recusado. Entre em contato com a Tailor se acredita que isso foi um engano.
                </p>
              </>
            )}
          </div>
        </main>
        <TailorFooter />
      </div>
    );
  }

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
      <TailorHero />

      <main className="flex-1 w-full max-w-[760px] mx-auto px-4 md:px-6 py-12 md:py-16 pb-20 -mt-10 relative z-10">
        <div className="tailor-card">
          <div className="tailor-card-title">01 — Currículo do Candidato</div>
          <TailorUploadZone file={file} onFileChange={setFile} />
        </div>

        <div className="tailor-card">
          <div className="tailor-card-title">02 — GERAR CURRÍCULO</div>

          {usage && (
            <div className="flex items-center justify-between text-xs mb-3 px-1">
              <span className="text-muted-foreground">Uso nas últimas 24h</span>
              <span
                className={`font-bold ${
                  usage.used >= usage.limit ? "text-[#8a1a1a]" : "text-foreground"
                }`}
              >
                {usage.used} / {usage.limit}
              </span>
            </div>
          )}

          <button
            disabled={
              !file ||
              status === "loading" ||
              (usage ? usage.used >= usage.limit : false)
            }
            onClick={handleGenerate}
            className="flex items-center justify-center gap-2.5 w-full py-4 px-8 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] border-none cursor-pointer transition-all hover:brightness-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <Sparkles className="w-[18px] h-[18px]" />
            Gerar Currículo Padrão Tailor
          </button>

          {usage && usage.used >= usage.limit && (
            <div className="flex items-start gap-3.5 rounded-[10px] p-5 mt-5 bg-[#fff5f5] border-[1.5px] border-[#f09090]">
              <div className="w-8 h-8 rounded-full bg-[#f09090] flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-card" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#8a1a1a] mb-0.5">
                  Limite diário atingido
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Você atingiu o limite de {usage.limit} gerações nas últimas 24h. Contate o administrador.
                </p>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="flex items-start gap-3.5 rounded-[10px] p-5 mt-5 bg-[#fffbf0] border-[1.5px] border-[#f0d060]">
              <div className="w-8 h-8 rounded-full bg-[#f0d060] flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-card animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-bold text-[#8a6a00] mb-0.5">
                    {progress.label || "Processando..."}
                  </p>
                  <span
                    className="text-[13px] font-bold text-[#8a6a00] tabular-nums"
                    aria-hidden="true"
                  >
                    {progress.pct}%
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f0d060]/30"
                  role="progressbar"
                  aria-valuenow={progress.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={progress.label || "Processando currículo"}
                >
                  <div
                    className="h-full rounded-full bg-[#f0d060] transition-[width] duration-500 ease-out"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="flex items-start gap-3.5 rounded-[10px] p-5 mt-5 bg-[#f0faf4] border-[1.5px] border-[#60c080]">
                <div className="w-8 h-8 rounded-full bg-[#60c080] flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-card" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1a6a35] mb-0.5">Currículo gerado!</p>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    O documento está pronto para download.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 px-8 bg-foreground text-background font-bold text-sm tracking-wider uppercase rounded-[10px] border-none cursor-pointer transition-colors hover:opacity-90 mt-3"
              >
                <Download className="w-[18px] h-[18px]" />
                Baixar Word (.docx)
              </button>
            </>
          )}

          {status === "error" && (
            <div className="flex items-start gap-3.5 rounded-[10px] p-5 mt-5 bg-[#fff5f5] border-[1.5px] border-[#f09090]">
              <div className="w-8 h-8 rounded-full bg-[#f09090] flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-card" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#8a1a1a] mb-0.5">Erro ao processar</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {errorMsg || "Tente novamente ou entre em contato com o suporte."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <TailorFooter />
    </div>
  );
}
