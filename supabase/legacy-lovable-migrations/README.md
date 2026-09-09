# Migrations da era Lovable — NÃO APLICAR

Estas migrations criaram o banco do projeto Supabase antigo
(`scggvddtuwjcfdtavhod`), provisionado pelo Lovable Cloud e fora da
organização da Tailor.

O hub agora usa o projeto **tailor-site** (`xxltytblimzhcyqlvikx`), que é
**compartilhado com o site institucional** e já possui `profiles`, `user_roles`,
o enum `app_role` e as tabelas de e-mail/posts do site.

Rodar `supabase db push` com estes arquivos **quebraria o site**: eles fazem
`CREATE TYPE app_role` e `CREATE TABLE profiles` sem guardas.

Ficam aqui apenas como referência da estrutura esperada pelo hub. A migração
real para o banco compartilhado é aditiva e vive em `supabase/migrations/`.
