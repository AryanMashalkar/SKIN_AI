import type { Metadata } from "next";
import Link from "next/link";
import lighting from "../../../data/evidence/lighting.json";
import pilot from "../../../data/evidence/pilot.json";

export const metadata: Metadata = {
  title: "Evidence — MIROIR",
  description: "What we tested, what passed, what failed, and what we cannot claim.",
};

const REPO = "https://github.com/AryanMashalkar/SKIN_AI/blob/main";

function Verdict({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        pass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
      }`}
    >
      {pass ? "Passed" : "Failed"}
    </span>
  );
}

export default function EvidencePage() {
  const r = lighting.rulesResult;
  const rows = [
    { name: "L1 Correction helps", result: `Median ΔE ${r.L1.value.corrected} corrected, ${r.L1.value.uncorrected} uncorrected`, need: "Lower with correction", pass: r.L1.pass },
    { name: "L2 Colour stays close", result: `Median ΔE ${r.L2.value}`, need: "10 or lower", pass: r.L2.pass },
    { name: "L3 Season holds", result: `${r.L3.value}% of ${lighting.cases} cases`, need: "At least 80%", pass: r.L3.pass },
    { name: "L4 No large jumps", result: `${r.L4.value}% of ${lighting.cases} cases`, need: "At least 90%", pass: r.L4.pass },
    { name: "L5 Season changes are flagged", result: `${r.L5.value}% of ${r.L5.seasonChanges} changes`, need: "At least 80%", pass: Boolean(r.L5.pass) },
  ];
  const seasons = new Set(pilot.firstScanSeasons.map((s) => s.season));

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-stone-800">
      <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">
        ← MIROIR
      </Link>
      <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-stone-900">
        What we tested, and what failed
      </h1>
      <p className="mt-3 leading-relaxed">
        We wrote the pass/fail rules and committed them before running these
        tests. <strong>Neither test measures whether a colour season is correct.</strong>{" "}
        That would need trained colour analysts, and we have not done it. These
        tests ask whether the reading is stable, and whether the app warns you
        when it isn&apos;t.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-stone-900">
        Main finding: the season depends on the photo
      </h2>
      <p className="mt-2 leading-relaxed">
        Five photos of the same person gave{" "}
        <strong>{seasons.size} different seasons</strong>. The app&apos;s
        confidence did not always warn about it: two of these photos, labelled as
        poor capture conditions, still showed 88%. Treat a single scan as a
        starting point, not an answer.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Photo</th>
              <th className="py-2 pr-4 font-medium">Condition</th>
              <th className="py-2 pr-4 font-medium">Season</th>
              <th className="py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {pilot.firstScanSeasons.map((s) => (
              <tr key={s.photo}>
                <td className="py-2 pr-4">{s.photo.replace("P1-", "").replace("stress-", "")}</td>
                <td className="py-2 pr-4">{s.condition}</td>
                <td className="py-2 pr-4">{s.season}</td>
                <td className="py-2 tabular-nums">{Math.round(s.confidence * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-stone-900">
        Lighting stress test
      </h2>
      <p className="mt-2 leading-relaxed">
        We applied seven simulated lighting changes to 7 selfies of one person
        ({lighting.cases} cases), and compared each result with that photo&apos;s
        own reading. The colour correction helps a lot, but the season still
        changed too often.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Rule</th>
              <th className="py-2 pr-4 font-medium">Result</th>
              <th className="py-2 pr-4 font-medium">Needed</th>
              <th className="py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.map((x) => (
              <tr key={x.name}>
                <td className="py-2 pr-4">{x.name}</td>
                <td className="py-2 pr-4">{x.result}</td>
                <td className="py-2 pr-4">{x.need}</td>
                <td className="py-2"><Verdict pass={x.pass} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-stone-900">
        Live pilot: {pilot.scans} scans, {pilot.photos} photos, 1 person
      </h2>
      <p className="mt-2 leading-relaxed">
        With one person, this is a pilot, so our rules don&apos;t allow any rule to
        be reported as passed.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
        <li>
          <strong>Repeat scans:</strong> {pilot.indications.R1.matched} of{" "}
          {pilot.indications.R1.of} photos matched across 3 scans; the target was
          all of them. On the other, one scan failed at YouCam and the season
          changed from Deep Autumn to Soft Autumn.
        </li>
        <li>
          <strong>Disagreement warnings:</strong> shown as required in all{" "}
          {pilot.indications.R4.scansWithBothReadings} scans with both skin readings.
        </li>
        <li>
          <strong>Missing reading:</strong> in {pilot.toneAnalyzerMissing} scans the
          YouCam colour reading didn&apos;t return, so there was no cross-check and
          the report didn&apos;t say why. This is a gap we found.
        </li>
        <li>
          <strong>Rejections:</strong> the {pilot.indications.R6.rejections} rejected
          scan was labelled &quot;Demo data&quot;.
        </li>
        <li>
          <strong>Not tested:</strong> daylight and lamp comparisons (R2, R3, R5),
          because we had no such photos.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-stone-900">Limits</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
        <li>One person and one skin tone, photographed and tested by the author.</li>
        <li>Simulated light is a simple colour shift; real light may do worse.</li>
        <li>Each stress-test reference is the app&apos;s own reading, not a colorimeter.</li>
        <li>Selfies aren&apos;t published, so outsiders can read the results but can&apos;t rerun them.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-stone-900">Check it</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
        <li><a className="underline" href="/api/evidence">Results as JSON</a></li>
        <li><a className="underline" href={`${REPO}/docs/evidence/LIGHTING_PREREGISTRATION.md`}>Lighting test rules</a> and <a className="underline" href={`${REPO}/docs/evidence/PREREGISTRATION.md`}>study rules</a>, with their commit history</li>
        <li><a className="underline" href={`${REPO}/data/evidence/lighting.json`}>Every lighting case</a> and <a className="underline" href={`${REPO}/data/evidence/pilot.json`}>every pilot scan</a></li>
      </ul>
    </main>
  );
}
