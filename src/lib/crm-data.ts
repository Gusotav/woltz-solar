import { supabase } from "@/integrations/supabase/client";

export type Responsavel = {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
};

export type MotivoPerda = {
  id: string;
  motivo: string;
  ativo: boolean;
};

export type Tarefa = {
  id: string;
  lead_id: string;
  responsavel_id: string | null;
  titulo: string;
  descricao: string | null;
  due_at: string | null;
  concluida: boolean;
  created_at: string;
};

export const responsaveisQuery = {
  queryKey: ["responsaveis"] as const,
  queryFn: async (): Promise<Responsavel[]> => {
    const { data, error } = await supabase
      .from("responsaveis")
      .select("id, nome, email, ativo")
      .order("nome");
    if (error) throw error;
    return data ?? [];
  },
};

export const motivosPerdaQuery = {
  queryKey: ["motivos-perda"] as const,
  queryFn: async (): Promise<MotivoPerda[]> => {
    const { data, error } = await supabase
      .from("motivos_perda")
      .select("id, motivo, ativo")
      .eq("ativo", true)
      .order("motivo");
    if (error) throw error;
    return data ?? [];
  },
};

/** Retorna YYYY-MM-DD no fuso local. */
export function toDateInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
