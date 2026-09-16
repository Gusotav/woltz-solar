# Meta Pixel (navegador) + Conversions API (servidor)

Rastrear visitas e envios de formulário no Meta, enviando cada evento por dois caminhos (navegador e servidor) com o mesmo identificador, para o Meta contar uma vez só.

## Comportamento

- Visita de página: enviada uma vez por página. Clicar em links de âncora (#proposta, #projetos) não conta nova visita.
- Envio do formulário: o evento "Lead" só dispara quando o envio ao Kommo é confirmado — mesma regra já usada no Google Ads.
- Regiões: mesma política atual — sem banner; em Europa, Reino Unido e Suíça o Pixel não carrega. No Brasil funciona normalmente.
- Se o Meta falhar ou demorar, nada trava: o visitante continua vendo a confirmação normal.

## Credenciais necessárias

Vou pedir pelo formulário seguro:
- `FB_PIXEL_ID` (ID do Pixel)
- `FB_ACCESS_TOKEN` (token da Conversions API — nunca vai para o navegador)
- `FB_TEST_EVENT_CODE` (opcional, só para testes no Gerenciador de Eventos)

O ID do Pixel também precisa ficar disponível no navegador, então será exposto via `VITE_FB_PIXEL_ID` (é público por natureza; o token não).

## Detalhes técnicos

1. `src/lib/fbpixel.ts` (novo)
   - `initPixel()` client-only, com guard `window._fbPixelInitialized` (evita duplo init no HMR).
   - Carrega `fbevents.js`, `fbq('init', PIXEL_ID)`, `fbq('set', 'autoConfig', false, PIXEL_ID)` para desligar auto-track de pushState/hash.
   - Reusa `isTrackingAllowed()` de `src/lib/googleAds.ts` para o bloqueio regional.
   - `getFbcFbp()` lê `_fbc` e `_fbp` de `document.cookie`.
   - `trackWebEvent(name, customData, userData?, eventID?)`: gera `crypto.randomUUID()` se não vier, chama `fbq('track', name, customData, { eventID })` e em paralelo faz `fetch('/api/public/meta-event', ...)`. Tudo em try/catch; nunca lança.

2. `src/components/MetaPixelProvider.tsx` (novo)
   - `useEffect` 1: `initPixel()` + primeiro PageView; guarda `lastPathRef = pathname + search`.
   - `useEffect` 2: deps apenas `location.pathname` e `location.search` (sem `hash`); dispara PageView só quando o valor muda.
   - Montado em `src/routes/__root.tsx` dentro de `<ClientOnly>`.

3. Âncoras em `src/routes/index.tsx`
   - Os 8 `<a href="#proposta|#projetos">` viram botões/links com `e.preventDefault()` + `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`. Só a lógica de clique muda; classes e visual permanecem idênticos.

4. `src/routes/api/public/meta-event.ts` (novo — endpoint POST)
   - Valida o corpo com Zod: `event_name`, `eventID`, `event_source_url`, `user_data`, `custom_data`, `fbc`, `fbp`.
   - Lê `FB_PIXEL_ID`, `FB_ACCESS_TOKEN`, `FB_TEST_EVENT_CODE` de `process.env` dentro do handler.
   - `hashData()`: trim + lowercase + SHA-256 (node `crypto`) para email, telefone, nome, sobrenome, cidade; campos vazios são omitidos.
   - `user_data` inclui `fbc`, `fbp`, `client_ip_address` (`x-forwarded-for`) e `client_user_agent` (`user-agent`).
   - POST para `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=...` com `action_source: 'website'` e `event_time` em segundos. Erros logados no servidor; resposta sempre rápida ao cliente.

5. `src/routes/index.tsx` — `handleSubmit`
   - Onde hoje dispara `trackLeadConversion` (só com `kommoLeadId`), dispara também `trackWebEvent('Lead', { content_name: 'form_contato', content_category: 'lead_form' }, { email, phone, first_name, last_name, city })`, sem `await`.

## Aceite

- Clicar em #proposta não gera PageView no Pixel Helper.
- Ir de `/` para `/privacidade` gera exatamente 1 PageView.
- Nenhum `fbq` no SSR.
- `FB_ACCESS_TOKEN` ausente do bundle do navegador (verificado por busca no build/network).
