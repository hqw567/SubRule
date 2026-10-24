/** Curated 2026-10-24. Order is a popularity-informed recommendation, not user counts. */
export const clients = [
  { value: "clash-verge", label: "Clash Verge Rev", group: "Mihomo 内核" },
  { value: "flclash", label: "FlClash", group: "Mihomo 内核" },
  { value: "clash", label: "Mihomo / OpenClash", group: "Mihomo 内核" },
  { value: "nikki", label: "Nikki", group: "Mihomo 内核" },
  { value: "shadowrocket", label: "Shadowrocket", group: "其他客户端" },
  { value: "singbox", label: "Sing-box", group: "其他客户端" },
  { value: "stash", label: "Stash", group: "其他客户端" },
  { value: "surge&ver=4", label: "Surge", group: "其他客户端" },
  { value: "quanx", label: "Quantumult X", group: "其他客户端" },
  { value: "loon", label: "Loon", group: "其他客户端" },
  { value: "surfboard", label: "Surfboard", group: "其他客户端" },
  { value: "mixed", label: "混合订阅", group: "通用格式" },
  { value: "v2ray", label: "V2Ray 订阅", group: "通用格式" },
  { value: "ss", label: "Shadowsocks 节点", group: "通用格式" },
  { value: "trojan", label: "Trojan 节点", group: "通用格式" },
  { value: "auto", label: "按客户端识别", group: "通用格式" },
];
export const modernClientIds = clients
  .filter((c) => c.group === "Mihomo 内核")
  .map((c) => c.value);
export const isModernClient = (client: string) =>
  modernClientIds.includes(client);
export const getClientTarget = (client: string) =>
  isModernClient(client) ? "clash" : client;
export function requireClient(client: string) {
  if (clients.some((c) => c.value === client)) return;
  throw new Error(`暂不支持客户端：${client}`);
}
