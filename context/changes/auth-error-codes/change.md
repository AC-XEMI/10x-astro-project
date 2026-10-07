---
change_id: auth-error-codes
title: Auth errors travel as codes, not free text
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Lekki obieg (decyzja użytkownika 2026-10-07). `/auth/signin`, `/auth/signup` i `/auth/confirm-email` renderują dowolny tekst z `?error=` (link może podsunąć własny komunikat), `translateAuthError` przepuszcza nieznane, surowe angielskie komunikaty Supabase (narusza lessons.md), a brak konfiguracji pokazuje „Supabase is not configured”. Wzorzec: `src/lib/report-errors.ts` (kody → mapa komunikatów). Zatwierdzone nowe treści: `not_configured` = tekst z report-errors, nieznany kod = „Coś poszło nie tak. Spróbuj ponownie.”. Istniejące polskie komunikaty bez zmian.
