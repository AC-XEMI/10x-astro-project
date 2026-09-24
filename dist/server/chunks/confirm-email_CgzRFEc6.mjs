globalThis.process ??= {};
globalThis.process.env ??= {};
import { d as renderComponent, in as __exportAll, v as renderTemplate, y as maybeRenderHead } from "./runtime_zVK3H1hm.mjs";
import { t as createComponent } from "./compiler_0IH4gCD7.mjs";
import { t as $$Layout } from "./Layout_DE7D9av2.mjs";
//#region src/pages/auth/confirm-email.astro
var confirm_email_exports = /* @__PURE__ */ __exportAll({
	default: () => $$ConfirmEmail,
	file: () => $$file,
	url: () => $$url
});
var $$ConfirmEmail = createComponent(($$result, $$props, $$slots) => {
	const content = {
		emoji: "📧",
		heading: "Check your email",
		description: "We've sent a confirmation link to your email address. Click it to activate your account.",
		linkText: "Back to sign in"
	};
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": content.heading }, { "default": ($$result2) => renderTemplate`${maybeRenderHead($$result2)}<div class="bg-cosmic flex min-h-screen items-center justify-center p-4"><div class="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white backdrop-blur-xl"><div class="mb-4 text-5xl">${content.emoji}</div><h1 class="mb-3 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">${content.heading}</h1><p class="mb-6 text-blue-100/80">${content.description}</p><a href="/auth/signin" class="text-sm text-purple-300 hover:underline">${content.linkText}</a></div></div>` })}`;
}, "C:/xampp/htdocs/10x-astro-project/src/pages/auth/confirm-email.astro", void 0);
var $$file = "C:/xampp/htdocs/10x-astro-project/src/pages/auth/confirm-email.astro";
var $$url = "/auth/confirm-email";
//#endregion
//#region \0virtual:astro:page:src/pages/auth/confirm-email@_@astro
var page = () => confirm_email_exports;
//#endregion
export { page };
