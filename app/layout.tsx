import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학습자중심수업 결과 포트폴리오 작성",
  description: "결과 포트폴리오를 입력하고 한글(hwpx) 서식 그대로 내려받습니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
