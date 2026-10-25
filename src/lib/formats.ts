/** One entry per conversion format, independent of the application importing it. */
export type OutputFormat = {
  value: string;
  label: string;
  group?: string;
  version?: string;
};
export const outputFormats: OutputFormat[] = [
  { value: "clash", label: "Mihomo / Clash", group: "配置文件" },
  { value: "singbox", label: "sing-box", group: "配置文件" },
  { value: "stash", label: "Stash", group: "配置文件" },
  { value: "surge", label: "Surge", group: "配置文件", version: "4" },
  { value: "quanx", label: "Quantumult X", group: "配置文件" },
  { value: "loon", label: "Loon", group: "配置文件" },
  { value: "surfboard", label: "Surfboard", group: "配置文件" },
  { value: "shadowrocket", label: "Shadowrocket 分享订阅", group: "节点订阅" },
  { value: "mixed", label: "混合分享链接", group: "节点订阅" },
  { value: "v2ray", label: "VMess（V2Ray）", group: "节点订阅" },
  { value: "ss", label: "Shadowsocks（SIP002）", group: "节点订阅" },
  { value: "trojan", label: "Trojan", group: "节点订阅" },
  { value: "auto", label: "自动识别" },
];
export const isMihomoFormat = (format: string) => format === "clash";
export function requireFormat(value: string): OutputFormat {
  const format = outputFormats.find((item) => item.value === value);
  if (!format) throw new Error("暂不支持此输出格式");
  return format;
}
export function formatForUrl(value: string): OutputFormat | undefined {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return;
    return outputFormats.find((format) =>
      format.value === url.searchParams.get("target") &&
      (!format.version || !url.searchParams.has("ver") || url.searchParams.get("ver") === format.version),
    );
  } catch {
    return;
  }
}
