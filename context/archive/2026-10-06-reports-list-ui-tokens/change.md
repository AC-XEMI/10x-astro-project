---
change_id: reports-list-ui-tokens
title: Align reports list view with existing shadcn/Tailwind design tokens
status: archived
created: 2026-10-06
updated: 2026-10-07
archived_at: 2026-10-07T06:25:21Z
---

## Notes

Audit widoku reports/index.astro (lista raportów) pod kątem kontraktu design-systemu: strona i jej podkomponenty (ReportsList.tsx, Topbar.astro, Banner.astro) ignorują istniejące tokeny shadcn/Tailwind z src/styles/global.css (--primary, --muted-foreground, --border, --destructive itd.) i zamiast nich używają literałów slate-*/indigo-* oraz surowego hex w Banner.astro. Token source: src/styles/global.css (@theme inline). Komponenty: src/components/ui/*.
