/**
 * POST /api/polish — turns a memo into report prose with Gemini.
 * The key stays on the server (GEMINI_API_KEY). Optional APP_ACCESS_CODE gates use.
 */
import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, buildUserPrompt, type PolishRequest } from "../../../lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MEMO = 6000;
const KINDS = new Set(["purpose", "strategy", "reflection", "industry", "weeks"]);

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "서버에 Gemini API 키가 설정되지 않았습니다." }, { status: 500 });

  const code = process.env.APP_ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) {
    return NextResponse.json({ error: "접근 코드가 올바르지 않습니다.", needCode: true }, { status: 401 });
  }

  let body: PolishRequest;
  try {
    body = (await req.json()) as PolishRequest;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!KINDS.has(body.kind) || typeof body.memo !== "string" || !body.memo.trim()) {
    return NextResponse.json({ error: "메모를 먼저 입력해 주세요." }, { status: 400 });
  }
  if (body.memo.length > MAX_MEMO) {
    return NextResponse.json({ error: `메모가 너무 깁니다 (${MAX_MEMO}자 이하).` }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`${process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(body) }] }],
      generationConfig: {
        temperature: 0.4,
        ...(body.kind === "weeks" ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("gemini error", res.status, detail.slice(0, 500));
    const msg =
      res.status === 429
        ? "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : `AI 응답 오류 (${res.status})`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) return NextResponse.json({ error: "AI가 빈 응답을 보냈습니다. 다시 시도해 주세요." }, { status: 502 });

  if (body.kind === "weeks") {
    try {
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
      const weeks = JSON.parse(cleaned) as { professor: string; student: string }[];
      if (!Array.isArray(weeks)) throw new Error();
      return NextResponse.json({ weeks });
    } catch {
      return NextResponse.json({ error: "AI 응답을 표로 읽지 못했습니다. 다시 시도해 주세요." }, { status: 502 });
    }
  }
  return NextResponse.json({ text: tidy(text) });
}

/** Remove markdown leftovers the model sometimes adds. */
function tidy(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[*•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
