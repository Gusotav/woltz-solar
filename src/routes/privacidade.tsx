import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Woltz Solar" },
      {
        name: "description",
        content:
          "Como a Woltz Solar coleta, usa e compartilha os dados enviados no formulário de simulação de energia solar.",
      },
      { property: "og:title", content: "Política de Privacidade — Woltz Solar" },
      {
        property: "og:description",
        content:
          "Saiba quais dados a Woltz Solar coleta no formulário, com quem são compartilhados e como solicitar exclusão.",
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Voltar para o site
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold md:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: setembro de 2026.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl font-bold">Dados que coletamos</h2>
            <p className="mt-2">
              Ao enviar o formulário de simulação, coletamos os dados que você
              informa: nome, WhatsApp, e-mail, cidade, tipo de imóvel e faixa da
              conta de luz. Coletamos também dados de origem da visita, como
              parâmetros de campanha da URL (utm_source, utm_medium, utm_campaign,
              utm_term, utm_content, gclid, gad_source, gbraid, wbraid, fbclid), o
              site de origem e a página de entrada.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Como usamos</h2>
            <p className="mt-2">
              Usamos esses dados para entrar em contato com você, preparar sua
              simulação de energia solar e medir o desempenho das nossas campanhas
              de publicidade.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Com quem compartilhamos</h2>
            <p className="mt-2">
              Seus dados são armazenados no nosso banco de dados e enviados ao
              nosso CRM (Kommo), usado pela equipe comercial.
            </p>
            <p className="mt-2">
              Para medição de anúncios, compartilhamos com o <strong>Google
              (Google Ads)</strong> dados de contato — e-mail, telefone e nome — de
              forma criptografada pelo próprio sistema do Google, junto com um
              identificador do envio, para atribuir a conversão à campanha
              correspondente (recurso de conversões aprimoradas). Esses dados são
              usados exclusivamente para medição e otimização de anúncios.
            </p>
            <p className="mt-2">
              Utilizamos cookies do Google Ads (incluindo o Vinculador de
              conversões) para essa medição. Em regiões que exigem consentimento
              prévio, como União Europeia, Reino Unido e Suíça, esse rastreamento
              não é carregado.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Seus direitos</h2>
            <p className="mt-2">
              Você pode solicitar acesso, correção ou exclusão dos seus dados, e
              retirar o consentimento a qualquer momento, entrando em contato pelo
              WhatsApp informado no site ou respondendo a qualquer contato da nossa
              equipe. Também é possível desativar a personalização de anúncios nas
              configurações da sua conta Google.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
