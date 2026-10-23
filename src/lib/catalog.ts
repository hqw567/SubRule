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

// Standard-template smoke tests on 2026-09-12 with synthetic TEST-NET nodes,
// target=clash, expand=false. This snapshot is not a live availability guarantee.
type BackendPreset = {
  value: string;
  label: string;
  supportsAethersailor: boolean | null;
  modern: boolean;
  version: string;
  diagnostic?: string;
};
export const backendOptions: BackendPreset[] = [
  {
    value: "https://api.asailor.org",
    label: "Aethersailor 增强后端",
    supportsAethersailor: true,
    modern: true,
    version: "SubConverter-Extended v1.9.4",
  },
  {
    value: "https://sub-server.v2rayssr.com",
    label: "V2RaySSR 规则兼容后端",
    supportsAethersailor: true,
    modern: true,
    version: "SubConverter-Extended v1.6.1",
  },
  {
    value: "https://api.v1.mk",
    label: "友善的肥羊 · api.v1.mk",
    supportsAethersailor: false,
    modern: false,
    version: "subconverter v1.9.9",
  },
  {
    value: "https://url.v1.mk",
    label: "肥羊备用后端",
    supportsAethersailor: false,
    modern: false,
    version: "subconverter v1.9.9",
  },
  ...[
    ["https://subapi.cmliussss.net", "CM · subapi.cmliussss.net", "subconverter v0.9.9-ecb63a9", "标准模板结构检查未通过"],
    ["https://subapi.fxxk.dedyn.io", "CM 备用 · subapi.fxxk.dedyn.io", "subconverter v0.9.9-ecb63a9 · subapi-hk-vps", "标准模板结构检查未通过"],
    ["https://edge-api-v1.ffqla.com", "FFQ", "subconverter v0.9.9-948f049", "MRS Provider 缺少 format: mrs"],
    ["https://api.ytools.cc", "FFQ 备用", "subconverter v0.9.9-948f049", "MRS Provider 缺少 format: mrs"],
    ["https://pub-api-1.bianyuan.xyz", "边缘 · pub-api-1.bianyuan.xyz", "subconverter v0.11.0-build114514", "标准模板结构检查未通过"],
    ["https://api-suc.0z.gs", "瓜皮 · api-suc.0z.gs", "subconverter v0.9.9-ecb63a9", "标准模板结构检查未通过"],
    ["https://api.wcc.best", "sub-web 作者 · api.wcc.best", "subconverter v0.9.0", "标准模板结构检查未通过"],
    ["https://api.dler.io", "lhie1 · api.dler.io", "subconverter v0.9.0-a0d4eab", "标准模板结构检查未通过"],
    ["https://bianyuan.xyz", "边缘 · bianyuan.xyz", "未识别版本", "返回内容未通过标准模板结构检查"],
  ].map(([value, label, version, diagnostic]) => ({ value, label, version, diagnostic, modern: false, supportsAethersailor: false })),
  ...[
    ["https://subconverters.com", "订阅转换 · subconverters.com", "请求超时"],
    ["https://sub.xeton.dev", "subconverter 作者 · sub.xeton.dev", "v0.9.0-a0d4eab；转换 HTTP 520"],
    ["https://sub.id9.cc", "品云 · sub.id9.cc", "连接失败"],
    ["https://api.nexconvert.com", "奶昔 · api.nexconvert.com", "转换 HTTP 403"],
    ["https://sub.maoxiongnet.com", "猫熊 · sub.maoxiongnet.com", "连接失败"],
    ["https://api.sublink.dev", "歪兔 · api.sublink.dev", "转换 HTTP 522"],
    ["https://sub.xjz.im", "920.im · sub.xjz.im", "转换 HTTP 402"],
    ["http://localhost:25500", "本地版 · localhost:25500", "需在本机启动服务后检测"],
  ].map(([value, label, diagnostic]) => ({ value, label, diagnostic, version: "兼容性尚未验证", modern: false, supportsAethersailor: null })),
];

export function backendSnapshot(preset: BackendPreset) {
  const detail = preset.diagnostic || (preset.supportsAethersailor ? "标准模板结构测试通过" : "MRS Provider 缺少 format: mrs");
  return `${preset.version} · ${detail}（2026-09-12），可重新检测当前状态。`;
}

// Service IDs are published by https://sub.ffq.la/api/config.
export const shortServices = [
  { value: "v1mk", label: "v1.mk", note: "示例生成通过" },
  { value: "dwzhila", label: "dwzhila.com", note: "示例生成通过；当前返回 urlgo.run 域名" },
  { value: "gfwmom", label: "gfw.mom", note: "示例生成通过" },
  { value: "gfwlat", label: "gfw.lat", note: "示例生成通过" },
  { value: "d1mk", label: "d1.mk", note: "示例生成通过" },
  { value: "dljtf", label: "dlj.tf", note: "本次测试 HTTP 502，可稍后重试" },
  { value: "suoyt", label: "suo.yt", note: "示例生成通过" },
  { value: "subcm", label: "sub.cm", note: "本次测试 HTTP 502，可稍后重试" },
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
