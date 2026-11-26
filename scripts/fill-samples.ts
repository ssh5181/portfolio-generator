/** Fill every template with sample data: `npx tsx scripts/fill-samples.ts [outDir]` */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, fillPortfolio, type PortfolioData } from "../lib/templates/index";

const outDir = process.argv[2] ?? "samples/out";
mkdirSync(outDir, { recursive: true });
const img = (f: string) => ({ data: new Uint8Array(readFileSync(join("samples/images", f))), ext: f.split(".").pop()! });

const data: PortfolioData = {
  courseType: ["전공선택"],
  grades: ["2학년", "3학년"],
  operation: { type: "코티칭", count: 2 },
  split: { yes: true, count: 2 },
  department: "컴퓨터공학과",
  courseName: "데이터분석 프로젝트",
  credits: "3-2-2",
  dedicatedRoom: true,
  enrollment: "35",
  purpose:
    "실제 지역사회 데이터를 활용한 문제해결 과정을 통해 데이터 분석 역량과 협업 능력을 함양한다.\n학습자가 문제를 정의하고 해결책을 제안하는 전 과정을 주도적으로 수행하도록 한다.",
  strategies: {
    orientation: "1주차에 PBL 수업 방식과 평가 기준을 안내하고 우수 사례를 공유함",
    teamwork: "사전 설문으로 역량을 고려하여 4인 1팀으로 구성, 팀 규칙 수립",
    motivation: "지역 기관의 실제 문제를 제시하여 학습 동기 유발",
    contentDelivery: "핵심 개념은 짧은 강의와 영상으로 제공",
    performance: "단계별 워크시트와 주간 팀 미팅으로 수행 점검",
    media: "Google Colab, Padlet, LMS 토론방 활용",
    activityEval: "동료평가 및 팀 활동 체크리스트",
    achievementEval: "최종 발표와 결과보고서 루브릭 평가",
    transfer: "매 차시 성찰일지 작성 후 다음 차시 도입에서 공유",
  },
  applicant: { names: "홍길동, 김철수", affiliation: "공과대학 컴퓨터공학과", email: "prof@example.ac.kr", phone: "02-000-0000" },
  consent: true,
  intro: { title: "지역 상권 활성화를 위한 데이터 분석", source: "교수자 개발", developedAt: "2026. 3. 2.", revisedAt: "2026. 3. 20." },
  weeks: Array.from({ length: 8 }, (_, i) => ({
    professor: `${i + 1}주차 교수자 활동: 문제 제시 및 피드백`,
    student: `${i + 1}주차 학습자 활동: 팀별 자료 조사와 토의`,
  })),
  attachments: {
    worksheets: [img("worksheet-page1.png"), img("worksheet-page2.png")],
    photos: [img("photo1.jpg"), img("photo2.jpg"), img("photo3.jpg")],
    outputs: [img("output1.png")],
  },
  industry: {
    company: "(주)샘플데이터",
    expertName: "이영희",
    expertPosition: "책임연구원 / 데이터 분석",
    expertEmail: "expert@example.com",
    roles: ["문제제공", "평가/심사/피드백/자문/멘토링", "기타"],
    roleOther: "현장 데이터 제공",
    details: "기업이 보유한 상권 데이터를 제공하고 중간·최종 발표에서 피드백을 제공함",
  },
  reflection: {
    achievements: "학습자가 실제 데이터를 다루며 문제 정의 역량이 향상됨\n팀 프로젝트 결과물 중 2건이 지역 기관에 제안됨",
    difficulties: "팀 간 역량 편차로 진도 차이가 발생함",
    improvements: "중간 점검 시점을 늘리고 팀별 맞춤 피드백 제공",
    notes: "온라인 협업 도구 활용도가 예상보다 높았음",
    industryOutcome: "현장 전문가 피드백으로 결과물의 실효성이 높아졌으나 일정 조율에 한계가 있었음",
  },
};

for (const cfg of Object.values(TEMPLATES)) {
  const bytes = await fillPortfolio(readFileSync(join("public/templates", cfg.file)), cfg, data);
  const out = join(outDir, `sample-${cfg.id}.hwpx`);
  writeFileSync(out, bytes);
  console.log("wrote", out, bytes.length);
}
