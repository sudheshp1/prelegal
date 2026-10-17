# Prelegal frontend — Mutual NDA Creator

A Next.js app (KAN-6) that drafts a [Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0).
Users fill in the cover page terms and party details, see a live preview, and download the completed agreement as a PDF.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## How it works

- `app/page.tsx` reads the Standard Terms from `../templates/Mutual-NDA.md` at build time (the page is
  prerendered), so the build must run from `frontend/` inside a full repo checkout.
- `lib/nda.ts` holds the form data model and the cover page text shared by the preview and the PDF.
- `lib/standardTerms.ts` parses the Standard Terms markdown into numbered clauses.
- `components/NdaPreview.tsx` renders the HTML preview; `components/NdaPdf.tsx` renders the same document with
  `@react-pdf/renderer`, loaded on demand when the user clicks **Download PDF**.
