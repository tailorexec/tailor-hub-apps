# Migrations do TPM — projeto Supabase SEPARADO

> **Não aplique nada daqui no `tailor-site`.** Estas migrations pertencem ao
> projeto do TPM (Tailor Pre-Meeting), que é outro banco. As migrations do hub
> ficam em `../migrations/`.

O TPM tem projeto próprio porque as sessões do hub são emitidas pelo
`tailor-site`: o RLS daqui não teria como reconhecê-las. Em vez de abrir para
`anon`, o acesso é só pelo servidor do hub, com a service key.

Por isso **nenhuma tabela aqui tem policy**. RLS fica ligado e sem política:
a service key passa por cima (é assim que ela funciona), e `anon` e
`authenticated` não enxergam nada. Um vazamento de chave anon deixa de valer.
