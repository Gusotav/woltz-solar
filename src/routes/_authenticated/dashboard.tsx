import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Users, Trophy, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, channelLabel } from "@/lib/leads";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard comercial — Woltz CRM" },
      { name: "description", content: "Métricas de leads, conversão e canais da Rhopi Marcenaria." },
      { property: "og:title", content: "Dashboard comercial — Woltz CRM" },
      { property: "og:description", content: "Métricas de leads, conversão e canais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function DashboardPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        const created = new Date(l.created_at);
        if (from && created < new Date(`${from}T00:00:00`)) return false;
        if (to && created > new Date(`${to}T23:59:59`)) return false;
        return true;
      }),
    [leads, from, to],
  );

  const ganhos = filtered.filter((l) => l.status === "ganho");
  const receita = ganhos.reduce((acc, l) => acc + (l.investimento_valor ?? 0), 0);
  const conversao = filtered.length ? (ganhos.length / filtered.length) * 100 : 0;

  const funil = STAGES.map((s) => ({
    stage: s.label,
    total: filtered.filter((l) => l.stage === s.key).length,
  }));

  const canais = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filtered) {
      const key = channelLabel(l.utm_source);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl">Dashboard comercial</h1>
        <p className="text-sm text-muted-foreground">Desempenho de leads e conversão</p>
      </div>

      <div className="surface-card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <Label htmlFor="d-from" className="text-xs">
            De
          </Label>
          <Input
            id="d-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-to" className="text-xs">
            Até
          </Label>
          <Input
            id="d-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Leads no período"
          value={String(filtered.length)}
        />
        <MetricCard
          icon={<Trophy className="h-4 w-4" />}
          label="Negócios ganhos"
          value={String(ganhos.length)}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita ganha"
          value={BRL.format(receita)}
        />
        <MetricCard
          icon={<Percent className="h-4 w-4" />}
          label="Taxa de conversão"
          value={`${conversao.toFixed(1)}%`}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando métricas...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-4">
            <h2 className="mb-4 text-sm font-semibold">Distribuição no funil</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funil}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="stage" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-4">
            <h2 className="mb-4 text-sm font-semibold">Canais de aquisição</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={canais} dataKey="value" nameKey="name" outerRadius={95} label>
                    {canais.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
