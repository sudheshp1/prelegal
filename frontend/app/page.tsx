import AppShell from "@/components/AppShell";
import AuthGate from "@/components/AuthGate";
import { AuthProvider } from "@/lib/auth";
import { loadDocuments } from "@/lib/loadDocuments";

export default function Home() {
  const documents = loadDocuments();

  return (
    <AuthProvider>
      <AuthGate>
        <AppShell documents={documents} />
      </AuthGate>
    </AuthProvider>
  );
}
