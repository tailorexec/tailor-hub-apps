import { Eye, EyeOff, Loader2, Megaphone, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Aviso = Database["public"]["Tables"]["hub_avisos"]["Row"];

const LIMITE = 200;

/**
 * Gestão dos avisos da faixa da página inicial.
 *
 * Quem barra não-admin é o banco (RLS com has_role), não esta tela: ela só
 * aparece dentro do /admin, que já é restrito.
 */
export function AvisosAdmin() {
  const { session } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const { data, error } = await supabase
      .from("hub_avisos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Não foi possível carregar os avisos", description: error.message });
      setAvisos([]);
      return;
    }
    setAvisos(data);
  };

  useEffect(() => {
    carregar();
  }, []);

  const publicar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    setSalvando(true);
    const { error } = await supabase
      .from("hub_avisos")
      .insert({ texto: limpo, criado_por: session?.user.id ?? null });
    setSalvando(false);
    if (error) {
      toast({ title: "Aviso não publicado", description: error.message });
      return;
    }
    setTexto("");
    toast({ title: "Aviso publicado", description: "Já aparece na faixa da página inicial." });
    carregar();
  };

  const alternar = async (aviso: Aviso) => {
    const { error } = await supabase
      .from("hub_avisos")
      .update({ publicado: !aviso.publicado })
      .eq("id", aviso.id);
    if (error) {
      toast({ title: "Não foi possível alterar o aviso", description: error.message });
      return;
    }
    carregar();
  };

  const excluir = async (aviso: Aviso) => {
    if (!window.confirm(`Excluir o aviso "${aviso.texto}"?`)) return;
    const { error } = await supabase.from("hub_avisos").delete().eq("id", aviso.id);
    if (error) {
      toast({ title: "Não foi possível excluir o aviso", description: error.message });
      return;
    }
    carregar();
  };

  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground mb-1">
        <Megaphone className="w-5 h-5 text-primary" /> Avisos da página inicial
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Cada aviso publicado desliza na faixa vermelha do topo do hub, para todos os usuários
        logados. Oculte para tirar da faixa sem perder o texto.
      </p>

      <form onSubmit={publicar} className="tailor-card">
        <label htmlFor="novo-aviso" className="text-sm font-semibold text-foreground">
          Novo aviso
        </label>
        <textarea
          id="novo-aviso"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITE))}
          rows={2}
          placeholder="Ex.: Reunião geral sexta, 10h, na sala grande."
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {texto.length}/{LIMITE}
          </span>
          <button
            type="submit"
            disabled={salvando || !texto.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Publicar
          </button>
        </div>
      </form>

      <div className="tailor-card !p-0 overflow-hidden">
        {avisos === null ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : avisos.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nenhum aviso ainda. Enquanto isso, a faixa mostra “Sem avisos e lembretes no momento,
            keep pushing!”.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {avisos.map((aviso) => (
              <li key={aviso.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${aviso.publicado ? "text-foreground" : "text-muted-foreground line-through"}`}
                  >
                    {aviso.texto}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(aviso.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · {aviso.publicado ? "Na faixa" : "Oculto"}
                  </p>
                </div>
                <button
                  onClick={() => alternar(aviso)}
                  title={aviso.publicado ? "Ocultar da faixa" : "Voltar para a faixa"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  {aviso.publicado ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Ocultar
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Publicar
                    </>
                  )}
                </button>
                <button
                  onClick={() => excluir(aviso)}
                  title="Excluir aviso"
                  aria-label="Excluir aviso"
                  className="inline-flex items-center rounded-full border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
