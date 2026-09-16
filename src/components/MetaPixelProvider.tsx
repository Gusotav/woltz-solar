import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { initPixel, trackWebEvent } from "@/lib/fbpixel";

/**
 * Inicializa o Meta Pixel e dispara PageView apenas quando pathname/search mudam.
 * Mudança de hash (#proposta) NÃO conta como nova visita.
 */
export function MetaPixelProvider() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useLocation({ select: (l) => l.searchStr });
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      await initPixel();
      lastPathRef.current = `${window.location.pathname}${window.location.search}`;
      void trackWebEvent("PageView");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = `${pathname}${search ?? ""}`;
    if (lastPathRef.current === null) return;
    if (lastPathRef.current === current) return;
    lastPathRef.current = current;
    void trackWebEvent("PageView");
  }, [pathname, search]);

  return null;
}

export default MetaPixelProvider;
