/** Read untrusted HTTP data with a byte limit before buffering the full body. */
export async function readTextLimited(
  message: Request | Response,
  maxBytes: number,
): Promise<string> {
  if (Number(message.headers.get("content-length")) > maxBytes) {
    await message.body?.cancel();
    throw new Error("请求或响应内容过大");
  }
  if (!message.body) return "";
  const reader = message.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("请求或响应内容过大");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
