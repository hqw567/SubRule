import { aethersailorRules, communityRules } from "./catalog.ts";
import { bundledCatalog, findTemplate } from "./template-catalog.ts";
import type { TemplateCatalog } from "./template-catalog.ts";

export type LibraryEntry = {
  profile?: string | null;
  profileName?: string;
  profileDescription?: string;
  url: string;
  name: string;
  variant: string;
  target: string;
  kind: "conversion-template" | "runtime-template";
  capabilities: string[];
};
export type TemplateFamily = {
  id: string;
  name: string;
  source: string;
  summary: string;
  entries: LibraryEntry[];
  defaultProfile?: string;
  profileOrder?: string[];
};
export const targetLabels: Record<string, string> = {
  clash: "Mihomo / Clash",
  stash: "Stash",
  mihomo: "Mihomo",
  openclash: "OpenClash",
  generic: "通用转换",
};
const titles: Record<string, [string, string]> = {
  standard: ["标准分流", "按常用服务划分策略"],
  lite: ["轻量分流", "精简策略组，日常使用"],
  gfw: ["极简 GFW", "以 GFW 规则为主"],
  full: ["完整分流", "细分更多服务与地区"],
  "selfhosted-provider": ["自托管订阅", "结合自托管订阅"],
  "selfhosted-manual": ["自托管节点", "结合本地填写的节点"],
};
export function templateFamilies(
  catalog: TemplateCatalog = bundledCatalog,
): TemplateFamily[] {
  const families = new Map<string, TemplateFamily>();
  const add = (
    id: string,
    name: string,
    source: string,
    summary: string,
    entry: LibraryEntry,
  ) => {
    if (!families.has(id))
      families.set(id, { id, name, source, summary, entries: [] });
    families.get(id)!.entries.push(entry);
  };
  const addFamily = (source: string, prefix: string, entry: LibraryEntry) => {
    const stem = entry.variant.replace(/-fallback$/, "");
    const [name, summary] = titles[stem] || [entry.name, ""];
    add(`${prefix}/${stem}`, name, source, summary, entry);
  };
  for (const entry of catalog.templates)
    addFamily("SubWeave 扩展", "subweave", {
      ...entry,
      profileName: catalog.profiles.find((p) => p.id === entry.profile)?.name,
      profileDescription: catalog.profiles.find((p) => p.id === entry.profile)
        ?.description,
    });
  for (const rule of aethersailorRules) {
    const entry = findTemplate(rule.url, catalog)!;
    addFamily("Aethersailor", "aethersailor", entry);
  }
  for (const rule of communityRules)
    add(
      rule.source.toLowerCase(),
      rule.source === "ACL4SSR" ? "通用分流" : "流媒体分流",
      rule.source,
      "",
      {
        url: rule.url,
        name: rule.name,
        variant: rule.url,
        target: "generic",
        kind: "conversion-template",
        capabilities: [],
      },
    );
  const order = [
    "standard",
    "lite",
    "gfw",
    "full",
    "selfhosted-provider",
    "selfhosted-manual",
  ];
  for (const family of families.values())
    if (family.id.startsWith("subweave/")) {
      family.defaultProfile = catalog.defaultProfile;
      family.profileOrder = catalog.profiles.map((profile) => profile.id);
    }
  return [...families.values()].sort((a, b) => {
    const priority = (f: TemplateFamily) =>
      f.id.startsWith("subweave/")
        ? 0
        : f.id.startsWith("aethersailor/")
          ? 1
          : 2;
    return (
      priority(a) - priority(b) ||
      order.indexOf(a.id.split("/")[1]) - order.indexOf(b.id.split("/")[1])
    );
  });
}
export function templateSource(
  url: string,
  catalog: TemplateCatalog = bundledCatalog,
) {
  if (findTemplate(url, catalog)?.id.startsWith("upstream/"))
    return "Aethersailor";
  const family = templateFamilies(catalog).find((f) =>
    f.entries.some((e) => e.url === url),
  );
  return (
    family?.source || (findTemplate(url, catalog) ? "SubWeave 扩展" : "自定义")
  );
}
export function presetLabel(entry: LibraryEntry) {
  return ["clash", "stash", "mihomo", "openclash"].includes(entry.target)
    ? entry.variant.endsWith("-fallback")
      ? "自动故障转移"
      : "手动选择"
    : entry.name;
}
