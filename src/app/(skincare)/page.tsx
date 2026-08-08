import { ScanFace, Sparkles, ShoppingBag, Shirt, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Shop } from "@/components/Shop";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* How it works */}
      <section id="how" className="border-y border-stone-300/50 bg-white/40">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-center font-serif text-3xl font-medium tracking-tight text-stone-900">
            From selfie to shelf in three steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: ScanFace,
                title: "1 · Scan",
                body: "Snap or upload a selfie. Perfect Corp's clinical AI scores 11 skin concerns and reads your colour season.",
              },
              {
                icon: Sparkles,
                title: "2 · Match",
                body: "Every product is scored against your results, so your worst concerns float straight to the top of the shelf.",
              },
              {
                icon: ShoppingBag,
                title: "3 · Shop",
                body: "Add your matched routine to the bag and check out — a shelf built around your biology, not a guess.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-stone-200/70 bg-white/70 p-6"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4f0e6] text-[#b5451f] shadow-sm">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-stone-900">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-stone-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Shop />

      {/* Cross-promo: Fashion VTO */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <Link
          href="/fashion"
          className="group flex flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl bg-stone-900 p-8 text-white sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
              <Shirt className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                Also from MIROIR
              </p>
              <h3 className="mt-0.5 text-xl font-semibold">
                Try on the apparel collection
              </h3>
              <p className="text-sm text-white/70">
                See clothes on your own photo with AI virtual try-on.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition group-hover:gap-3">
            Open the fitting room <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>
    </main>
  );
}
