import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import TailorHeader from "@/components/TailorHeader";
import TailorHero from "@/components/TailorHero";
import TailorUploadZone from "@/components/TailorUploadZone";
import TailorFooter from "@/components/TailorFooter";
import { toast } from "@/hooks/use-toast";

type Status = "idle" | "loading" | "success" | "error";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const downloadUrlRef = useRef<string | null>(null);
  const downloadNameRef = useRef<string>("Candidato_CV_Tailor.docx");

  const toTailorFilename = (rawName?: string | null) => {
    const decoded = rawName ? decodeURIComponent(rawName.replace(/^"|"$/g, "").trim()) : "";
    const withoutExt = decoded.replace(/\.docx$/i, "").replace(/\.pdf$/i, "");
    const base = withoutExt.replace(/_CV_Tailor$/i, "").trim() || "Candidato";
    return `${base}_CV_Tailor.docx`;
  };

  const handleGenerate = async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch("/api/generate-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${response.status}`);
      }

      const blob = await response.blob();

      const explicitFilename = response.headers.get("X-Resume-Filename");
      const disposition = response.headers.get("Content-Disposition");
      const utf8Match = disposition?.match(/filename\*=UTF-8''([^;\n]+)/i);
      const basicMatch = disposition?.match(/filename="?([^";\n]+)"?/i);
      const serverName = explicitFilename ?? utf8Match?.[1] ?? basicMatch?.[1] ?? null;

      downloadNameRef.current = toTailorFilename(serverName);

      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(blob);

      setStatus("success");
    } catch (e) {
      console.error("Generate error:", e);
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setErrorMsg(msg);
      setStatus("error");
      toast({ title: "Erro ao gerar currículo", description: msg, variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!downloadUrlRef.current) return;
    const a = document.createElement("a");
    a.href = downloadUrlRef.current;
    a.download = downloadNameRef.current;
    a.click();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader />
      <TailorHero />

      <main className="flex-1 w-full max-w-[760px] mx-auto px-4 md:px-6 py-12 md:py-16 pb-20 -mt-10 relative z-10">
        <div className="tailor-card">
          <div className="tailor-card-title">01 — Currículo do Candidato</div>
          <TailorUploadZone file={file} onFileChange={setFile} />
        </div>

        <div className="tailor-card">
          <div className="tailor-card-title">02 — GERAR CURRÍCULO</div>

          <button
            disabled={!file || status === "loading"}
            onClick={handleGenerate}
            className="flex items-center justify-center gap-2.5 w-full py-4 px-8 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] border-none cursor-pointer transition-all hover:brightness-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <Sparkles className="w-[18px] h-[18px]" />
            Gerar Currículo Padrão Tailor
          </button>

          {status === "loading" && (
            <div className="flex items-start gap-3.5 rounded-[10px] p-5 mt-5 bg-[#fffbf0] border-[1.5px] border-[#f0d060]">
              <div className="w-8 h-8 rounded-full bg-[#f0d060] flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-card animate-spin" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#8a6a00] mb-0.5">Processando...</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Aguarde enquanto formatamos o currículo.
                </p>
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
