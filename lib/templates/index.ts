/**
 * The five 결과 포트폴리오 templates share one layout; only labels and a few
 * sections differ. Each config maps form fields to labels in the hwpx file.
 */
import { HwpxDocument, type ImageInput } from "../hwpx/document";

export type TemplateId = "PBL" | "PjBL" | "FL" | "IC-PBL" | "IC-PjBL";

export const STRATEGY_KEYS = [
  "orientation",
  "teamwork",
  "motivation",
  "contentDelivery",
  "performance",
  "media",
  "activityEval",
  "achievementEval",
  "transfer",
] as const;
export type StrategyKey = (typeof STRATEGY_KEYS)[number];

export const REFLECTION_KEYS = ["achievements", "difficulties", "improvements", "notes", "industryOutcome"] as const;
export type ReflectionKey = (typeof REFLECTION_KEYS)[number];

export const ATTACHMENT_KEYS = ["worksheets", "photos", "outputs"] as const;
export type AttachmentKey = (typeof ATTACHMENT_KEYS)[number];

export interface PortfolioData {
  courseType: ("전공필수" | "전공선택" | "교양")[];
  grades: ("1학년" | "2학년" | "3학년" | "4학년")[];
  operation: { type: "단독운영" | "코티칭" | "팀티칭"; count?: number };
  split: { yes: boolean; count?: number };
  department: string;
  courseName: string;
  /** e.g. "3-3-0" */
  credits: string;
  dedicatedRoom: boolean;
  enrollment: string;
  purpose: string;
  strategies: Partial<Record<StrategyKey, string>>;
  applicant: { names: string; affiliation: string; email: string; phone: string };
  consent: boolean;
  /** 문제/시나리오, 프로젝트, 수업 전 활동 block */
  intro: { title: string; source: string; developedAt: string; revisedAt: string };
  weeks: { professor: string; student: string }[];
  attachments: Partial<Record<AttachmentKey, ImageInput[]>>;
  industry?: {
    company: string;
    expertName: string;
    expertPosition: string;
    expertEmail: string;
    roles: string[];
    roleOther?: string;
    details: string;
  };
  reflection: Partial<Record<ReflectionKey, string>>;
}

export interface FieldDef {
  key: string;
  label: string;
  kind: "check" | "short" | "long" | "table" | "attachment";
  hint?: string;
}

export interface TemplateConfig {
  id: TemplateId;
  title: string;
  file: string;
  intro: { heading: string; title: string; source: string; developedAt: string };
  strategyLabels: Record<StrategyKey, string>;
  weeksHint: string;
  /** heading prefix per attachment section; missing key = section not in this template */
  attachments: Partial<Record<AttachmentKey, { heading: string; label: string; hint: string }>>;
  industry: boolean;
  reflectionLabels: Partial<Record<ReflectionKey, string>>;
}

const baseStrategy: Record<StrategyKey, string> = {
  orientation: "오리엔테이션",
  teamwork: "팀 구성 및 상호작용",
  motivation: "동기부여",
  contentDelivery: "수업 내용 제공",
  performance: "수행 유도",
  media: "매체 및 학습도구",
  activityEval: "수업 활동 평가",
  achievementEval: "학업 성취 평가",
  transfer: "차시 수업 전이",
};

const baseReflection: Partial<Record<ReflectionKey, string>> = {
  achievements: "교육의 성과",
  difficulties: "난관",
  improvements: "극복방안 및 개선점",
  notes: "특이점 및 기타",
};

const attach = (n: { worksheets?: string; photos?: string; outputs?: string }, ws = "수업과정에서 활용한 워크시트(문제해결계획서, 그룹활동평가지 등) 첨부") => {
  const a: TemplateConfig["attachments"] = {};
  if (n.worksheets) a.worksheets = { heading: n.worksheets, label: "워크시트/평가시트", hint: ws };
  if (n.photos) a.photos = { heading: n.photos, label: "수업활동사진", hint: "학습자중심수업 현장 및 온라인 활동사진 첨부" };
  if (n.outputs) a.outputs = { heading: n.outputs, label: "수업결과물 샘플", hint: "팀 프로젝트/문제해결 활동 결과물 샘플 첨부" };
  return a;
};

