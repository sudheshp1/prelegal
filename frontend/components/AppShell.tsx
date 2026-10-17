"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, type DocumentSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DISCLAIMER, type LegalDocument } from "@/lib/documents";
import AppHeader from "./AppHeader";
import ConfirmDialog from "./ConfirmDialog";
import DocumentCreator from "./DocumentCreator";
import DocumentList from "./DocumentList";

/** Which document the workspace opened with; a new key remounts it fresh. */
type Workspace = { key: number; documentId: number | null };

export default function AppShell({ documents }: { documents: LegalDocument[] }) {
  const { user, signOut } = useAuth();
  const [summaries, setSummaries] = useState<DocumentSummary[] | undefined>(undefined);
  const [listError, setListError] = useState("");
  const [workspace, setWorkspace] = useState<Workspace>({ key: 0, documentId: null });
  // The current workspace key, readable from replies that arrive after the user has moved on.
  const workspaceKey = useRef(0);
  // Tracks the open document, including one the workspace has just created.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentSummary | null>(null);

  const refresh = useCallback(() => {
    listDocuments().then(
      (list) => {
        setSummaries(list);
        setListError("");
      },
      () => setListError("Couldn't load your documents."),
    );
  }, []);

  useEffect(refresh, [refresh]);

  const open = (documentId: number | null) => {
    workspaceKey.current += 1;
    setSelectedId(documentId);
    setWorkspace({ key: workspaceKey.current, documentId });
  };

  const handleSaved = (key: number, documentId: number) => {
    // A reply for a workspace the user has since left still updates the list, but not the selection.
    if (key === workspaceKey.current) setSelectedId(documentId);
    refresh();
  };

  const requestDelete = (documentId: number) => {
    setPendingDelete(summaries?.find((d) => d.id === documentId) ?? null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const documentId = pendingDelete.id;
    setPendingDelete(null);
    try {
      await deleteDocument(documentId);
      if (documentId === selectedId) open(null);
      refresh();
    } catch {
      setListError("Couldn't delete the document. Please try again.");
    }
  };

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader user={user} onSignOut={signOut} />

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-slate-200 bg-white p-4 md:w-72 md:shrink-0 md:border-b-0 md:border-r">
          <button
            type="button"
            onClick={() => open(null)}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <span aria-hidden className="text-lg leading-none">+</span> New document
          </button>
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-brand-muted">Your documents</h2>
          {listError && (
            <p role="alert" className="mb-2 px-3 text-sm text-red-600">
              {listError}
            </p>
          )}
          <DocumentList documents={summaries} selectedId={selectedId} onSelect={open} onDelete={requestDelete} />
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <DocumentCreator
            key={workspace.key}
            documents={documents}
            initialDocumentId={workspace.documentId}
            onSaved={(documentId) => handleSaved(workspace.key, documentId)}
          />
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-brand-muted sm:px-6">
        {DISCLAIMER} Based on Common Paper standard agreements (CC BY 4.0).
      </footer>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={`“${pendingDelete.title}” and its conversation will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}
