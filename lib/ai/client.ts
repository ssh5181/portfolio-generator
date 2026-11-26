"use client";
import type { PolishRequest } from "./prompts";

const CODE_KEY = "portfolio-access-code";

function getCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Call /api/polish; asks once for the access code if the server requires one. */
export async function polish(req: PolishRequest): Promise<{ text?: string; weeks?: { professor: string; student: string }[] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/polish", {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": getCode() },
      body: JSON.stringify(req),
    });
    const json = await res.json().catch(() => ({ error: `서버 오류 (${res.status})` }));
    if (res.status === 401 && json.needCode && attempt === 0) {
      const code = window.prompt("AI 기능 접근 코드를 입력해 주세요.");
      if (!code) throw new Error("접근 코드가 필요합니다.");
      try {
        localStorage.setItem(CODE_KEY, code);
      } catch {
        /* ignore */
      }
      continue;
    }
    if (!res.ok) throw new Error(json.error ?? `서버 오류 (${res.status})`);
    return json;
  }
  throw new Error("접근 코드가 올바르지 않습니다.");
}
