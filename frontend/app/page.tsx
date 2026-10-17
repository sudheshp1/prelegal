import NdaCreator from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/standardTerms";

export default function Home() {
  const terms = loadStandardTerms();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Prelegal</p>
        <h1 className="text-3xl font-bold text-slate-900">Mutual NDA Creator</h1>
        <p className="max-w-2xl text-slate-600">
          Fill in the key terms below to generate a Mutual Non-Disclosure Agreement based on the Common Paper
          standard. The preview updates as you type, and you can download the completed agreement as a PDF.
        </p>
      </header>
      <NdaCreator terms={terms} />
    </main>
  );
}
