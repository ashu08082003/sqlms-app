# Document Number & Comment on All Documents

## Goal
Ensure the checklist **Document Number** and **Comment** (description) appear on every report/export, with a **"00"** fallback wherever a document number is not assigned.

## Steps
- [x] 1. `src/lib/email.ts` — Inspection PDF + inspection HTML emails: add Document No. & Comment to info table (`buildInspectionPdf`, `buildReportEmail`, `buildEscalationEmail`); source them in `sendInspectionEmails` (include checklist).
- [x] 2. `src/lib/email.ts` — Consolidated PDF: change Document No. fallback from `-` to `00`.
- [x] 3. `src/components/views/consolidated-reports-view.tsx` — extend `ConsolidatedData` interface; add Document No. & Comment to CSV export and to the report header card (with `00` fallback).
- [x] 4. `src/app/api/locations/qr/[code]/route.ts` — include `documentNumber` in checklist payload.
- [x] 5. `src/components/views/employee-scan-view.tsx` — show Document No. & Comment in the scan form header.
- [x] 6. Run `eslint` on modified files — passed with no errors.
