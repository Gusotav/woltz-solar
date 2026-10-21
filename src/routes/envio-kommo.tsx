import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getKommoDashboard, lockKommoDashboard, retryKommoLeads, unlockKommoDashboard } from "@/lib/kommoAdmin.functions";

export const Route = createFileRoute("/envio-kommo")({
  loader: () => getKommoDashboard(),
  head: () => ({
    meta: [
      { title: "Área restrita | Woltz Solar" },
      { name: "description", content: "Área restrita." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow" },
      { property: "og:title", content: "Área restrita | Woltz Solar" },
      { property: "og:description", content: "Área restrita." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnvioKommo,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

function EnvioKommo() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const unlock = useServerFn(unlockKommoDashboard);
  const lock = useServerFn(lockKommoDashboard);
  const retry = useServerFn(retryKommoLeads);
  const [busy, setBusy] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState(false);

  if (!data.unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <form
          className="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const password = String(new FormData(e.currentTarget).get("password") ?? "");
            const r = await unlock({ data: { password } });
            if (r.ok) { setErroSenha(false); await router.invalidate(); } else setErroSenha(true);
          }}
        >
          <h1 className="text-xl font-bold">Envio ao Kommo</h1>
          <input name="password" type="password" autoComplete="current-password" placeholder="Senha"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" required />
          {erroSenha && <p className="text-sm text-destructive">Senha incorreta.</p>}
          <button className="w-full rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">Entrar</button>
        </form>
      </main>
    );
  }

  const leads = data.leads;
  const falhas = leads.filter((l) => l.kommo_status !== "enviado");
  const enviados = leads.length - falhas.length;

  async function reenviar(ids: string[], key: string) {
    setBusy(key);
    try {
      const { results } = await retry({ data: { ids } });
      const ok = results.filter((r) => r.ok).length;
      if (ok === results.length) toast.success(`${ok} lead(s) enviado(s) ao Kommo.`);
      else toast.error(`${ok} de ${results.length} enviados. Veja os erros na tabela.`);
      await router.invalidate();
    } catch {
      toast.error("Não foi possível reenviar agora.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Envio de leads ao Kommo</h1>
          <div className="flex gap-2">
            <button disabled={!falhas.length || !!busy} onClick={() => reenviar(falhas.map((l) => l.id), "all")}
              className="rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">
              {busy === "all" ? "Reenviando..." : `Reenviar falhas (${falhas.length})`}
            </button>
            <button onClick={async () => { await lock(); await router.invalidate(); }}
              className="rounded-md border border-border px-4 py-2">Sair</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["Total", leads.length], ["Enviados", enviados], ["Com falha", falhas.length]].map(([k, v]) => (
            <div key={k} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-muted-foreground">
              <tr><th className="p-3">Data</th><th className="p-3">Nome</th><th className="p-3">Contato</th><th className="p-3">Status</th><th className="p-3">Kommo</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="p-3 whitespace-nowrap">{fmt(l.created_at)}</td>
                  <td className="p-3">{l.nome}<div className="text-muted-foreground">{l.cidade}</div></td>
                  <td className="p-3">{l.telefone}<div className="text-muted-foreground">{l.email}</div></td>
                  <td className="p-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${l.kommo_status === "enviado" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                      {l.kommo_status}
                    </span>
                    {l.kommo_error && <p className="mt-1 max-w-xs break-words text-xs text-muted-foreground">{l.kommo_error.slice(0, 200)}</p>}
                  </td>
                  <td className="p-3">{l.kommo_lead_id ?? "—"}<div className="text-muted-foreground">{fmt(l.kommo_sent_at)}</div></td>
                  <td className="p-3">
                    {l.kommo_status !== "enviado" && (
                      <button disabled={!!busy} onClick={() => reenviar([l.id], l.id)}
                        className="rounded-md border border-border px-3 py-1 disabled:opacity-50">
                        {busy === l.id ? "Enviando..." : "Tentar novamente"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
