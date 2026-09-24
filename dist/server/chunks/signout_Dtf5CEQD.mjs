globalThis.process ??= {};
globalThis.process.env ??= {};
import { in as __exportAll } from "./runtime_zVK3H1hm.mjs";
import { t as createClient } from "./supabase_max1amQA.mjs";
//#region src/pages/api/auth/signout.ts
var signout_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (context) => {
	const supabase = createClient(context.request.headers, context.cookies);
	if (supabase) await supabase.auth.signOut();
	return context.redirect("/");
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/signout@_@ts
var page = () => signout_exports;
//#endregion
export { page };
