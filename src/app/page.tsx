import { ScanFace, Sparkles, ShoppingBag } from "lucide-react";
import { Hero } from "@/components/Hero";
import { Shop } from "@/components/Shop";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* How it works */}
      <section id="how" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-stone-900">
            From selfie to shelf in three steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: ScanFace,
                title: "1 · Scan",
                body: "Snap or upload a selfie. Perfect Corp's clinical AI scores 11 skin concerns and estimates your skin age.",
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
                className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-violet-600 shadow-sm">
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
    </main>
  );
}
