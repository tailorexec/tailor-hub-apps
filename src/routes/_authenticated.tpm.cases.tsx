import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TpmShell } from "@/components/tpm/TpmShell";
import { toast } from "@/hooks/use-toast";
import { buscarPorSetor, criarCase, listarCases, type CaseRow } from "@/lib/tpm/api";

export const Route = createFileRoute("/_authenticated/tpm/cases")({
  component: CasesTailor,
});

const FORM_VAZIO = {
  client_name: "",
  sector: "",
  function_searched: "",
  seniority: "Director",
  complexity: "Média",
  region: "",
  result: "",
  tags: "",
  years: "",
  confidential: false,
};

/** "Serviços / Mineração" → ["serviços", "mineração"] */
function tagsDoSetor(sector: string) {
  return sector
    .split(/\s*\/\s*/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function CasesTailor() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogo, setDialogo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [consultaIA, setConsultaIA] = useState("");
  const [buscandoIA, setBuscandoIA] = useState(false);
  const [setoresCasados, setSetoresCasados] = useState<string[] | null>(null);
  const [setorPrincipal, setSetorPrincipal] = useState<string>("");

  const carregar = async () => {
    setCarregando(true);
    try {
      setCases(await listarCases());
    } catch (e) {
      toast({
        title: "Erro ao carregar os cases",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  // Filtro por texto: nome, setor, função, ano ou tag.
  const porTexto = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        c.function_searched.toLowerCase().includes(q) ||
        (c.years ?? "").toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [cases, busca]);

  // Quando a busca por setor está ativa, ela manda no que aparece.
  const visiveis = useMemo(() => {
    if (!setoresCasados) return porTexto;
    return porTexto.filter((c) => {
      const todas = [
        ...tagsDoSetor(c.sector),
        ...(c.tags ?? []).map((t) => t.toLowerCase().trim()),
      ];
      return setoresCasados.some((ms) => todas.includes(ms));
    });
  }, [porTexto, setoresCasados]);

  const buscarIA = async (e: FormEvent) => {
    e.preventDefault();
    if (!consultaIA.trim()) return;
    setBuscandoIA(true);
    try {
      const { match, expandidos } = await buscarPorSetor(consultaIA);
      setSetoresCasados(expandidos);
      setSetorPrincipal(match.mainSector ?? "");
      if (expandidos.length === 0) {
        toast({
          title: "Nenhum setor com afinidade",
          description: "A base não tem cases do mesmo mundo dessa empresa.",
        });
      }
    } catch (e) {
      toast({
        title: "Erro na busca por setor",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBuscandoIA(false);
    }
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim() || !form.sector.trim() || !form.function_searched.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Cliente, setor e função precisam estar preenchidos.",
        variant: "destructive",
      });
      return;
    }
    setSalvando(true);
    try {
      await criarCase({
        ...form,
        // Sem tags explícitas, o próprio setor vira o conjunto de tags — é o que
        // o motor de matching consulta depois.
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : tagsDoSetor(form.sector),
      });
      setDialogo(false);
      setForm(FORM_VAZIO);
      await carregar();
      toast({ title: "Case cadastrado" });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const campo = (k: keyof typeof FORM_VAZIO, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <TpmShell
      titulo="Cases Tailor"
      descricao={`${cases.length} case(s) na carteira.`}
      acoes={
        <Button size="sm" onClick={() => setDialogo(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo case
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por cliente, setor, função..."
            className="pl-9"
          />
        </div>

        <form onSubmit={buscarIA} className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              value={consultaIA}
              onChange={(e) => setConsultaIA(e.target.value)}
              placeholder="Buscar por afinidade: ex. Ambev"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" disabled={buscandoIA || !consultaIA.trim()}>
            {buscandoIA ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </form>
      </div>

      {setoresCasados && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="text-muted-foreground">
            Afinidade com{" "}
            <strong className="text-foreground">{setorPrincipal || consultaIA}</strong>:
          </span>
          {setoresCasados.slice(0, 8).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
          {setoresCasados.length > 8 && (
            <span className="text-xs text-muted-foreground">+{setoresCasados.length - 8}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setSetoresCasados(null);
              setSetorPrincipal("");
              setConsultaIA("");
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      <div className="surface-elevated overflow-hidden">
        {carregando ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : visiveis.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum case para este filtro.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-sm text-foreground">
                    {c.confidential ? "Confidencial" : c.client_name}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {c.region}
                    {c.years ? ` · ${c.years}` : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {c.function_searched} · {c.seniority} · complexidade {c.complexity}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tagsDoSetor(c.sector).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                {c.result && <p className="text-xs text-muted-foreground mt-2">{c.result}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogo} onOpenChange={(a) => !a && !salvando && setDialogo(false)}>
        <DialogContent className="max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo case</DialogTitle>
            <DialogDescription>
              Cases alimentam as conexões sugeridas nos briefings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client_name">Cliente *</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={(e) => campo("client_name", e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sector">Setor * (separe com /)</Label>
                <Input
                  id="sector"
                  value={form.sector}
                  onChange={(e) => campo("sector", e.target.value)}
                  placeholder="Mineração / Serviços"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="function_searched">Função buscada *</Label>
                <Input
                  id="function_searched"
                  value={form.function_searched}
                  onChange={(e) => campo("function_searched", e.target.value)}
                  placeholder="Gerente Comercial"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="seniority">Senioridade</Label>
                <select
                  id="seniority"
                  value={form.seniority}
                  onChange={(e) => campo("seniority", e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {["C-Level", "VP", "Director", "Senior Manager", "Manager"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="complexity">Complexidade</Label>
                <select
                  id="complexity"
                  value={form.complexity}
                  onChange={(e) => campo("complexity", e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {["Alta", "Média", "Baixa"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="region">Região</Label>
                <Input
                  id="region"
                  value={form.region}
                  onChange={(e) => campo("region", e.target.value)}
                  placeholder="MG"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="years">Ano(s)</Label>
                <Input
                  id="years"
                  value={form.years}
                  onChange={(e) => campo("years", e.target.value)}
                  placeholder="2024"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (vírgula)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => campo("tags", e.target.value)}
                  placeholder="deixe vazio para usar o setor"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="result">Resultado</Label>
              <Textarea
                id="result"
                value={form.result}
                onChange={(e) => campo("result", e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.confidential}
                onChange={(e) => campo("confidential", e.target.checked)}
                className="h-4 w-4"
              />
              Confidencial — o nome do cliente nunca aparece nos briefings
            </label>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogo(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={salvando}>
                {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TpmShell>
  );
}
