import { Navbar } from "@/components/Navbar";
import { CartDrawer } from "@/components/CartDrawer";
import { ScanModal } from "@/components/ScanModal";

export default function SkincareLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
      <CartDrawer />
      <ScanModal />
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} MIROIR — one scan, your skin and your colours.</p>
          <p className="text-stone-400">
            Skin analysis by{" "}
            <span className="font-medium text-stone-600">
              Perfect Corp · YouCam Skin AI
            </span>
          </p>
        </div>
      </footer>
    </>
  );
}
