globalThis.process ??= {};
globalThis.process.env ??= {};
import { k as defineMiddleware, t as sequence } from "./chunks/sequence_DVFaExAJ.mjs";
import { t as createClient } from "./chunks/supabase_max1amQA.mjs";
//#region src/middleware.ts
var PROTECTED_ROUTES = ["/dashboard"];
var onRequest$1 = defineMiddleware(async (context, next) => {
	const supabase = createClient(context.request.headers, context.cookies);
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		context.locals.user = user ?? null;
	} else context.locals.user = null;
	if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
		if (!context.locals.user) return context.redirect("/auth/signin");
	}
	return next();
});
//#endregion
//#region \0virtual:astro:middleware
var onRequest = sequence(onRequest$1);
//#endregion
export { onRequest };
