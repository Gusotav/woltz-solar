# Salvar leads do formulário + máscara de WhatsApp

## O que muda para o usuário

1. Todo formulário enviado passa a ser gravado no banco do projeto, com os dados de contato e a origem do visitante (campanhas do Google/Meta).
2. O campo WhatsApp passa a formatar o número automaticamente enquanto a pessoa digita: `(51) 99999-9999`.

## Dados salvos por lead

- Nome, WhatsApp, e-mail, cidade/UF, tipo de imóvel, faixa da conta de luz.
- Origem: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, além do site de origem (referrer) e a página de entrada.
- Data/hora do envio.

A origem é capturada na primeira visita e guardada na sessão do navegador, para não se perder caso a pessoa navegue antes de preencher.

## Banco de dados

Nova tabela `public.leads`:

- `nome` (obrigatório), `telefone` (obrigatório), `email`, `cidade`, `tipo_imovel`, `conta_luz`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `referrer`, `landing_page`
- `created_at`, `updated_at` (com gatilho de atualização)

Regras de acesso:
- Qualquer visitante do site pode **enviar** um lead (necessário para o formulário público).
- Ninguém pode ler, editar ou apagar leads pelo site — a consulta fica restrita ao acesso administrativo do backend.
- GRANT de inserção para `anon` e `authenticated`; acesso total para `service_role`.

## Detalhes técnicos

- Migração cria a tabela, GRANTs, RLS habilitado e política `INSERT` para `anon, authenticated` com `WITH CHECK (true)`; reaproveita `public.update_updated_at_column()` para o gatilho de `updated_at`.
- `src/routes/index.tsx`: `handleSubmit` passa a chamar `supabase.from("leads").insert(...)` usando o cliente de `@/integrations/supabase/client`; em caso de erro mostra toast de falha e mantém o formulário preenchido.
- Captura de origem: helper `getTracking()` no mesmo arquivo lendo `URLSearchParams` + `sessionStorage` (chave `woltz_tracking`), com fallback seguro para SSR.
- Máscara: função `maskPhone` aplicada no `onChange` do campo WhatsApp, suportando 10 e 11 dígitos, `maxLength` 15, e validação mínima de 10 dígitos antes do envio.
- Validação de tamanho por campo antes do insert (nome 120, telefone 20, e-mail 255, cidade 120).
- Verificação: typecheck e um teste no navegador enviando o formulário com `?utm_source=...&gclid=...&fbclid=...`, conferindo a linha gravada e removendo o lead de teste em seguida.
