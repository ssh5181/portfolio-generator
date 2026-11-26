# 학습자중심수업 결과 포트폴리오 초안 생성기

교수님이 웹에서 항목을 입력하면 기존 결과보고서 서식(hwpx) 그대로 조립해 내려받을 수 있게 하는 웹앱.

- `templates/` 원본 서식 5종 (PBL, PjBL, FL, IC-PBL, IC-PjBL)
- `lib/hwpx/` hwpx 편집 엔진 (칸 채우기, 체크박스, 이미지 삽입)
- `lib/templates/` 서식별 설정과 `fillPortfolio()`
- `docs/template-analysis.md` 서식 분석 결과

시험 파일 생성: `npm install && npx tsx scripts/fill-samples.ts` → `samples/out/`

## 실행

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY 입력
npm run dev
```

환경변수: `GEMINI_API_KEY`(필수, AI 다듬기), `GEMINI_MODEL`(선택), `APP_ACCESS_CODE`(선택, 설정 시 AI 기능에 접근 코드 필요).
첨부 PDF는 브라우저에서 페이지별 JPEG로 변환되고, 큰 사진은 긴 변 2000px로 줄여 넣는다. hwpx 조립도 브라우저에서 한다.

## 배포 (Vercel)

`main`에 push하면 Vercel 프로젝트 `portfolio-generator`(팀 GNU-INNO)가 자동 배포한다.
환경변수는 Vercel 프로젝트 설정 > Environment Variables에서 관리하며, 바꾼 뒤에는 재배포해야 적용된다.
