"use client";
import type { DraftRequest, PolishRequest } from "./prompts";

const CODE_KEY = "portfolio-access-code";

function getCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** POST to an AI route; asks once for the access code if the server requires one. */
async function post<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": getCode() },
      body: JSON.stringify(body),
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
    return json as T;
  }
  throw new Error("접근 코드가 올바르지 않습니다.");
}

export function polish(req: PolishRequest) {
  return post<{ text?: string; weeks?: { professor: string; student: string }[] }>("/api/polish", req);
}

export interface Draft {
  purpose?: string;
  strategies?: Record<string, string>;
  intro?: { title?: string; source?: string };
  weeks?: { professor?: string; student?: string }[];
  reflection?: Record<string, string>;
  industryDetails?: string;
}

export function draft(req: Omit<DraftRequest, "templateTitle" | "industry">) {
  return post<{ draft: Draft }>("/api/draft", req);
}
