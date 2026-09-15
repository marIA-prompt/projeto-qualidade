import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";

const readex = Readex_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-readex",
});

export const metadata: Metadata = {
  title: "Plano de Qualidade · Banco Senff",
  description: "Painel do Plano de Qualidade de Correspondentes — Autorregulação FEBRABAN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${readex.variable} h-full antialiased`}>
      <body className={`${readex.className} min-h-full`}>{children}</body>
    </html>
  );
}
