import { readTextLimited } from "./http-body.ts";
import snapshot from "../data/template-catalog.json" with { type: "json" };
import { aethersailorRules, aethersailorResource } from "./catalog.ts";

export type TemplateTarget = "clash" | "stash" | "mihomo" | "openclash";
export type FilterProfile = {
  id: string;
  name: string;
  description: string;
  categories: ("ads" | "privacy" | "unwanted")[];
  ruleUrl: string | null;
};
export type TemplateEntry = {
  profile: string | null;
  id: string;
  name: string;
  variant: string;
  kind: "conversion-template" | "runtime-template";
  target: TemplateTarget;
  path: string;
  url: string;
  sha256: string;
  upstreamCommit: string | null;
  requiredFlags: Partial<Record<"expand" | "list" | "new_name", boolean>>;
  capabilities: ("mrs" | "geosite")[];
};
export type TemplateCatalog = {
  schemaVersion: 2;
  defaultProfile: string;
  profiles: FilterProfile[];
  repository: string;
  ref: string;
  license: string;
  source: string;
  testedWith: { converter: string; mihomo: string };
  templates: TemplateEntry[];
};
export const CATALOG_URL =
  "https://raw.githubusercontent.com/hqw567/SubWeave-Rules/main/dist/catalog.json";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length < 300 &&
  !/[\x00-\x1f]/.test(v);

export function parseCatalog(value: unknown): TemplateCatalog {
  if (
    !record(value) ||
    value.schemaVersion !== 2 ||
    !text(value.repository) ||
    !/^[\w.-]+\/[\w.-]+$/.test(value.repository) ||
    !text(value.ref) ||
    !/^[\w.-]+$/.test(value.ref) ||
    value.license !== "CC-BY-SA-4.0" ||
    value.source !== "https://github.com/Aethersailor/Custom_OpenClash_Rules" ||
    !record(value.testedWith) ||
    !text(value.testedWith.converter) ||
    !text(value.testedWith.mihomo) ||
    !Array.isArray(value.templates) ||
    !value.templates.length ||
    value.templates.length > 1000
  )
    throw new Error("模板目录版本或内容无效");
  if (
    !text(value.defaultProfile) ||
    !Array.isArray(value.profiles) ||
    !value.profiles.length ||
    value.profiles.length > 20
  )
    throw new Error("过滤方案目录无效");
  const profileIds = new Set<string>();
  for (const profile of value.profiles) {
    if (
      !record(profile) ||
      !text(profile.id) ||
      !/^[a-z0-9-]+$/.test(profile.id) ||
      profileIds.has(profile.id) ||
      !text(profile.name) ||
      !text(profile.description) ||
      !Array.isArray(profile.categories) ||
      profile.categories.some(
        (c) => !["ads", "privacy", "unwanted"].includes(c),
      ) ||
      new Set(profile.categories).size !== profile.categories.length
    )
      throw new Error("过滤方案内容无效");
    if (profile.ruleUrl !== null) {
      if (!text(profile.ruleUrl)) throw new Error("过滤规则地址无效");
      const url = new URL(profile.ruleUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !profile.categories.length
      )
        throw new Error("过滤规则地址无效");
    } else if (profile.categories.length)
      throw new Error("无过滤方案不能声明拦截类别");
    profileIds.add(profile.id);
  }
  if (!profileIds.has(value.defaultProfile))
    throw new Error("默认过滤方案不存在");
  const ids = new Set(),
    paths = new Set();
  for (const item of value.templates) {
    if (
      !record(item) ||
      !text(item.id) ||
      !text(item.name) ||
      !text(item.variant) ||
      !text(item.profile) ||
      !profileIds.has(item.profile) ||
      !["clash", "stash", "mihomo", "openclash"].includes(
        String(item.target),
      ) ||
      !text(item.path) ||
      !/^[a-z0-9-]+\/(subconverter(?:-stash)?|mihomo|openclash)\/[\w-]+\.(ini|yaml)$/.test(
        item.path,
      ) ||
      item.url !==
        `https://raw.githubusercontent.com/${value.repository}/${value.ref}/dist/${item.path}` ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      !(
        item.upstreamCommit === null ||
        (typeof item.upstreamCommit === "string" &&
          /^[a-f0-9]{40}$/.test(item.upstreamCommit))
      ) ||
      !record(item.requiredFlags) ||
      Object.entries(item.requiredFlags).some(
        ([k, v]) =>
          !["expand", "list", "new_name"].includes(k) || typeof v !== "boolean",
      ) ||
      !Array.isArray(item.capabilities) ||
      item.capabilities.some((c) => !["mrs", "geosite"].includes(c)) ||
      ids.has(item.id) ||
      paths.has(item.path)
    )
      throw new Error("模板目录包含无效条目");
    const conversion = ["clash", "stash"].includes(String(item.target));
    const directory =
      item.target === "clash"
        ? "subconverter"
        : item.target === "stash"
          ? "subconverter-stash"
          : item.target;
    if (
      item.id !== `${item.profile}/${item.target}/${item.variant}` ||
      item.path !==
        `${item.profile}/${directory}/${item.variant}.${conversion ? "ini" : "yaml"}` ||
      item.kind !== (conversion ? "conversion-template" : "runtime-template") ||
      (conversion &&
        (item.requiredFlags.expand !== false ||
          item.requiredFlags.list !== false)) ||
      (item.target === "clash" && item.requiredFlags.new_name !== true) ||
      (item.target === "stash" &&
        ("new_name" in item.requiredFlags ||
          item.capabilities.includes("geosite"))) ||
      (!conversion && Object.keys(item.requiredFlags).length)
    )
      throw new Error("模板用途与客户端不匹配");
    ids.add(item.id);
    paths.add(item.path);
  }
  return value as TemplateCatalog;
}
export const bundledCatalog = parseCatalog(snapshot);

