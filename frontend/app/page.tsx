import AuthGate from "@/components/AuthGate";
import DocumentCreator from "@/components/DocumentCreator";
import { loadDocuments } from "@/lib/loadDocuments";

export default function Home() {
  const documents = loadDocuments();

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold text-brand-navy">Draft a Legal Agreement</h1>
          <p className="max-w-2xl text-slate-600">
            Chat with our AI assistant to draft an agreement based on Common Paper standard terms. The preview
            fills in as you answer, and you can download the completed agreement as a PDF.
          </p>
        </header>
        <DocumentCreator documents={documents} />
      </main>
    </AuthGate>
  );
}
