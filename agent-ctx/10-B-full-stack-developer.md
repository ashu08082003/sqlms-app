# Task 10-B — Locations + Checklists views

## Agent
full-stack-developer (Locations + Checklists views)

## What was done
Built the two admin view components for SQLMS:
- `src/components/views/locations-view.tsx` — named export `LocationsView`
- `src/components/views/checklists-view.tsx` — named export `ChecklistsView`

Both `"use client"`. Both consume APIs via `apiFetch` + TanStack Query, call `useAppStore.bump()` after mutations, use teal theme (no blue/indigo), shadcn/ui + shared components (CategoryBadge, QrCode/downloadQrPng, EmptyState).

## Key decisions
- LocationsView: parallel useQuery for locations/categories/departments/checklists (keyed w/ refreshKey); filter bar (search + category + department + active-only); responsive card grid `1/2/3`; clickable small QR (88) → QR detail dialog (QrCode 240 in `.print-area` card, deep-link `/?qr=QR000xxx` + Copy, Download PNG, Print); Add/Edit dialog with category-filtered checklist Select; AlertDialog delete with amber warning when inspectionCount>0.
- ChecklistsView: useQuery for checklists+categories; card grid `md:grid-cols-2` with item preview badges; Create/Edit dialog with dynamic items editor (add/remove rows, ≥1 non-empty item validated); AlertDialog delete with warning when locationCount>0.
- Form Selects use `"none"` sentinel for optional departmentId/checklistId → mapped to `null` in payload.
- Lint: scoped `npx eslint` on the two files → exit 0, 0 errors, 0 warnings. Project-wide lint still shows pre-existing errors in foundation files (page.tsx, app-shell.tsx, category-badge.tsx, qr-code.tsx) which are out of scope.

## Files
- Created: `/home/z/my-project/src/components/views/locations-view.tsx`
- Created: `/home/z/my-project/src/components/views/checklists-view.tsx`
- Modified: `/home/z/my-project/worklog.md` (appended Task 10-B section only)
