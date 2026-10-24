import { readTextLimited } from "./http-body.ts";
import { shortServices } from "./catalog.ts";
import { httpUrl } from "./converter.ts";

export function shortLinkPayload(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("短链参数无效");
  const data = input as Record<string, unknown>;
  if (!shortServices.some((s) => s.value === data.service))
    throw new Error("请选择预设短链服务");
  if (typeof data.longUrl !== "string" || data.longUrl.length > 60000)
    throw new Error("转换链接为空或过长");
  const longUrl = httpUrl(data.longUrl, "转换链接").href;
  const alias = typeof data.alias === "string" ? data.alias.trim() : "";
  if (alias.length > 128 || (alias && !/^[\w-]+$/.test(alias)))
    throw new Error("短链后缀仅支持字母、数字、下划线和连字符，最多 128 字符");
  return { service: data.service as string, longUrl, alias };
}

export async function handleShortLink(
  request: Request,
  send: typeof fetch = fetch,
) {
  const reply = (data: object, status = 200) =>
    Response.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return reply({ message: "请从本站发起短链请求" }, 403);
  let payload;
  try {
    const text = await readTextLimited(request, 65000);
    payload = shortLinkPayload(JSON.parse(text));
  } catch (e) {
    return reply(
      { message: e instanceof Error ? e.message : "短链参数无效" },
      400,
    );
  }
  try {
    // A fixed public gateway, never an arbitrary proxy target. No user URL is fetched here.
    const response = await send("https://sub.ffq.la/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`短链网关返回 HTTP ${response.status}`);
    const data = await response.json();
    if (data.success !== true || typeof data.shortUrl !== "string")
      throw new Error(
        typeof data.message === "string"
          ? data.message.slice(0, 200)
          : "短链服务未返回有效链接",
      );
    return reply({ shortUrl: httpUrl(data.shortUrl, "返回短链").href });
  } catch (e) {
    return reply(
      { message: e instanceof Error ? e.message : "短链服务暂不可用" },
      502,
    );
  }
}