const std = { worksheets: "3. 수업과정에서", photos: "4. 수업활동사진", outputs: "5. 수업결과물" };

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  PBL: {
    id: "PBL",
    title: "PBL (문제중심학습)",
    file: "PBL.hwpx",
    intro: { heading: "1. 문제/시나리오", title: "문제/시나리오명", source: "문제/시나리오 출처", developedAt: "문제/시나리오 개발일자" },
    strategyLabels: baseStrategy,
    weeksHint: "교수자·학습자가 실제 수업시간에 활동한 내용",
    attachments: attach(std),
    industry: false,
    reflectionLabels: baseReflection,
  },
  PjBL: {
    id: "PjBL",
    title: "PjBL (프로젝트기반학습)",
    file: "PjBL.hwpx",
    intro: { heading: "1. 프로젝트", title: "프로젝트명", source: "프로젝트 출처", developedAt: "프로젝트 개발일자" },
    strategyLabels: baseStrategy,
    weeksHint: "교수자·학습자가 실제 수업시간에 활동한 내용",
    attachments: attach(std),
    industry: false,
    reflectionLabels: baseReflection,
  },
  FL: {
    id: "FL",
    title: "FL (플립러닝)",
    file: "FL.hwpx",
    intro: { heading: "1. 수업 전 활동", title: "활동내용", source: "사전학습자료", developedAt: "사전학습자료 개발일자" },
    strategyLabels: baseStrategy,
    weeksHint: "사전학습 내용",
    attachments: attach(std, "사전학습 콘텐츠 또는 수업과정에서 활용한 워크시트 첨부"),
    industry: false,
    reflectionLabels: baseReflection,
  },
  "IC-PBL": {
    id: "IC-PBL",
    title: "IC-PBL (기업연계형)",
    file: "IC-PBL.hwpx",
    intro: { heading: "1. 문제/시나리오", title: "문제/시나리오명", source: "문제/시나리오 출처", developedAt: "문제/시나리오 개발일자" },
    strategyLabels: { ...baseStrategy, orientation: "현장 연계 기반 오리엔테이션" },
    weeksHint: "교수자·학습자가 실제 수업시간에 활동한 내용",
    attachments: attach(std),
    industry: true,
    reflectionLabels: { ...baseReflection, industryOutcome: "현장연계 성과 및 한계" },
  },
  "IC-PjBL": {
    id: "IC-PjBL",
    title: "IC-PjBL (기업연계 프로젝트기반학습)",
    file: "IC-PjBL.hwpx",
    intro: { heading: "1. 프로젝트", title: "프로젝트명", source: "프로젝트 출처", developedAt: "프로젝트 개발일자" },
    strategyLabels: { ...baseStrategy, orientation: "현장 연계 기반 오리엔테이션" },
    weeksHint: "교수자·학습자가 실제 수업시간에 활동한 내용",
    attachments: attach({ worksheets: "3. 수업과정에서", outputs: "4. 수업결과물" }),
    industry: true,
    reflectionLabels: { ...baseReflection, industryOutcome: "현장연계 성과 및 한계" },
  },
};

export interface FillOptions {
  /** remove the grey "※ 작성 지침" lines under attachment headings (default true) */
  removeGuides?: boolean;
}

