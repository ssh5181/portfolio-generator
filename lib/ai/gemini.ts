/** Server-side Gemini call and access-code check shared by the API routes. */
import { NextResponse } from "next/server";

export function checkAccess(req: Request): NextResponse | null {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "서버에 Gemini API 키가 설정되지 않았습니다." }, { status: 500 });
  }
  const code = process.env.APP_ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) {
    return NextResponse.json({ error: "접근 코드가 올바르지 않습니다.", needCode: true }, { status: 401 });
  }
  return null;
}

export async function callGemini(
  system: string,
  user: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<{ text: string } | { error: string }> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const base = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";
  const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("gemini error", res.status, detail.slice(0, 500));
    return {
      error: res.status === 429 ? "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." : `AI 응답 오류 (${res.status})`,
    };
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return text ? { text } : { error: "AI가 빈 응답을 보냈습니다. 다시 시도해 주세요." };
}
