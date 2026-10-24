import { readTextLimited } from "./http-body.ts";
import { httpUrl } from "./converter.ts";

export const DEFAULT_SHORT_API = "https://v1.mk/short";

export async function requestShortLink(
  endpoint: string,
  longUrl: string,
  alias = "",
  send: typeof fetch = fetch,
): Promise<string> {
  const api = httpUrl(endpoint, "短链 API").href;
  if (!longUrl.trim() || longUrl.length > 60000)
    throw new Error("转换链接为空或过长");
  const url = httpUrl(longUrl, "转换链接").href;
  const key = alias.trim();
  if (key.length > 128 || (key && !/^[\w-]+$/.test(key)))
    throw new Error("短链后缀仅支持字母、数字、下划线和连字符，最多 128 字符");

  // FormData is a CORS-safelisted request body; the browser supplies its boundary.
  const body = new FormData();
  body.set("longUrl", btoa(url));
  if (key) body.set("shortKey", key);
  let response: Response;
  try {
    response = await send(api, {
      method: "POST",
      body,
      credentials: "omit",
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("短链服务请求超时，请稍后重试");
    throw new Error("无法连接短链服务，请检查网络或该 API 是否允许跨域访问");
  }
  if (!response.ok)
    throw new Error(`短链服务返回 HTTP ${response.status}`);
  const text = await readTextLimited(response, 100000);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("短链服务未返回有效 JSON");
  }
  if (!data || data.Code !== 1 || typeof data.ShortUrl !== "string")
    throw new Error("短链服务未返回有效链接");
  return httpUrl(data.ShortUrl, "返回短链").href;
}
