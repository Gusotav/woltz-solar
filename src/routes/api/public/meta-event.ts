import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

const userDataSchema = z
  .object({
    email: z.string().max(255).nullish(),
    phone: z.string().max(40).nullish(),
    first_name: z.string().max(120).nullish(),
    last_name: z.string().max(120).nullish(),
    city: z.string().max(120).nullish(),
  })
  .partial()
  .default({});

const bodySchema = z.object({
  event_name: z.string().min(1).max(60),
  eventID: z.string().min(1).max(120),
  event_source_url: z.string().url().max(2000),
  user_data: userDataSchema,
  custom_data: z.record(z.unknown()).default({}),
  fbc: z.string().max(255).optional(),
  fbp: z.string().max(255).optional(),
});

/** SHA-256 de valor normalizado (trim + minúsculas). Vazio → undefined. */
function hashData(value?: string | null): string | undefined {
  const v = value?.trim().toLowerCase();
  if (!v) return undefined;
  return createHash("sha256").update(v).digest("hex");
}

/** Telefone só com dígitos, em padrão internacional (BR) sem "+". */
function normalizePhone(phone?: string | null): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export const Route = createFileRoute("/api/public/meta-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pixelId = process.env["FB_PIXEL_ID"];
        const token = process.env["FB_ACCESS_TOKEN"];
        const testCode = process.env["FB_TEST_EVENT_CODE"];

        if (!pixelId || !token) {
          console.error("[meta-capi] FB_PIXEL_ID ou FB_ACCESS_TOKEN ausente");
          return Response.json({ ok: false, error: "not_configured" }, { status: 200 });
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch (err) {
          console.error("[meta-capi] payload inválido", err);
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const ua = request.headers.get("user-agent") ?? undefined;

        const userData: Record<string, unknown> = {};
        const em = hashData(body.user_data.email);
        if (em) userData["em"] = [em];
        const ph = hashData(normalizePhone(body.user_data.phone));
        if (ph) userData["ph"] = [ph];
        const fn = hashData(body.user_data.first_name);
        if (fn) userData["fn"] = [fn];
        const ln = hashData(body.user_data.last_name);
        if (ln) userData["ln"] = [ln];
        const ct = hashData(body.user_data.city?.replace(/\s+/g, ""));
        if (ct) userData["ct"] = [ct];
        if (body.fbc) userData["fbc"] = body.fbc;
        if (body.fbp) userData["fbp"] = body.fbp;
        if (ip) userData["client_ip_address"] = ip;
        if (ua) userData["client_user_agent"] = ua;

        const payload: Record<string, unknown> = {
          data: [
            {
              event_name: body.event_name,
              event_time: Math.floor(Date.now() / 1000),
              event_id: body.eventID,
              event_source_url: body.event_source_url,
              action_source: "website",
              user_data: userData,
              custom_data: body.custom_data,
            },
          ],
        };
        if (testCode) payload["test_event_code"] = testCode;

        try {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const text = await res.text();
          if (!res.ok) {
            console.error("[meta-capi] erro do Meta", res.status, text);
            return Response.json({ ok: false }, { status: 200 });
          }
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[meta-capi] falha na requisição", err);
          return Response.json({ ok: false }, { status: 200 });
        }
      },
    },
  },
});
