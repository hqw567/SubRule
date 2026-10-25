import { useEffect, useState } from "react";
import { formatForUrl } from "#/lib/formats";
export type HistoryEntry = {
  url: string;
  count: number;
  time: number;
};
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    try {
      const enabled =
        localStorage.getItem("subweave-history-enabled") === "true";
      setRemember(enabled);
      const saved = JSON.parse(localStorage.getItem("subweave-history") || "[]");
      if (enabled && Array.isArray(saved))
        setEntries(
          saved
            .filter(
              (e) =>
                e &&
                typeof e.url === "string" &&
                typeof e.time === "number" &&
                !!formatForUrl(e.url) &&
                typeof e.count === "number",
            )
            .slice(0, 20)
            .map(({ url, count, time }) => ({ url, count, time })),
        );
    } catch {
      /* Storage is optional. */
    }
  }, []);
  function save(next: HistoryEntry[], enabled = remember) {
    setEntries(next);
    try {
      if (enabled)
        localStorage.setItem("subweave-history", JSON.stringify(next));
      else localStorage.removeItem("subweave-history");
    } catch {
      /* In-memory history remains available. */
    }
  }
  function setPersistence(enabled: boolean) {
    setRemember(enabled);
    try {
      localStorage.setItem("subweave-history-enabled", String(enabled));
    } catch {
      /* In-memory fallback. */
    }
    save(entries, enabled);
  }
  return {
    entries,
    remember,
    setPersistence,
    remove: (time: number) => save(entries.filter((e) => e.time !== time)),
    clear: () => save([]),
    add: (entry: HistoryEntry) =>
      save([entry, ...entries.filter((e) => e.url !== entry.url)].slice(0, 20)),
  };
}
