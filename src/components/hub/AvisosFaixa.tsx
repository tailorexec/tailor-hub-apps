import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SEM_AVISOS =
  "Sem avisos e lembretes, keep pushing! Utilizem as ferramentas de forma consciente.";
const SEM_LOGIN = "Entre no hub para ver os avisos e lembretes da Tailor.";

/** Com quantos caracteres uma volta do trilho fica mais larga que a tela. */
const CARACTERES_MINIMOS = 220;

/**
 * Faixa de avisos da página inicial, publicados pelo admin em /admin.
 *
 * A faixa aparece para todo mundo, mas os avisos só para quem está logado: a
 * página inicial é pública e aviso é interno — o banco também não entrega
 * nada para `anon`. Sem login, a faixa convida a entrar. Ela já existia só
 * para logados, e no celular (onde quase ninguém está logado ao abrir o hub)
 * parecia simplesmente não existir.
 */
export function AvisosFaixa() {
  const { session, loading } = useAuth();
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

  // Enquanto a sessão ou os avisos carregam, a faixa já ocupa o lugar dela,
  // vazia — senão a página pula quando ela aparece.
  const carregando = loading || (session && avisos === null);
  const mensagemUnica = carregando
    ? null
    : !session
      ? SEM_LOGIN
      : avisos!.length === 0
        ? SEM_AVISOS
        : null;
  const itens = mensagemUnica ? [mensagemUnica] : (avisos ?? []);

  // Repete a lista até uma volta ser mais larga que a tela; senão, com um aviso
  // curto, sobraria um buraco vazio antes da repetição.
  const caracteres = itens.reduce((n, t) => n + t.length + 6, 0);
  // Lista vazia (faixa ainda carregando) daria divisão por zero e um
  // Array.from infinito, que derruba a página inteira.
  const repeticoes = caracteres > 0 ? Math.max(1, Math.ceil(CARACTERES_MINIMOS / caracteres)) : 0;
  const volta = Array.from({ length: repeticoes }, () => itens).flat();
  // Velocidade constante, seja qual for o tamanho dos avisos.
  const duracao = Math.max(20, caracteres * repeticoes * 0.16);

  return (
    <div className="w-full border-b border-border bg-neutral-500/[0.07] backdrop-blur-sm">
      <div className="flex items-stretch h-8 md:h-[35px]">
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
          {carregando ? null : mensagemUnica ? (
            // Frase única: passa UMA vez de cada vez — entra pela direita,
            // atravessa e só reaparece depois de sair. O recuo de 100% é o que
            // a faz começar fora da faixa, do lado direito.
            <Link
              to="/login"
              disabled={!!session}
              tabIndex={session ? -1 : undefined}
              className="flex h-full items-center"
            >
              <span
                className="hub-avisos-unico inline-block shrink-0 pl-[100%] text-sm text-foreground/80 whitespace-nowrap"
                style={{ ["--hub-avisos-duracao" as string]: "22s" }}
              >
                {mensagemUnica}
              </span>
            </Link>
          ) : (
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
          )}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background/80 to-transparent" />
        </div>
      </div>
    </div>
  );
}
