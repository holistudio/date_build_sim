import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const rounded = M_PLUS_Rounded_1c({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PC Build Route",
  description:
    "Build the Great Intel Gaming PC step by step, as an anime visual novel powered by Reactor + Helios",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={rounded.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
