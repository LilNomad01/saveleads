# Atualização: filtro "Somente empresas sem site"

Foi adicionada uma opção no extrator do Google Maps para extrair e salvar somente empresas que não possuem website cadastrado no Google Maps.

## O que mudou

- Novo campo **Filtro de Site** na tela de extração.
- Opção **Somente sem site**.
- O filtro é aplicado no backend antes dos leads serem gravados no Supabase.
- Quando o filtro está ativo, o scraper consulta mais empresas para tentar atingir a quantidade solicitada apenas com empresas sem site.
- Corrigido um erro antigo em que o link da ficha do Google Maps (`place.url`) era salvo como se fosse o site da empresa.
- A tabela também passa a ignorar links antigos do Google Maps que tenham sido salvos no campo `site`.

## Importante ao publicar

Como houve alteração na Edge Function do Supabase, publique novamente a função `extract-leads` no mesmo projeto Supabase usado pelo sistema.

Exemplo com Supabase CLI:

```bash
supabase functions deploy extract-leads
```

Depois publique normalmente o frontend.
