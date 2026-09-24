globalThis.process ??= {};
globalThis.process.env ??= {};
import { M as createAstro, d as renderComponent, in as __exportAll, v as renderTemplate, y as maybeRenderHead } from "./runtime_zVK3H1hm.mjs";
import { t as createComponent } from "./compiler_0IH4gCD7.mjs";
import { t as $$Layout } from "./Layout_DE7D9av2.mjs";
//#region src/pages/dashboard.astro
var dashboard_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Dashboard,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Dashboard = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Dashboard;
	const { user } = Astro.locals;
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Dashboard" }, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="bg-cosmic flex min-h-screen items-center justify-center p-4"><div class="rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white backdrop-blur-xl"><h1 class="mb-4 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">Dashboard</h1><p class="text-blue-100/80">Welcome, <span class="font-semibold text-white">${user?.email}</span></p><p class="mt-2 text-sm text-blue-100/50">This page is only for authenticated users.</p><form method="POST" action="/api/auth/signout" class="mt-6"><button type="submit" class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20">Sign out</button></form></div></div>` })}`;
}, "C:/xampp/htdocs/10x-astro-project/src/pages/dashboard.astro", void 0);
var $$file = "C:/xampp/htdocs/10x-astro-project/src/pages/dashboard.astro";
var $$url = "/dashboard";
//#endregion
//#region \0virtual:astro:page:src/pages/dashboard@_@astro
var page = () => dashboard_exports;
//#endregion
export { page };
