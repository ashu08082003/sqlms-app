# Document Number & Comment on All Documents

## Goal
Ensure the checklist **Document Number** and **Comment** (description) appear on every report/export, with a **"00"** fallback wherever a document number is not assigned.

## Steps
1. ✅ `src/lib/email.ts` — Inspection PDF + inspection HTML emails: add Document No. & Comment to info table (`buildInspectionPdf`, `buildReportEmail`, `buildEscalationEmail`); source them in `sendInspectionEmails` (include checklist).
2. ✅ `src/lib/email.ts` — Consolidated PDF: change Document No. fallback from `-` to `00`.
3. ✅ `src/components/views/consolidated-reports-view.tsx` — extend `ConsolidatedData` interface; add Document No. & Comment to CSV export and to the report header card (with `00` fallback); harden array guards.
4. ✅ `src/app/api/locations/qr/[code]/route.ts` — include `documentNumber` in checklist payload.
5. ✅ `src/components/views/employee-scan-view.tsx` — show Document No. & Comment in the scan form header.
6. ⏳ Run `bun run lint` and build to verify.
