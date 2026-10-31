import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible, Barlow_Condensed } from "next/font/google";
import "./theme.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});
const barlow = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Throughline",
  description: "One thread through the whole hospital visit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
