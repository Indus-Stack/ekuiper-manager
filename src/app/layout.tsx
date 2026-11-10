import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme/config";

export const metadata: Metadata = {
  title: "eKuiper Manager",
  description: "A focused, self-hosted workspace for operating eKuiper.",
  keywords: ["eKuiper", "IoT", "rule engine", "streaming"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
