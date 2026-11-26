/** Prompts for turning a professor's short memo into report prose. Shared by the API route. */

export type PolishKind = "purpose" | "strategy" | "reflection" | "industry" | "weeks";

export interface PolishRequest {
  kind: PolishKind;
  /** field label in the template, e.g. "동기부여", "교육의 성과" */
  label: string;
  /** professor's memo (for weeks: JSON array of {professor, student}) */
  memo: string;
  context: {
    templateTitle: string;
    courseName?: string;
    department?: string;
    purpose?: string;
  };
}

export const SYSTEM_PROMPT = `당신은 대학 교수학습센터에 제출하는 "학습자중심수업 결과 포트폴리오" 작성을 돕는 편집자입니다.
교수님이 메모 수준으로 적은 개요를 공식 보고서 문장으로 다듬습니다.

원칙:
- 메모에 있는 사실만 사용합니다. 숫자, 도구 이름, 활동, 성과를 지어내지 않습니다. 메모가 짧으면 결과도 짧게 씁니다.
- 문체는 보고서체 명사형 종결("~함", "~임", "~하였음")을 씁니다. 존댓말 "~습니다"는 쓰지 않습니다.
- 여러 항목은 줄마다 "- "로 시작하는 개조식으로 씁니다. 한 항목은 한두 문장입니다.
- 마크다운 굵게, 제목, 번호 머리표, 이모지는 쓰지 않습니다.
- 결과 텍스트만 출력합니다. 설명이나 인사말을 덧붙이지 않습니다.`;

const GUIDE: Record<PolishKind, string> = {
  purpose: "수업목적 칸입니다. 이 학습자중심수업을 통해 학습자가 무엇을 하게 되고 어떤 역량을 기르는지 2~4줄로 씁니다.",
  strategy:
    "수업 운영 및 평가 전략 표의 '실행내용' 칸입니다. 표 칸이 좁으므로 1~3줄로 짧게, 실제로 무엇을 어떻게 했는지 구체적으로 씁니다.",
  reflection:
    "수업성찰 칸입니다. 교과목 전체가 아니라 이 학습자중심수업에 대한 내용으로 3~6줄 개조식으로 씁니다.",
  industry: "현장연계 사항 칸입니다. 현장 전문가의 참여 역할과 현장연계의 주요 내용을 2~5줄로 씁니다.",
  weeks:
    "주차별 세부 활동 표입니다. 각 주차의 교수자 활동과 학습자 활동을 각각 1~2줄로 다듬습니다. 비어 있는 칸은 비워 둡니다.",
};

export function buildUserPrompt(r: PolishRequest): string {
  const ctx = [
    `서식: ${r.context.templateTitle}`,
    r.context.courseName && `교과목: ${r.context.courseName}`,
    r.context.department && `학과: ${r.context.department}`,
    r.context.purpose && r.kind !== "purpose" && `수업목적(참고): ${r.context.purpose}`,
  ]
    .filter(Boolean)
    .join("\n");
  const out =
    r.kind === "weeks"
      ? `입력은 주차 순서대로의 JSON 배열입니다. 같은 길이의 JSON 배열 [{"professor": "...", "student": "..."}]만 출력하세요.`
      : `다듬은 본문만 출력하세요.`;
  return `${GUIDE[r.kind]}\n\n[참고 정보]\n${ctx}\n\n[칸 이름]\n${r.label}\n\n[교수님 메모]\n${r.memo}\n\n${out}`;
}
