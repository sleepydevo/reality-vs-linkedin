import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Reality vs LinkedIn — Corporate-ify Your Day",
  description:
    "Turn your mundane daily activities into ridiculous LinkedIn thought leadership. Generate a shareable meme card instantly.",
  openGraph: {
    title: "Reality vs LinkedIn",
    description:
      "Turn your mundane daily activities into ridiculous LinkedIn thought leadership.",
    type: "website",
  },
};

import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