// Compare repository/path identities across the documented Raw and CDN URL spellings.
export function resourceIdentity(value: string) {
  try {
    const u = new URL(value),
      path = decodeURIComponent(u.pathname);
    if (
      u.search ||
      u.hash ||
      u.username ||
      u.password ||
      !["http:", "https:"].includes(u.protocol)
    )
      return null;
    if (u.hostname === "raw.githubusercontent.com") {
      const match = path.match(
        /^\/([^/]+\/[^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)$/,
      );
      return match
        ? { repository: match[1].toLowerCase(), ref: match[2], path: match[3] }
        : null;
    }
    if (
      [
        "cdn.jsdelivr.net",
        "fastly.jsdelivr.net",
        "testingcf.jsdelivr.net",
      ].includes(u.hostname)
    ) {
      const match = path.match(
        /^\/gh\/([^/]+\/[^/@]+)@(?:refs\/heads\/)?([^/]+)\/(.+)$/,
      );
      return match
        ? { repository: match[1].toLowerCase(), ref: match[2], path: match[3] }
        : null;
    }
  } catch {
    /* Unknown custom resources remain usable without invented metadata. */
  }
  return null;
}
export function findTemplate(
  url: string,
  catalog = bundledCatalog,
): TemplateEntry | undefined {
  const resource = resourceIdentity(url);
  const entry = catalog.templates.find(
    (t) =>
      t.url === url ||
      (resource?.repository === catalog.repository.toLowerCase() &&
        resource.path === `dist/${t.path}`),
  );
  if (entry)
    return resource && resource.ref !== catalog.ref
      ? { ...entry, sha256: "" }
      : entry;
  if (aethersailorResource(url) === "template") {
    const original = aethersailorRules.find(
      (r) => resourceIdentity(r.url)?.path === resource?.path,
    );
    return {
      profile: null,
      id: `upstream/${resource?.path || url}`,
      name: original?.name || "Aethersailor 模板",
      variant:
        (resource?.path || "")
          .replace(/^cfg\/Custom_Clash/, "")
          .replace(/\.ini$/, "")
          .replace(/^_/, "")
          .toLowerCase()
          .replaceAll("_", "-")
          .replace(/^fallback$/, "standard-fallback") || "standard",
      kind: "conversion-template",
      target: "clash",
      path: resource?.path || "",
      url,
      sha256: "",
      upstreamCommit: null,
      requiredFlags: { expand: false, list: false, new_name: true },
      capabilities: resource?.path.includes("_GFW")
        ? ["geosite"]
        : ["mrs", "geosite"],
    };
  }
}
export const defaultTemplate = bundledCatalog.templates.find(
  (t) => t.id === `${bundledCatalog.defaultProfile}/clash/standard`,
)!;
export async function fetchCatalog(signal?: AbortSignal) {
  const response = await fetch(CATALOG_URL, {
    signal: signal || AbortSignal.timeout(12000),
    cache: "no-cache",
  });
  if (!response.ok) throw new Error("模板目录暂时不可用");
  const body = await readTextLimited(response, 800_000);
  return parseCatalog(JSON.parse(body));
}
