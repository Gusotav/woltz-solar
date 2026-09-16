# Conversões do Google Ads no formulário

## O que muda para o visitante

Nada visualmente. O formulário continua igual; só a lógica de envio muda.

Ao enviar:

1. O lead é salvo no banco (como hoje).
2. É enviado ao Kommo (como hoje).
3. **Só se o Kommo confirmar**, a conversão é registrada no Google Ads, com dados do
   contato (e-mail, telefone, nome) normalizados, um identificador único do envio
   (o ID do lead no banco), valor 1 e moeda BRL.

Se o banco ou o Kommo falharem, nenhuma conversão é enviada e o visitante vê a
mensagem de erro atual. Se o Google Ads demorar ou falhar, o visitante não percebe:
a confirmação aparece normalmente.

## Origem do visitante (UTMs)

Regras aplicadas na hora do envio, nessa ordem:

1. `utm_source` presente na URL → usa o valor exato da URL.
2. Sem `utm_source`, mas com `gclid`, `gad_source`, `gbraid` ou `wbraid` →
   `utm_source = "google"`, `utm_medium = "cpc"`.
3. Sem parâmetros, mas veio de outro site → `utm_source` = domínio do site de origem.
4. Nada disso → `utm_source = "direct"`, `utm_medium = "none"`.

Passam a ser guardados também `gad_source`, `gbraid` e `wbraid`, no banco e no Kommo.

## Privacidade

Escolha confirmada: sem aviso de cookies. Em regiões que exigem consentimento
(Europa, Reino Unido, Suíça e afins) nada de Google Ads é carregado nem enviado —
a região é detectada pelo próprio servidor do site; se não der para identificar,
o rastreamento fica bloqueado por segurança. No Brasil funciona normalmente.

A política de privacidade do site será atualizada para informar que dados de contato
(e-mail, telefone, nome) são compartilhados com o Google para medição de anúncios,
e como pedir a exclusão. Hoje o site não tem essa página; ela será criada em `/privacidade`
com link no rodapé.

## Detalhes técnicos

**Banco** (migração): novas colunas em `public.leads` — `gad_source text`,
`gbraid text`, `wbraid text`.

**`src/lib/googleAds.ts`** (novo, client-side):
- Tipagem de `window.gtag` / `window.dataLayer` via `declare global`.
- `loadGoogleAds()`: injeta `https://www.googletagmanager.com/gtag/js?id=AW-18403030450`
  (async) uma única vez, inicializa o `dataLayer`, `gtag('js', new Date())` e
  `gtag('config', 'AW-18403030450')` com `conversion_linker: true` e
  `allow_enhanced_conversions: true`; chamado apenas quando a região permite.
- Normalização: `normalizeEmail` (trim + minúsculas), `splitName`
  (`first_name` = primeira palavra, `last_name` = resto), `toE164` (dígitos;
  11/10 dígitos → prefixo `+55`; já com 55 → `+55...`).
- `trackLeadConversion({ email, phone, name, transactionId })`:
  `gtag('set', 'user_data', {...})` seguido de
  `gtag('event', 'conversion', { send_to: 'AW-18403030450/o-XXCK3Wp_QcELLrn8dE',
  value: 1, currency: 'BRL', transaction_id })`. Tudo em `try/catch`, nunca lança;
  se o gtag não carregou, sai em silêncio.
- Cada função é no-op fora do browser e quando o rastreamento está bloqueado.

**Bloqueio regional**: helper lê `/cdn-cgi/trace` (mesmo domínio, timeout ~2s) e
compara o `loc=` com a lista de países que exigem consentimento; falha, resposta
não-OK, `XX` ou `T1` → bloqueado. Resultado cacheado na visita.

**`src/routes/__root.tsx`**: componente client-only que, após a hidratação, resolve
a região e só então chama `loadGoogleAds()`. Nada de script no `head` em SSR, para
que o bloqueio regional valha de fato.

**`src/routes/index.tsx`**: `getTracking()` ganha `gad_source`, `gbraid`, `wbraid` e as
4 regras de atribuição acima (aplicadas depois de ler URL + sessionStorage).
Em `handleSubmit`, `submitLead` passa a ter o retorno usado: só quando
`kommoLeadId` não for nulo, dispara `trackLeadConversion` com
`transactionId = id` do lead, sem `await` bloqueando a UI. Se `kommoLeadId` vier nulo,
mostra aviso de erro temporário e não dispara conversão. Estilos e markup intocados.

**`src/lib/leads.functions.ts`** / **`kommo.server.ts`**: aceitam e repassam os três
novos campos; o retorno já traz `id` e `kommoLeadId`.

**Nova rota `/privacidade`** com o texto de privacidade e link no rodapé.

**Verificação**: typecheck e envio real pelo navegador com
`?utm_source=...&gclid=...`, conferindo o evento de conversão no `dataLayer`,
a linha no banco e o lead no Kommo, removendo os registros de teste depois.
