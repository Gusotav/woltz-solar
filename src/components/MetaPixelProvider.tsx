import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { initPixel, trackWebEvent } from "@/lib/fbpixel";

// Estado de módulo: sobrevive a remontagens (StrictMode/HMR) e evita PageView duplicado.
let lastPath: string | null = null;
let lastAt = 0;

function maybePageView(path: string) {
  const now = Date.now();
  if (path === lastPath && now - lastAt < 2000) return;
  lastPath = path;
  lastAt = now;
  void trackWebEvent("PageView");
}

/**
 * Inicializa o Meta Pixel e dispara PageView apenas quando pathname/search mudam.
 * Mudança de hash (#proposta) NÃO conta como nova visita.
 */
export function MetaPixelProvider() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useLocation({ select: (l) => l.searchStr });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      await initPixel();
      maybePageView(`${window.location.pathname}${window.location.search}`);
    })();
  }, []);

  useEffect(() => {
    const current = `${pathname}${search ?? ""}`;
    if (lastPath === null) return;
    if (lastPath === current) return;
    maybePageView(current);
  }, [pathname, search]);

  return null;
}

export default MetaPixelProvider;
