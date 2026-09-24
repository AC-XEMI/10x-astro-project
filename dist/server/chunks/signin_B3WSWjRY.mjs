globalThis.process ??= {};
globalThis.process.env ??= {};
import { in as __exportAll } from "./runtime_zVK3H1hm.mjs";
import { t as createClient } from "./supabase_max1amQA.mjs";
//#region src/pages/api/auth/signin.ts
var signin_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (context) => {
	const form = await context.request.formData();
	const email = form.get("email");
	const password = form.get("password");
	const supabase = createClient(context.request.headers, context.cookies);
	if (!supabase) return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password
	});
	if (error) return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
	return context.redirect("/");
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/signin@_@ts
var page = () => signin_exports;
//#endregion
export { page };
