import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SEM_AVISOS = "Sem avisos e lembretes no momento, keep pushing!";

/** Com quantos caracteres uma volta do trilho fica mais larga que a tela. */
const CARACTERES_MINIMOS = 220;

/**
 * Faixa de avisos da página inicial, publicados pelo admin em /admin.
 *
 * Só aparece para quem está logado: a página inicial é pública, mas aviso é
 * interno — e o banco também não entrega nada para `anon`.
 */
export function AvisosFaixa() {
  const { session } = useAuth();
  const [avisos, setAvisos] = useState<string[] | null>(null);

  useEffect(() => {
    if (!session) {
      setAvisos(null);
      return;
    }
    let vivo = true;
    const carregar = async () => {
      const { data, error } = await supabase
        .from("hub_avisos")
        .select("texto")
        .eq("publicado", true)
        .order("created_at", { ascending: false });
      if (!vivo) return;
      if (error) {
        console.warn("[avisos] falha ao carregar:", error);
        setAvisos([]);
        return;
      }
      setAvisos(data.map((a) => a.texto));
    };
    carregar();
    // Aviso publicado com a página já aberta entra sozinho, sem recarregar.
    const timer = setInterval(carregar, 2 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [session]);

  if (avisos === null) return null;

  const itens = avisos.length > 0 ? avisos : [SEM_AVISOS];

  // Repete a lista até uma volta ser mais larga que a tela; senão, com um aviso
  // curto, sobraria um buraco vazio antes da repetição.
  const caracteres = itens.reduce((n, t) => n + t.length + 6, 0);
  const repeticoes = Math.max(1, Math.ceil(CARACTERES_MINIMOS / caracteres));
  const volta = Array.from({ length: repeticoes }, () => itens).flat();
  // Velocidade constante, seja qual for o tamanho dos avisos.
  const duracao = Math.max(20, caracteres * repeticoes * 0.16);

  return (
    <div className="w-full border-b border-border bg-neutral-500/[0.07] backdrop-blur-sm">
      <div className="flex items-stretch h-10 md:h-11">
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-primary px-3 md:px-5 text-[11px] md:text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground">
          <Megaphone className="w-3.5 h-3.5 md:w-4 md:h-4" aria-hidden />
          <span className="hidden sm:inline">Tailor Avisos</span>
          <span className="sm:hidden">Avisos</span>
        </div>

        <div
          className="relative flex-1 overflow-hidden"
          role="marquee"
          aria-label={`Avisos: ${itens.join(". ")}`}
        >
          <div
            className="hub-avisos-trilho flex w-max h-full items-center"
            style={{ ["--hub-avisos-duracao" as string]: `${duracao}s` }}
            aria-hidden
          >
            {[0, 1].map((copia) => (
              <div key={copia} className="flex items-center">
                {volta.map((texto, i) => (
                  <span key={i} className="flex items-center">
                    <span className="px-6 md:px-8 text-sm text-foreground/80 whitespace-nowrap">
                      {texto}
                    </span>
                    <span className="text-[8px] text-primary">●</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background/80 to-transparent" />
        </div>
      </div>
    </div>
  );
}
