# Tailor Hub

Hub interno da Tailor Executive Search — gerador de currículos no padrão Tailor e
pesquisa de NPS. Produção: **https://hub.tailorexec.com.br**

Stack: TanStack Start (React 19) + Vite 7 + Tailwind 4 + Supabase, publicado na
Vercel (Nitro/Vercel Functions).

## Requisitos

- Node.js 20+ (testado em 24)
- Conta Vercel (deploy) — DNS na Umbler
- Acesso ao projeto Supabase `tailor-site`
- Chave da API da Anthropic

## Setup local

```bash
npm install
cp .env.example .env    # preencher os valores
npm run dev             # http://localhost:8080
```

## Scripts

| Comando             | O que faz                                            |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Dev server na porta 8080                             |
| `npm run build`     | Build de produção em `.output/` (client + servidor)  |
| `npm run preview`   | Serve o build localmente                             |
| `npm run typecheck` | `tsc --noEmit`                                       |
| `npm run lint`      | ESLint + Prettier                                    |
| `npm run format`    | Aplica o Prettier                                    |

## Variáveis de ambiente

As `VITE_*` são **públicas** — o Vite as injeta no bundle do cliente. As demais só
existem no servidor.

| Variável                    | Onde              | Descrição                                        |
| --------------------------- | ----------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`         | cliente + servidor| URL do projeto Supabase                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | Chave anon/publishable                      |
| `VITE_SUPABASE_PROJECT_ID`  | cliente + servidor| Ref do projeto                                   |
| `SUPABASE_URL`              | servidor          | Mesmo valor, lido via `process.env` no SSR       |
| `SUPABASE_PUBLISHABLE_KEY`  | servidor          | Idem                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | **segredo**       | Bypassa RLS. Só no servidor.                     |
| `ANTHROPIC_API_KEY`         | **segredo**       | Usada em `/api/generate-resume`                  |
| `ANTHROPIC_MODEL`           | servidor (opc.)   | Default `claude-opus-5`                          |
| `ANTHROPIC_EFFORT`          | servidor (opc.)   | `low`\|`medium`\|`high`\|`xhigh`\|`max`          |

Em produção todas elas são cadastradas em **Vercel → Project → Settings →
Environment Variables**. As `VITE_*` precisam existir no ambiente de *build*.

## Deploy

A Vercel detecta TanStack Start + Nitro automaticamente — não é preciso definir
build command nem output directory. Basta conectar o repositório
`tailorexec/tailor-hub-apps` e configurar as variáveis de ambiente.

### Domínio

`hub.tailorexec.com.br` é apontado na **Umbler** (onde está o DNS da zona) com um
registro `CNAME` para o alvo que a Vercel indicar em *Project → Settings →
Domains* (normalmente `cname.vercel-dns.com`).

## Banco de dados

> **Atenção:** o projeto Supabase `tailor-site` (`xxltytblimzhcyqlvikx`) é
> **compartilhado com o site institucional**. Ele já contém `profiles`,
> `user_roles`, o enum `app_role`, `posts`, `curriculum_submissions` e as tabelas
> de e-mail. Qualquer migration do hub precisa ser **aditiva e idempotente**.

As migrations originais do Lovable estão em `supabase/legacy-lovable-migrations/`
apenas como referência — elas fazem `CREATE TYPE`/`CREATE TABLE` sem guardas e
**quebrariam o site** se aplicadas.

Tabelas que o hub usa: `profiles` (com `status = 'approved'` liberando acesso),
`user_roles`, `generations` (quota de 15 gerações/dia), `nps_responses` e
`nps_access`.

### Aplicar a migration

Valide antes num transação que se desfaz:

```sql
BEGIN;
-- conteúdo de supabase/migrations/20260909120000_hub_aditivo_banco_compartilhado.sql
ROLLBACK;   -- trocar por COMMIT quando passar sem erro
```

### Sobre o cadastro no banco compartilhado

A `public.handle_new_user()` do site é quem cria a linha em `profiles`:

```sql
INSERT INTO public.profiles (id, full_name, avatar_url) VALUES (...)
```

Dois pontos que moldaram a migration:

1. **Não grava `email`.** Por isso o hub adiciona o trigger
   `zz_hub_fill_profile_email`, que só faz `UPDATE` e tem o prefixo `zz_` para
   disparar depois do `on_auth_user_created` (triggers rodam em ordem
   alfabética). Um trigger do hub que fizesse `INSERT` competiria com esse aqui
   e, como ele não usa `ON CONFLICT`, quebraria o cadastro com chave duplicada.

2. **Não grava `status`** — o valor vem do `DEFAULT` da coluna, que era
   `'approved'`. Ou seja, qualquer pessoa que se cadastrasse entrava aprovada e
   ganhava o gerador. A migration força o `DEFAULT` para `'pending'`. Isso muda
   o comportamento do site também: cadastros novos nascem `'pending'` lá
   igualmente. É intencional — a falha passa a negar acesso em vez de conceder.
   As linhas já existentes não são tocadas.

### Verificação pós-deploy

Cadastre um usuário de teste em `/signup` e confirme que o default pegou:

```sql
select u.email, p.status, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.created_at desc
 limit 3;
```

O usuário novo tem que aparecer como `pending`. Se vier `approved`, a migration
não foi aplicada.

## Estrutura

```
src/
├── routes/
│   ├── __root.tsx                 shell HTML, meta tags, providers
│   ├── index.tsx                  landing
│   ├── login.tsx / signup.tsx     autenticação Supabase
│   ├── _authenticated.*.tsx       área logada (generator, nps, admin)
│   ├── nps.form.tsx               formulário público de NPS
│   └── api/
│       ├── generate-resume.ts     PDF/DOCX/TXT → Claude → .docx padrão Tailor
│       └── usage.ts               consulta da quota diária
├── integrations/supabase/         clients, middleware de auth, tipos
├── components/                    UI da Tailor + shadcn/ui
└── server.ts                      entrypoint do servidor (wrapper de erro SSR)
```

## Notas

- O projeto nasceu no Lovable; todas as dependências e integrações da plataforma
  foram removidas (build próprio no `vite.config.ts`, IA via API da Anthropic).
- O gerador usa Claude Opus 5 com `effort: medium` por padrão — ajustável por
  `ANTHROPIC_MODEL` / `ANTHROPIC_EFFORT` sem alterar código.
- `.gitattributes` força LF. Sem isso o checkout no Windows vira CRLF e o
  `eslint-plugin-prettier` acusa erro em todas as linhas.
