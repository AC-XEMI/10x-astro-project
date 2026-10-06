import { useEffect, useState } from "react";

/**
 * "Submitting" flag for a form that does a native POST (full page navigation). The flag is
 * reset when the page is restored from the back/forward cache - otherwise going Back after a
 * submit would show a form stuck in its pending state.
 */
export function usePendingSubmit() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return [pending, setPending] as const;
}
