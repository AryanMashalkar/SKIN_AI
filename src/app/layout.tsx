import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { CartDrawer } from "@/components/CartDrawer";
import { ScanModal } from "@/components/ScanModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Derma — AI Skincare, matched to your skin",
  description:
    "Scan your face with clinical AI skin analysis and shop products matched to your real skin concerns. Powered by the Perfect Corp YouCam Skin Analysis API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex-1">{children}</div>
        <CartDrawer />
        <ScanModal />
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} Derma. A skin-first shopping experience.</p>
            <p className="text-stone-400">
              Skin analysis by{" "}
              <span className="font-medium text-stone-600">
                Perfect Corp · YouCam Skin AI
              </span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
