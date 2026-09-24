globalThis.process ??= {};
globalThis.process.env ??= {};
import { M as createAstro, b as renderHead, d as renderComponent, f as Fragment, h as renderSlot, v as renderTemplate, x as addAttribute, y as maybeRenderHead } from "./runtime_zVK3H1hm.mjs";
import { t as createComponent } from "./compiler_0IH4gCD7.mjs";
import { n as SUPABASE_URL, t as SUPABASE_KEY } from "./server_57RHfXas.mjs";
//#region src/components/Banner.astro
createAstro("https://astro.build");
var $$Banner = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Banner;
	const { variant = "info" } = Astro.props;
	return renderTemplate`${maybeRenderHead($$result)}<div${addAttribute(["banner", `banner--${variant}`], "class:list")}${addAttribute(variant === "error" ? "alert" : "status", "role")} data-astro-cid-uljtwisc>${renderSlot($$result, $$slots["default"])}</div>`;
}, "C:/xampp/htdocs/10x-astro-project/src/components/Banner.astro", void 0);
var missingConfigs = [{
	name: "Supabase",
	configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
	message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
	docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
	docsLabel: "Zobacz instrukcję konfiguracji"
}].filter((s) => !s.configured);
//#endregion
//#region src/layouts/Layout.astro
createAstro("https://astro.build");
var $$Layout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Layout;
	const { title = "10x Astro Starter" } = Astro.props;
	return renderTemplate`<html lang="en" data-astro-cid-ju4pidww><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/png" href="/favicon.png"><title>${title}</title>${renderHead($$result)}</head><body data-astro-cid-ju4pidww>${missingConfigs.map((cfg) => renderTemplate`${renderComponent($$result, "Banner", $$Banner, {
		"variant": "error",
		"data-astro-cid-ju4pidww": true
	}, { "default": ($$result) => renderTemplate`<strong data-astro-cid-ju4pidww>Uwaga:</strong> ${cfg.message}${cfg.docsUrl && renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`${" "}<a${addAttribute(cfg.docsUrl, "href")} target="_blank" rel="noopener noreferrer" data-astro-cid-ju4pidww>${cfg.docsLabel ?? "Dokumentacja"}</a>.` })}`}` })}`)}${renderSlot($$result, $$slots["default"])}</body></html>`;
}, "C:/xampp/htdocs/10x-astro-project/src/layouts/Layout.astro", void 0);
//#endregion
export { $$Layout as t };
