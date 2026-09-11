import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Retorna true quando o usuário logado possui o papel de administrador. */
export function useIsAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return false;
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return Boolean(roles);
    },
    staleTime: 5 * 60 * 1000,
  });

  return { isAdmin: data ?? false, isLoading };
}
