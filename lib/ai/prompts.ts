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

export interface DraftRequest {
  templateTitle: string;
  courseName: string;
  department: string;
  /** professor's free memo about the course (optional) */
  overview: string;
  purpose: string;
  weekCount: number;
  industry: boolean;
  /** which keys to produce; only empty fields are requested */
  want: string[];
  templateId: string;
}

export const DRAFT_SYSTEM_PROMPT = `당신은 대학 교수학습센터에 제출하는 "학습자중심수업 결과 포트폴리오"의 초안을 만드는 도우미입니다.
교수님이 준 교과목 정보와 메모를 바탕으로, 같은 유형의 우수 사례를 문체·분량·구성의 참고로 삼아 각 칸의 초안을 씁니다.

원칙:
- 우수 사례의 내용을 베끼지 말고, 이 교과목과 전공에 맞는 내용으로 새로 씁니다.
- 메모에 있는 내용을 우선 반영합니다. 메모에 없는 구체적 수치, 비율, 인원, 기관명, 인명은 지어내지 말고 "○○"로 비워 둡니다.
- 문체는 보고서체 명사형 종결("~함", "~임")이며, 항목은 줄마다 "· "로 시작합니다.
- 수업성찰 칸은 교수님이 고쳐 쓸 초안이므로 이 수업 유형에서 흔히 나타나는 성과와 어려움을 일반적으로 씁니다.
- 마크다운, 이모지, 설명 문장 없이 요청한 JSON만 출력합니다.`;

export function buildDraftPrompt(r: DraftRequest, examples: unknown): string {
  const shape: Record<string, string> = {
    purpose: '"purpose": "수업목적 2~3항목"',
    strategies:
      '"strategies": {"orientation","teamwork","motivation","contentDelivery","performance","media","activityEval","achievementEval","transfer"} 각 1~3항목',
    intro: '"intro": {"title": "문제/프로젝트/활동명", "source": "출처 또는 사전학습자료"}',
    weeks: `"weeks": 길이 ${r.weekCount}의 배열 [{"professor": "교수자 활동", "student": "학습자 활동"}] 각 1~3항목`,
    reflection: `"reflection": {"achievements","difficulties","improvements","notes"${r.industry ? ',"industryOutcome"' : ""}} 각 2~4항목`,
    industryDetails: '"industryDetails": "현장 전문가 참여 역할 및 현장연계 주요 사항 2~3항목"',
  };
  const keys = r.want.filter((k) => shape[k] && (k !== "industryDetails" || r.industry));
  return `[서식] ${r.templateTitle}
[교과목] ${r.courseName || "(미입력)"}
[개설학과] ${r.department || "(미입력)"}
[수업목적 메모] ${r.purpose || "(없음)"}
[교수님 메모]
${r.overview || "(없음)"}

[같은 유형 우수 사례 - 문체와 분량 참고용]
${JSON.stringify(examples)}

다음 키만 가진 JSON 객체를 출력하세요. 각 칸의 글은 문자열이며 항목 사이는 줄바꿈 문자(\\n)입니다.
${keys.map((k) => "- " + shape[k]).join("\n")}`;
}

export const SYSTEM_PROMPT = `당신은 대학 교수학습센터에 제출하는 "학습자중심수업 결과 포트폴리오" 작성을 돕는 편집자입니다.
교수님이 메모 수준으로 적은 개요를 공식 보고서 문장으로 다듬습니다.

원칙:
- 메모에 있는 사실만 사용합니다. 숫자, 도구 이름, 활동, 성과를 지어내지 않습니다. 메모가 짧으면 결과도 짧게 씁니다.
- 문체는 보고서체 명사형 종결("~함", "~임", "~하였음")을 씁니다. 존댓말 "~습니다"는 쓰지 않습니다.
- 여러 항목은 줄마다 "· "로 시작하는 개조식으로 씁니다. 한 항목은 한두 문장입니다.
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
