import {
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  ImageIcon,
  Linkedin,
  Loader2,
  MapPin,
  Upload,
  User,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { lerAgenda } from "@/lib/tpm/api";
import type { ParsedAgenda, TPMInput } from "@/lib/tpm/types";

// Portado de tailor-pre-meeting, sem framer-motion.
//
// O botão mostrava uma lista de passos que avançava sozinha a cada 8 segundos,
// sem relação com o que o servidor estava fazendo — se a geração travasse, a
// mensagem continuava mudando. Agora o progresso vem do stream da rota.

const MAX_ARQUIVO = 10 * 1024 * 1024;

export function TPMInputForm({
  onGenerate,
  isLoading,
  progresso,
}: {
  onGenerate: (input: TPMInput) => void;
  isLoading: boolean;
  /** Rótulo do passo atual, vindo do servidor. */
  progresso?: string;
}) {
  const [input, setInput] = useState<TPMInput>({
    companyName: "",
    website: "",
    companyLinkedin: "",
    executiveLinkedins: [""],
    executiveName: "",
    meetingRole: "",
    location: "",
    freeText: "",
    agendaPrint: null,
  });
  const [previewAgenda, setPreviewAgenda] = useState<string | null>(null);
  const [lendoAgenda, setLendoAgenda] = useState(false);
  const [agenda, setAgenda] = useState<ParsedAgenda | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const campo = <K extends keyof TPMInput>(chave: K, valor: TPMInput[K]) =>
    setInput((prev) => ({ ...prev, [chave]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!input.companyName.trim()) return;
    onGenerate({ ...input, parsedAgenda: agenda });
  };

  /**
   * Converte para base64 reduzindo a imagem antes.
   *
   * Imagem é cobrada por área de pixel (~1 token a cada 28x28), não por
   * informação: um print de tela em 4K custa vários milhares de tokens para
   * mostrar o mesmo convite que 1280px de largura mostram. O texto de um
   * convite continua legível nessa escala — é disso que a IA precisa.
   *
   * Se o navegador não der conta do canvas, cai para o arquivo original: ler a
   * agenda é mais importante do que economizar.
   */
  const paraBase64 = (file: File) =>
    new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
      const bruto = new FileReader();
      bruto.onerror = reject;
      bruto.onload = () => {
        const dataUrl = bruto.result as string;
        const semReduzir = () => resolve({ base64: dataUrl.split(",")[1], mimeType: file.type });

        const img = new Image();
        img.onerror = semReduzir;
        img.onload = () => {
          const MAX = 1280;
          const escala = Math.min(1, MAX / Math.max(img.width, img.height));
          if (escala === 1) return semReduzir();
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            const ctx = canvas.getContext("2d");
            if (!ctx) return semReduzir();
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // PNG mantém o texto nítido; JPEG borraria letra pequena. O tipo
            // volta junto porque deixou de ser o do arquivo original.
            resolve({
              base64: canvas.toDataURL("image/png").split(",")[1],
              mimeType: "image/png",
            });
          } catch {
            semReduzir();
          }
        };
        img.src = dataUrl;
      };
      bruto.readAsDataURL(file);
    });

  const analisar = async (base64: string, mimeType: string) => {
    setLendoAgenda(true);
    try {
      const dados = await lerAgenda(base64, mimeType);
      setAgenda(dados);

      // Preenche o que ainda está vazio. A leitura é atômica sobre o estado
      // anterior para não perder o que o usuário digitou enquanto a IA lia.
      setInput((prev) => {
        const p = dados.participants?.[0];
        return {
          ...prev,
          companyName: prev.companyName || dados.companyName || "",
          website: prev.website || dados.website || "",
          executiveName: prev.executiveName || p?.name || "",
          meetingRole: prev.meetingRole || p?.title || "",
          freeText:
            prev.freeText ||
            (dados.meetingSubject
              ? `Assunto: ${dados.meetingSubject}${
                  dados.additionalContext ? `\n${dados.additionalContext}` : ""
                }`
              : ""),
        };
      });

      toast({
        title: "Agenda analisada",
        description: `${dados.participants?.length ?? 0} participante(s) identificado(s).`,
      });
    } catch (err) {
      toast({
        title: "Erro ao analisar a agenda",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLendoAgenda(false);
    }
  };

  const receberArquivo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Envie uma imagem (PNG, JPG).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_ARQUIVO) {
      toast({
        title: "Arquivo grande demais",
        description: "Máximo 10 MB.",
        variant: "destructive",
      });
      return;
    }
    const { base64, mimeType } = await paraBase64(file);
    setPreviewAgenda(`data:${mimeType};base64,${base64}`);
    campo("agendaPrint", file);
    await analisar(base64, mimeType);
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void receberArquivo(file);
  };

  const limparAgenda = () => {
    setPreviewAgenda(null);
    setAgenda(null);
    campo("agendaPrint", null);
    if (inputArquivo.current) inputArquivo.current.value = "";
  };

  return (
    <form
      onSubmit={enviar}
      className="space-y-8"
      onPaste={(e) => {
        for (const item of Array.from(e.clipboardData?.items ?? [])) {
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) void receberArquivo(file);
            return;
          }
        }
      }}
    >
      <div className="surface-elevated p-6 space-y-4">
        <h3 className="font-heading text-lg text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Dados obrigatórios
        </h3>
        <div>
          <Label htmlFor="companyName">Nome da empresa *</Label>
          <Input
            id="companyName"
            value={input.companyName}
            onChange={(e) => campo("companyName", e.target.value)}
            placeholder="Ex: Grupo Votorantim"
            className="mt-1.5"
            required
          />
        </div>
      </div>

      <div className="surface-elevated p-6 space-y-4">
        <h3 className="font-heading text-lg text-foreground flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Print da agenda / convite
        </h3>
        <p className="text-sm text-muted-foreground">
          Cole (Ctrl+V) ou envie um print do convite. A IA extrai os participantes e os dados da
          empresa.
        </p>

        {previewAgenda ? (
          <div className="relative border border-border rounded-lg overflow-hidden">
            <img
              src={previewAgenda}
              alt="Print da agenda enviada"
              className="w-full max-h-64 object-contain bg-muted/30"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={limparAgenda}
              aria-label="Remover imagem"
            >
              <X className="h-4 w-4" />
            </Button>
            {lendoAgenda && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Analisando agenda...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground hover:border-primary/50 transition-colors"
            onClick={() => inputArquivo.current?.click()}
            onDrop={soltar}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Arraste, clique ou cole (Ctrl+V) uma imagem</p>
            <p className="text-xs mt-1.5">PNG, JPG — máx. 10 MB</p>
          </button>
        )}

        <input
          ref={inputArquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void receberArquivo(file);
          }}
        />

        {agenda && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Dados extraídos da agenda
            </div>

            {(agenda.participants?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Participantes identificados:
                </p>
                <div className="space-y-1.5">
                  {agenda.participants.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{p.name}</span>
                      {p.title && <span className="text-muted-foreground">— {p.title}</span>}
                      {p.company && (
                        <Badge variant="secondary" className="text-xs">
                          {p.company}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {agenda.companyName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  Empresa: <strong>{agenda.companyName}</strong>
                </span>
              </div>
            )}
            {agenda.meetingSubject && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Assunto: {agenda.meetingSubject}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="surface-elevated p-6 space-y-4">
        <h3 className="font-heading text-lg text-foreground">Dados opcionais</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="website" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
            </Label>
            <Input
              id="website"
              value={input.website}
              onChange={(e) => campo("website", e.target.value)}
              placeholder="https://empresa.com.br"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="companyLinkedin" className="flex items-center gap-1.5">
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground" /> LinkedIn da empresa
            </Label>
            <Input
              id="companyLinkedin"
              value={input.companyLinkedin}
              onChange={(e) => campo("companyLinkedin", e.target.value)}
              placeholder="https://linkedin.com/company/..."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="executiveName" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Nome do executivo
            </Label>
            <Input
              id="executiveName"
              value={input.executiveName}
              onChange={(e) => campo("executiveName", e.target.value)}
              placeholder="Nome completo"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="meetingRole" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Cargo / tema da reunião
            </Label>
            <Input
              id="meetingRole"
              value={input.meetingRole}
              onChange={(e) => campo("meetingRole", e.target.value)}
              placeholder="CFO, VP de Engenharia..."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="location" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Cidade / país
            </Label>
            <Input
              id="location"
              value={input.location}
              onChange={(e) => campo("location", e.target.value)}
              placeholder="São Paulo, Brasil"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="execLinkedin" className="flex items-center gap-1.5">
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground" /> LinkedIn do executivo
            </Label>
            <Input
              id="execLinkedin"
              value={input.executiveLinkedins?.[0] ?? ""}
              onChange={(e) => campo("executiveLinkedins", [e.target.value])}
              placeholder="https://linkedin.com/in/..."
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="freeText">Texto livre / contexto adicional</Label>
          <Textarea
            id="freeText"
            value={input.freeText}
            onChange={(e) => campo("freeText", e.target.value)}
            placeholder="Qualquer informação adicional relevante para a reunião..."
            className="mt-1.5 min-h-[100px]"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || lendoAgenda || !input.companyName.trim()}
        size="lg"
        className="w-full text-base font-semibold h-14"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {progresso ?? "Gerando..."}
          </span>
        ) : (
          "Gerar TPM"
        )}
      </Button>
    </form>
  );
}
