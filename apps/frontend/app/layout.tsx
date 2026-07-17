import type { Metadata } from "next";
import { Caprasimo, Nunito_Sans } from "next/font/google";
import "./globals.css";

const caprasimo = Caprasimo({
  weight: "400",
  variable: "--font-caprasimo",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus Pub Quiz",
  description: "Live pub quiz for campus events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caprasimo.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">{children}</body>
    </html>
  );
}
