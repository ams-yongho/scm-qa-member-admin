import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "./_components/top-nav";

export const metadata: Metadata = {
  title: "SCM QA · 회원 관리",
  description: "자사몰 QA 챕터 회원 관리 셀프서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased">
        <Providers>
          <TopNav />
          <main className="px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