/** Fill a template with portfolio data and return the hwpx bytes. */
export async function fillPortfolio(
  templateBytes: ArrayBuffer | Uint8Array,
  cfg: TemplateConfig,
  data: PortfolioData,
  opts: FillOptions = {},
): Promise<Uint8Array> {
  const doc = await HwpxDocument.load(templateBytes);
  const main = doc.tableWith("교과유형");
  const rowOf = (label: string) => doc.rowCells(doc.findCell(label, { table: main }));
  const checkRow = (label: string, selected: string[]) => {
    for (const c of rowOf(label)) doc.setChecks(c, selected);
  };
  const set = (label: string, value: string | undefined, table = main, long = false) => {
    if (value === undefined) return;
    doc.setCellText(doc.valueCellOf(label, { table }), value, { long });
  };

  // Ⅰ. 수업운영
  checkRow("교과유형", data.courseType);
  checkRow("수강학년", data.grades);
  checkRow("운형형태", [data.operation.type]);
  if (data.operation.count && data.operation.type !== "단독운영") {
    const cell = rowOf("운형형태").find((c) => doc.checkBoxes(c).some((b) => b.label.includes(data.operation.type)));
    if (cell) doc.replaceText(cell, /\(\s*명\)/, `( ${data.operation.count}명)`);
  }
  checkRow("분반여부", [data.split.yes ? "예" : "아니오"]);
  if (data.split.yes && data.split.count) {
    for (const c of rowOf("분반여부")) doc.replaceText(c, /\(\s*개 분반\)/, `( ${data.split.count}개 분반)`);
  }
  set("개설학과(부)(전공)", data.department);
  set("교과목명", data.courseName);
  set("학점-강의-실습", data.credits);
  set("수강규모", data.enrollment ? `${data.enrollment}명` : undefined);
  {
    const lab = doc.findCell("전용강의실", { table: main, match: "startsWith" });
    const a = doc.addr(lab);
    const below = doc.cells(main).filter((c) => {
      const b = doc.addr(c);
      return b.col === a.col && b.row > a.row;
    });
    for (const c of below) doc.setChecks(c, [data.dedicatedRoom ? "예" : "아니오"]);
  }
  // 구분: the template's own type is always checked
  doc.setChecks(doc.valueCellOf("구분", { table: main }), [cfg.id]);
  set("수업목적", data.purpose, main, true);
  for (const k of Object.keys(cfg.strategyLabels) as StrategyKey[]) {
    set(cfg.strategyLabels[k], data.strategies[k], main, true);
  }
  set("성명", data.applicant.names);
  set("소속", data.applicant.affiliation);
  doc.setCellText(doc.findCell("e-mail)", { table: main, match: "startsWith" }), `e-mail) ${data.applicant.email}`);
  doc.setCellText(doc.findCell("Tel)", { table: main, match: "startsWith" }), `Tel) ${data.applicant.phone}`);
  doc.setChecks(doc.findCell("※ 개인정보수집활용", { table: main, match: "startsWith" }), [data.consent ? "동의함" : "동의하지 않음"]);

  // Ⅱ. 수업결과물
  const intro = doc.tableWith(cfg.intro.title);
  set(cfg.intro.title, data.intro.title, intro);
  set(cfg.intro.source, data.intro.source, intro);
  set(cfg.intro.developedAt, data.intro.developedAt, intro);
  set("수정일자", data.intro.revisedAt, intro);

  const weeks = doc.tableWith("주차");
  const firstWeekRow = doc.addr(doc.findCell("주차", { table: weeks })).row + 1;
  doc.ensureRows(weeks, firstWeekRow + data.weeks.length);
  data.weeks.forEach((w, i) => {
    const r = firstWeekRow + i;
    doc.setCellText(doc.cellAt(weeks, r, 0)!, String(i + 1));
    doc.setCellText(doc.cellAt(weeks, r, 1)!, w.professor, { long: true });
    doc.setCellText(doc.cellAt(weeks, r, 2)!, w.student, { long: true });
  });

  if (cfg.industry && data.industry) {
    const ind = doc.tableWith("현장명(기업/기관명)");
    const d = data.industry;
    set("현장명(기업/기관명)", d.company, ind);
    set("성명", d.expertName, ind);
    set("직급/업무분야", d.expertPosition, ind);
    set("이메일 주소", d.expertEmail, ind);
    const roleCells = doc.cells(ind).filter((c) => doc.checkBoxes(c).length);
    for (const c of roleCells) doc.setChecks(c, d.roles);
    if (d.roleOther) for (const c of roleCells) doc.replaceText(c, /기타\(\s*\)/, `기타( ${d.roleOther} )`);
    doc.setCellText(doc.valueCellOf("현장연계사항", { table: ind }), d.details, { long: true });
  }

  // attachments: insert in reverse document order so indexes stay valid
  const att = (Object.keys(cfg.attachments) as AttachmentKey[])
    .map((k) => ({ k, idx: doc.findHeading(cfg.attachments[k]!.heading) }))
    .sort((a, b) => b.idx - a.idx);
  for (const { k, idx } of att) {
    const guides = doc.guideParagraphs(idx);
    const images = data.attachments[k] ?? [];
    const anchorIdx = idx + guides.length;
    doc.insertImagesAfter(anchorIdx, images, k === "photos" ? { widthRatio: 0.49 } : {});
    if ((opts.removeGuides ?? true) && images.length) guides.forEach((g) => doc.removeParagraph(g));
  }

  // Ⅲ. 수업성찰
  const refl = doc.tableWith("교육의 성과");
  for (const [k, label] of Object.entries(cfg.reflectionLabels) as [ReflectionKey, string][]) {
    set(label, data.reflection[k], refl, true);
  }

  return doc.save();
}
