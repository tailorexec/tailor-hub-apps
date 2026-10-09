import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

// O blog é do site institucional, que vive no mesmo banco do hub. As capas vêm
// gravadas como caminho relativo ao site ("/blog/x.webp").
const SITE = "https://www.tailorexec.com.br";
const QUANTOS = 3;

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
}

const absoluta = (url: string) => (/^https?:\/\//.test(url) ? url : `${SITE}${url}`);

/** Últimos posts publicados do blog da Tailor, na lateral da página inicial. */
export function BlogRecente() {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    supabase
      .from("posts")
      .select("id,title,slug,excerpt,cover_image_url")
      .eq("status", "published")
      .eq("language", "pt")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(QUANTOS)
      .then(({ data, error }) => {
        if (error) console.warn("[blog] falha ao carregar posts:", error);
        setPosts(data ?? []);
      });
  }, []);

  // Sem post (ou com erro), a lateral some em vez de mostrar uma caixa vazia.
  if (posts !== null && posts.length === 0) return null;

  return (
    <section aria-labelledby="blog-recente">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          id="blog-recente"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Últimas do blog
        </h2>
        <a
          href={`${SITE}/blog`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {posts === null
          ? Array.from({ length: QUANTOS }, (_, i) => (
              <li key={i} className="flex gap-3 p-3">
                <div className="w-20 h-16 shrink-0 rounded-lg bg-muted animate-pulse" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                </div>
              </li>
            ))
          : posts.map((post) => (
              <li key={post.id}>
                <a
                  href={`${SITE}/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="w-20 h-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {post.cover_image_url && (
                      <img
                        src={absoluta(post.cover_image_url)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                      {post.title}
                    </div>
                    {post.excerpt && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="self-center flex w-7 h-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </a>
              </li>
            ))}
      </ul>
    </section>
  );
}
