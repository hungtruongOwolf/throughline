import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible, Barlow_Condensed, Barlow_Semi_Condensed } from "next/font/google";
import { Providers } from "../components/providers";
import "./theme.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-barlow-semi",
});
const barlow = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Throughline",
  description:
    "Referrals, visit days and follow-up for hospitals, run by agents and approved by staff.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${barlow.variable} ${barlowSemi.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
