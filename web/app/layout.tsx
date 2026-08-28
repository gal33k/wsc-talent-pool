import type { Metadata } from "next";
import "./globals.css";
import { PoolProvider } from "@/lib/data";
import Banner from "@/components/Banner";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "WSC · Talent Intelligence",
  description: "Recruitment take-home — synthetic data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#f7f8fa" />
        <meta name="color-scheme" content="light" />
      </head>
      <body className="min-h-screen">
        <PoolProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Banner />
              <div className="flex-1">{children}</div>
            </div>
          </div>
        </PoolProvider>
      </body>
    </html>
  );
}
