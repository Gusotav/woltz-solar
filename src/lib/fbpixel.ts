// Meta Pixel (navegador) + envio paralelo para a Conversions API (servidor).
// Client-only, tolerante a falha: nunca lança, nunca bloqueia a UI.
// A deduplicação no Meta acontece porque o MESMO eventID vai nos dois caminhos.

import { isTrackingAllowed } from "./googleAds";

const CAPI_ENDPOINT = "/api/public/meta-event";

/** O ID do Pixel é público, mas vem do servidor para não duplicar configuração. */
let pixelIdPromise: Promise<string | null> | null = null;

async function getPixelId(): Promise<string | null> {
  if (!pixelIdPromise) {
    pixelIdPromise = fetch(CAPI_ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { pixel_id?: string | null } | null) => j?.pixel_id ?? null)
      .catch(() => null);
  }
  return pixelIdPromise;
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: unknown;
    _fbPixelInitialized?: boolean;
  }
}

/** Carrega o fbevents.js e inicializa o Pixel uma única vez. */
export async function initPixel(): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (window._fbPixelInitialized) return;
    if (!(await isTrackingAllowed())) return;
    const pixelId = await getPixelId();
    if (!pixelId) return;
    if (window._fbPixelInitialized) return;
    window._fbPixelInitialized = true;

    /* eslint-disable prefer-rest-params */
    if (!window.fbq) {
      const n: Window["fbq"] = function () {
        n!.callMethod ? n!.callMethod!.apply(n, arguments as never) : n!.queue!.push(arguments);
      } as NonNullable<Window["fbq"]>;
      n.queue = [];
      window.fbq = n;
      window._fbq = n;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    /* eslint-enable prefer-rest-params */

    window.fbq("init", FB_PIXEL_ID);
    // Desliga o auto-track de pushState/hash em SPA.
    window.fbq("set", "autoConfig", false, FB_PIXEL_ID);
  } catch (err) {
    console.warn("[fbpixel] falha ao inicializar", err);
  }
}

/** Lê os cookies _fbc e _fbp usados na atribuição do Meta. */
export function getFbcFbp(): { fbc?: string; fbp?: string } {
  if (typeof document === "undefined") return {};
  const read = (name: string) =>
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  const fbc = read("_fbc");
  const fbp = read("_fbp");
  return { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
}

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
};

function newEventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Dispara um evento pelo navegador (fbq) e, em paralelo, pela CAPI,
 * sempre com o mesmo eventID.
 */
export async function trackWebEvent(
  name: string,
  customData: Record<string, unknown> = {},
  userData: MetaUserData = {},
  eventID?: string,
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (!(await isTrackingAllowed())) return;
    await initPixel();

    const id = eventID ?? newEventId();

    try {
      window.fbq?.("track", name, customData, { eventID: id });
    } catch (err) {
      console.warn("[fbpixel] falha no evento web", err);
    }

    const { fbc, fbp } = getFbcFbp();
    void fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: name,
        eventID: id,
        event_source_url: window.location.href,
        user_data: userData,
        custom_data: customData,
        fbc,
        fbp,
      }),
    }).catch((err) => console.warn("[fbpixel] falha no envio CAPI", err));
  } catch (err) {
    console.warn("[fbpixel] falha ao rastrear evento", err);
  }
}
