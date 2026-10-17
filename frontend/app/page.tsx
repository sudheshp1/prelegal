import AuthGate from "@/components/AuthGate";
import NdaCreator from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/standardTerms";

export default function Home() {
  const terms = loadStandardTerms();

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold text-brand-navy">Mutual NDA Creator</h1>
          <p className="max-w-2xl text-slate-600">
            Chat with our AI assistant to draft a Mutual Non-Disclosure Agreement based on the Common Paper
            standard. The preview fills in as you answer, and you can download the completed agreement as a PDF.
          </p>
        </header>
        <NdaCreator terms={terms} />
      </main>
    </AuthGate>
  );
}
