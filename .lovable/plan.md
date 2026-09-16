# Integração do formulário com o CRM Kommo

## O que muda para o usuário

Ao enviar o formulário do site:

1. O lead é gravado no banco do projeto (como hoje).
2. Em seguida é criado automaticamente no Kommo (woltzsolar.kommo.com), no funil **Pré-Qualificação** (11656355), etapa **Novo Lead** (89559675).
3. Se o Kommo estiver fora do ar, o lead **não se perde**: fica salvo no banco marcado como "pendente de envio" e o painel do banco mostra o erro.

O visitante continua vendo a confirmação normal, mesmo que o Kommo falhe.

## Dados enviados ao Kommo

- Nome do lead: nome informado
- Telefone (WhatsApp), e-mail, cidade
- Tipo de imóvel, faixa da conta de luz
- utm_source, utm_medium, utm_campaign, utm_term, utm_content
- gclid, fbclid, referrer (site de origem), landing_page (página de entrada)

Como você escolheu campos personalizados: na primeira vez que um lead for enviado, a integração verifica os campos personalizados de lead existentes no Kommo e **cria automaticamente os que faltarem** (um campo de texto para cada item acima), reaproveitando os que já existirem com o mesmo nome. Não é preciso me passar IDs.

## Credenciais

Vou pedir por formulário seguro (nunca aparecem no chat nem no código):

- `KOMMO_LONG_LIVED_TOKEN` — token de longa duração
- `KOMMO_INTEGRATION_ID` — ID da integração
- `KOMMO_SECRET_KEY` — chave secreta

O envio usa o token de longa duração; ID e chave ficam guardados para uso futuro (ex.: renovação por OAuth).

## Detalhes técnicos

**Banco** (migração):
- Novas colunas em `public.leads`: `kommo_lead_id bigint`, `kommo_status text default 'pendente'`, `kommo_error text`, `kommo_sent_at timestamptz`.
- Nova tabela `public.kommo_field_map` (`field_key text pk`, `field_id bigint`, `created_at`) para guardar o mapeamento nome→ID dos campos personalizados. GRANT apenas para `service_role`, RLS habilitada sem políticas públicas.
- A política pública de INSERT em `leads` deixa de ser necessária para o fluxo: o envio passa a ser feito por função de servidor. Mantida por compatibilidade, sem uso.

**Servidor** (`src/lib/leads.functions.ts`, novo):
- `submitLead` (`createServerFn`, POST) com validação Zod de todos os campos (limites de tamanho iguais aos atuais, telefone com mín. 10 dígitos).
- Insere o lead com `supabaseAdmin` (import dentro do handler), depois chama o helper do Kommo.
- Em sucesso grava `kommo_lead_id`, `kommo_status='enviado'`, `kommo_sent_at`; em falha grava `kommo_status='erro'` e `kommo_error` com status + corpo da resposta, e ainda retorna sucesso ao visitante.
- Função pública (sem `requireSupabaseAuth`), chamada pelo componente, nunca por loader.

**Helper Kommo** (`src/lib/kommo.server.ts`, novo):
- Base `https://woltzsolar.kommo.com/api/v4`, header `Authorization: Bearer ${KOMMO_LONG_LIVED_TOKEN}` (lido de `process.env` dentro do handler).
- `ensureFields()`: `GET /leads/custom_fields` → compara com a lista esperada → `POST /leads/custom_fields` para os que faltam → persiste em `kommo_field_map`, com cache em memória por worker.
- `createLead()`: `POST /leads/complex` com `name`, `pipeline_id: 11656355`, `status_id: 89559675`, `custom_fields_values` montado a partir do mapa.
- Toda resposta não-OK é logada com status + corpo e propagada como erro.

**Frontend** (`src/routes/index.tsx`):
- `handleSubmit` troca o `supabase.from("leads").insert(...)` por `useServerFn(submitLead)`, mantendo máscara de telefone, validações, estado de envio e toasts atuais.

**Verificação**: typecheck, envio real pelo navegador com `?utm_source=...&gclid=...&fbclid=...`, conferência do lead criado no Kommo e da linha no banco, e remoção do registro de teste dos dois lados.
