import { useEffect, useRef, useState } from "react";
import { bundledCatalog, fetchCatalog } from "#/lib/template-catalog";

export function useTemplateCatalog() {
  const [catalog, setCatalog] = useState(bundledCatalog);
  const [status, setStatus] = useState<"loading" | "current" | "bundled">(
    "loading",
  );
  const pending = useRef<AbortController | null>(null);
  async function refresh() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setStatus("loading");
    try {
      const next = await fetchCatalog(controller.signal);
      if (pending.current === controller) {
        setCatalog(next);
        setStatus("current");
      }
    } catch {
      if (pending.current === controller) setStatus("bundled");
    } finally {
      clearTimeout(timeout);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, []);
  return { catalog, status, refresh };
}
