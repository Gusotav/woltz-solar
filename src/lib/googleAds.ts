// Google Ads (gtag.js) com Enhanced Conversions + Conversion Linker.
// Tudo client-side, sempre tolerante a falha: nunca lança, nunca bloqueia a UI.

export const GOOGLE_ADS_ID = "AW-18403030450";
export const GOOGLE_ADS_CONVERSION_LABEL = "o-XXCK3Wp_QcELLrn8dE";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Países/territórios que exigem consentimento prévio para cookies de publicidade. */
const CONSENT_REQUIRED = new Set([
  // EEA
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE",
  // UK + Suíça
  "GB", "CH",
]);

let regionAllowed: boolean | null = null;
let regionPromise: Promise<boolean> | null = null;
let loaded = false;

/**
 * Resolve se o rastreamento é permitido na região do visitante.
 * Sem banner: em regiões de consentimento (ou região desconhecida) fica bloqueado.
 */
export async function isTrackingAllowed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (regionAllowed !== null) return regionAllowed;
  if (regionPromise) return regionPromise;

  regionPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/cdn-cgi/trace", { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return false;
      const text = await res.text();
      const loc = /(?:^|\n)loc=([A-Z0-9]{2})/.exec(text)?.[1];
      if (!loc || loc === "XX" || loc === "T1") return false;
      return !CONSENT_REQUIRED.has(loc);
    } catch {
      return false;
    }
  })();

  regionAllowed = await regionPromise;
  return regionAllowed;
}

/** Injeta o gtag.js uma única vez (somente quando a região permite). */
export async function loadGoogleAds(): Promise<void> {
  try {
    if (typeof window === "undefined" || loaded) return;
    if (!(await isTrackingAllowed())) return;
    loaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_ADS_ID, {
      conversion_linker: true,
      allow_enhanced_conversions: true,
    });
  } catch (err) {
    console.warn("[googleAds] falha ao carregar", err);
  }
}

export function normalizeEmail(email?: string | null): string | undefined {
  const v = email?.trim().toLowerCase();
  return v ? v : undefined;
}

export function splitName(fullName?: string | null): {
  first_name?: string;
  last_name?: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  const [first, ...rest] = parts;
  return {
    first_name: first,
    ...(rest.length ? { last_name: rest.join(" ") } : {}),
  };
}

/** Telefone brasileiro em E.164: +55DDNNNNNNNNN */
export function toE164(phone?: string | null): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

export type LeadConversionInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  transactionId: string;
};

/** Dispara a conversão de lead. Nunca lança; silencioso se o gtag não carregou. */
export async function trackLeadConversion(input: LeadConversionInput): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (!(await isTrackingAllowed())) return;
    await loadGoogleAds();
    if (typeof window.gtag !== "function") return;

    const userData: Record<string, unknown> = {
      ...splitName(input.name),
    };
    const email = normalizeEmail(input.email);
    if (email) userData["email"] = email;
    const phone = toE164(input.phone);
    if (phone) userData["phone_number"] = phone;

    window.gtag("set", "user_data", userData);
    window.gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
      value: 1,
      currency: "BRL",
      transaction_id: input.transactionId,
    });
  } catch (err) {
    console.warn("[googleAds] falha ao enviar conversão", err);
  }
}
