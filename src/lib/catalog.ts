import maintainedRules from "./rules.json" with { type: "json" };
export const communityRules = maintainedRules;
export const defaultCommunityTemplate = communityRules[0];

export const aethersailorProject =
  "https://github.com/Aethersailor/Custom_OpenClash_Rules";
const templateBase =
  "https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/refs/heads/main/cfg/";
export const aethersailorRules = [
  ["Custom_Clash.ini", "标准版"],
  ["Custom_Clash_Fallback.ini", "标准故障转移版"],
  ["Custom_Clash_Lite.ini", "轻量版"],
  ["Custom_Clash_Lite_Fallback.ini", "轻量故障转移版"],
  ["Custom_Clash_GFW.ini", "极简 GFW 版"],
  ["Custom_Clash_GFW_Fallback.ini", "极简 GFW 故障转移版"],
  ["Custom_Clash_Full.ini", "重度分流版"],
  ["Custom_Clash_Full_Fallback.ini", "重度分流故障转移版"],
].map(([file, name]) => ({
  name: `Aethersailor · ${name}`,
  url: templateBase + file,
}));

// Verified with public templates and synthetic nodes; each entry records its check date.
export type BackendPreset = {
  value: string;
  label: string;
  group: string;
  version: string;
  capabilities: {
    mrs: boolean | null;
    geosite: boolean | null;
    stash: boolean | null;
  };
};
export const backendOptions: BackendPreset[] = [
  {
    value: "https://api.asailor.org",
    label: "Aethersailor",
    group: "增强后端",
    version: "2026-10-24 Clash / Stash 检查通过",
    capabilities: { mrs: true, geosite: true, stash: true },
  },
  {
    value: "https://sub-server.v2rayssr.com",
    label: "V2RaySSR",
    group: "增强后端",
    version: "2026-10-24 Clash / Stash 检查通过",
    capabilities: { mrs: true, geosite: true, stash: true },
  },
  {
    value: "https://edge-api-v1.ffqla.com",
    label: "FFQ 官方",
    group: "通用后端",
    version: "2026-10-25 subconverter v0.9.9-948f049；GEOSITE 通过，MRS 缺少 format，Stash 不支持",
    capabilities: { mrs: false, geosite: true, stash: false },
  },
  {
    value: "https://api.ytools.cc",
    label: "FFQ 官方备用",
    group: "通用后端",
    version: "2026-10-25 subconverter v0.9.9-948f049；GEOSITE 通过，MRS 缺少 format，Stash 不支持",
    capabilities: { mrs: false, geosite: true, stash: false },
  },
  {
    value: "https://api.v1.mk",
    label: "v1.mk",
    group: "通用后端",
    version: "2026-10-24 MRS / Stash 检查未通过",
    capabilities: { mrs: false, geosite: true, stash: false },
  },
  {
    value: "https://url.v1.mk",
    label: "url.v1.mk",
    group: "通用后端",
    version: "2026-10-24 MRS / Stash 检查未通过",
    capabilities: { mrs: false, geosite: true, stash: false },
  },
  {
    value: "http://localhost:25500",
    label: "本地服务",
    group: "自建后端",
    version: "尚未验证",
    capabilities: { mrs: null, geosite: null, stash: null },
  },
];
export function backendSnapshot(preset: BackendPreset) {
  return preset.version;
}
export function backendCompatibility(
  backend: string,
  target: string,
  capabilities: string[] = [],
) {
  const preset = getBackendPreset(backend);
  const needs = [
    ...new Set([...capabilities, ...(target === "stash" ? ["stash"] : [])]),
  ];
  const missing = needs.filter(
    (c) =>
      preset?.capabilities[c as keyof BackendPreset["capabilities"]] === false,
  );
  const unknown =
    !preset ||
    needs.some(
      (c) =>
        preset.capabilities[c as keyof BackendPreset["capabilities"]] == null,
    );
  return {
    supported: !missing.length,
    verified: !missing.length && !unknown,
    missing,
  };
}

// Browser POST verified with a synthetic URL on 2026-10-25.
export const shortServices = [
  { value: "v1mk", label: "v1.mk" },
];
export function normalizeBackend(value: string) {
  const url = new URL(value.trim());
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/(sub\/?)?$/, "");
  return url.href.replace(/\/$/, "");
}
export function getBackendPreset(value: string) {
  try {
    return backendOptions.find((b) => b.value === normalizeBackend(value));
  } catch {
    return undefined;
  }
}
export function aethersailorResource(
  value: string,
): "template" | "unsupported" | null {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const path = decodeURIComponent(url.pathname);
    const repo = "Aethersailor/Custom_OpenClash_Rules";
    let resource = "";
    if (
      url.hostname === "raw.githubusercontent.com" &&
      path.toLowerCase().startsWith(`/${repo}/`.toLowerCase())
    ) {
      resource = path
        .slice(repo.length + 2)
        .replace(/^(?:refs\/heads\/)?[^/]+\//, "");
    } else if (
      [
        "cdn.jsdelivr.net",
        "fastly.jsdelivr.net",
        "testingcf.jsdelivr.net",
      ].includes(url.hostname) &&
      path.toLowerCase().startsWith(`/gh/${repo}@`.toLowerCase())
    ) {
      resource = path
        .slice(repo.length + 5)
        .replace(/^(?:refs\/heads\/)?[^/]+\//, "");
    } else if (
      url.hostname === "github.com" &&
      path.toLowerCase().startsWith(`/${repo}/`.toLowerCase())
    ) {
      resource = path
        .slice(repo.length + 2)
        .replace(/^(?:raw|blob)\/(?:refs\/heads\/)?[^/]+\//, "");
    } else return null;
    if (
      /^cfg\/Custom_Clash(?:_(?:Lite|GFW|Full))?(?:_Fallback)?\.ini$/i.test(
        resource,
      )
    )
      return "template";
    return "unsupported";
  } catch {
    return null;
  }
}
