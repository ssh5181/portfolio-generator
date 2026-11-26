# 학습자중심수업 결과 포트폴리오 초안 생성기

교수님이 웹에서 항목을 입력하면 기존 결과보고서 서식(hwpx) 그대로 조립해 내려받을 수 있게 하는 웹앱.

- `templates/` 원본 서식 5종 (PBL, PjBL, FL, IC-PBL, IC-PjBL)
- `lib/hwpx/` hwpx 편집 엔진 (칸 채우기, 체크박스, 이미지 삽입)
- `lib/templates/` 서식별 설정과 `fillPortfolio()`
- `docs/template-analysis.md` 서식 분석 결과

시험 파일 생성: `npm install && npx tsx scripts/fill-samples.ts` → `samples/out/`
