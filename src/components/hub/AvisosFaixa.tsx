import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SEM_AVISOS =
  "Sem avisos e lembretes, keep pushing! Utilizem as ferramentas de forma consciente.";
const SEM_LOGIN = "Entre no hub para ver os avisos e lembretes da Tailor.";

/**
 * O que roda junto com a frase de "sem avisos". Sozinha, ela atravessava uma
 * faixa de 1.300 px e deixava a maior parte do tempo vazia no desktop. São
 * lembretes que valem para qualquer dia — se um deixar de ser verdade (o
 * limite do TPM, por exemplo), mude aqui.
 */
const LEMBRETES: Item[] = [
  {
    texto: "Apresentações Padrão 2026: faça sempre uma cópia antes de editar.",
    rota: "/apresentacoes",
  },
  {
    texto: "TPM: até 3 briefings por pessoa a cada 24 horas. Guarde para as reuniões que importam.",
    rota: "/tpm",
  },
  {
    texto: "Gerador de Currículo: envie o PDF do candidato e receba o Word no padrão Tailor.",
    rota: "/generator",
  },
];

const SITE = "https://www.tailorexec.com.br";

/** Com quantos caracteres uma volta do trilho fica mais larga que a tela. */
const CARACTERES_MINIMOS = 220;

interface Item {
  texto: string;
  /** Página do hub para onde o item leva. */
  rota?: string;
  /** Endereço de fora (o post do blog). */
  url?: string;
}

/**
 * Faixa de avisos da página inicial, publicados pelo admin em /admin.
 *
 * A faixa aparece para todo mundo, mas os avisos só para quem está logado: a
 * página inicial é pública e aviso é interno — o banco também não entrega
 * nada para `anon`. Sem login, a faixa convida a entrar.
 *
 * Sem aviso publicado, roda a frase padrão intercalada com o post mais recente
 * do blog e os lembretes acima, para a faixa nunca ficar vazia.
 */
export function AvisosFaixa() {
  const { session, loading } = useAuth();
  const [avisos, setAvisos] = useState<string[] | null>(null);
  const [ultimoPost, setUltimoPost] = useState<Item | null>(null);

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

  useEffect(() => {
    // O blog é público; serve logado ou não.
    supabase
      .from("posts")
      .select("title,slug")
      .eq("status", "published")
      .eq("language", "pt")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const post = data?.[0];
        if (post)
          setUltimoPost({ texto: `Novo no blog: ${post.title}`, url: `${SITE}/blog/${post.slug}` });
      });
  }, []);

  // Enquanto a sessão ou os avisos carregam, a faixa já ocupa o lugar dela,
  // vazia — senão a página pula quando ela aparece.
  const carregando = loading || (session && avisos === null);
  const blog = ultimoPost ? [ultimoPost] : [];
  const itens: Item[] = carregando
    ? []
    : !session
      ? [{ texto: SEM_LOGIN, rota: "/login" }, ...blog]
      : avisos!.length > 0
        ? avisos!.map((texto) => ({ texto }))
        : [{ texto: SEM_AVISOS }, ...blog, ...LEMBRETES];

  // Repete a lista até uma volta ser mais larga que a tela; senão, com pouco
  // texto, sobraria um buraco vazio antes da repetição.
  const caracteres = itens.reduce((n, i) => n + i.texto.length + 6, 0);
  // Lista vazia (faixa ainda carregando) daria divisão por zero e um
  // Array.from infinito, que derruba a página inteira.
  const repeticoes = caracteres > 0 ? Math.max(1, Math.ceil(CARACTERES_MINIMOS / caracteres)) : 0;
  const volta = Array.from({ length: repeticoes }, () => itens).flat();
  // Velocidade constante, seja qual for o tamanho dos textos.
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
          aria-label={`Avisos: ${itens.map((i) => i.texto).join(". ")}`}
        >
          {!carregando && (
            <div
              className="hub-avisos-trilho flex w-max h-full items-center"
              style={{ ["--hub-avisos-duracao" as string]: `${duracao}s` }}
            >
              {/* A segunda cópia existe só para o laço não dar pulo: leitor de
                  tela e Tab ignoram. */}
              {[0, 1].map((copia) => (
                <div key={copia} className="flex items-center" aria-hidden={copia === 1}>
                  {volta.map((item, i) => (
                    <Fragment key={i}>
                      <ItemFaixa item={item} foco={copia === 0} />
                      <span className="text-[8px] text-primary" aria-hidden>
                        ●
                      </span>
                    </Fragment>
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

function ItemFaixa({ item, foco }: { item: Item; foco: boolean }) {
  const classe = "px-6 md:px-8 text-sm text-foreground/80 whitespace-nowrap";
  const comLink = `${classe} hover:text-primary hover:underline underline-offset-4`;
  const tabIndex = foco ? undefined : -1;

  if (item.rota) {
    return (
      <Link to={item.rota} className={comLink} tabIndex={tabIndex}>
        {item.texto}
      </Link>
    );
  }
  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={comLink}
        tabIndex={tabIndex}
      >
        {item.texto}
      </a>
    );
  }
  return <span className={classe}>{item.texto}</span>;
}
