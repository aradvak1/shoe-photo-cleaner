import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre, Geist_Mono } from "next/font/google";
import { MotionConfig } from "motion/react";
import { Header } from "@/components/Header";
import { PageTransition } from "@/components/motion/PageTransition";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl",
  subsets: ["hebrew", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PHOTOS EDITOR",
  description: "כלי לניקוי תמונות נעליים, יצירת תמונות אווירה, וייצוא קטלוגים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${frankRuhlLibre.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <MotionConfig reducedMotion="user">
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </MotionConfig>
      </body>
    </html>
  );
}
