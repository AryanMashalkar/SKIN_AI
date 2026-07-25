import type { Metadata } from "next";
import { FashionNavbar } from "@/components/fashion/FashionNavbar";
import { FashionCart } from "@/components/fashion/FashionCart";
import { TryOnModal } from "@/components/fashion/TryOnModal";

export const metadata: Metadata = {
  title: "MIROIR — AI Fashion Fitting Room",
  description:
    "See our apparel collection on your own photo with photorealistic AI virtual try-on, powered by the Perfect Corp YouCam Apparel VTO API.",
};

export default function FashionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <FashionNavbar />
      <div className="flex-1">{children}</div>
      <FashionCart />
      <TryOnModal />
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} MIROIR — a Derma fitting room.</p>
          <p>
            Virtual try-on by{" "}
            <span className="font-medium text-white/60">
              Perfect Corp · YouCam Apparel VTO
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
