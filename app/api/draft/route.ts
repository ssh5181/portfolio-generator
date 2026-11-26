/**
 * POST /api/draft — fills empty fields with a first draft based on course info and
 * an excellent past portfolio of the same type.
 */
import { NextResponse } from "next/server";
import { DRAFT_SYSTEM_PROMPT, buildDraftPrompt, type DraftRequest } from "../../../lib/ai/prompts";
import { callGemini, checkAccess } from "../../../lib/ai/gemini";
import { EXAMPLES } from "../../../lib/examples";
import { TEMPLATES, type TemplateId } from "../../../lib/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;

  let body: DraftRequest;
  try {
    body = (await req.json()) as DraftRequest;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.courseName?.trim() && !body.overview?.trim() && !body.purpose?.trim()) {
    return NextResponse.json({ error: "교과목명이나 수업 메모를 먼저 적어주세요." }, { status: 400 });
  }
  if ((body.overview?.length ?? 0) > 6000) {
    return NextResponse.json({ error: "메모가 너무 깁니다 (6000자 이하)." }, { status: 400 });
  }
  const tid = body.templateId as TemplateId;
  if (!EXAMPLES[tid]) return NextResponse.json({ error: "알 수 없는 서식입니다." }, { status: 400 });
  body.templateTitle = TEMPLATES[tid].title;
  body.industry = TEMPLATES[tid].industry;
  const { source: _source, ...examples } = EXAMPLES[tid];
  void _source;
  body.weekCount = Math.min(Math.max(body.weekCount || 6, 1), 16);

  const r = await callGemini(DRAFT_SYSTEM_PROMPT, buildDraftPrompt(body, examples), { json: true, temperature: 0.6 });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 502 });
  try {
    const cleaned = r.text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    return NextResponse.json({ draft: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ error: "AI 응답을 읽지 못했습니다. 다시 시도해 주세요." }, { status: 502 });
  }
}
