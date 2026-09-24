globalThis.process ??= {};
globalThis.process.env ??= {};
import { M as createAstro, an as __toESM, d as renderComponent, in as __exportAll, v as renderTemplate, y as maybeRenderHead } from "./runtime_zVK3H1hm.mjs";
import { t as require_react } from "./react_DBxBzWad.mjs";
import { t as createComponent } from "./compiler_0IH4gCD7.mjs";
import { t as $$Layout } from "./Layout_DE7D9av2.mjs";
import { a as require_jsx_runtime, c as createLucideIcon, i as FormField, n as SubmitButton, o as Mail, r as PasswordToggle, s as Lock, t as ServerError } from "./ServerError_dLWLKSU_.mjs";
//#region node_modules/lucide-react/dist/esm/icons/log-in.mjs
/**
* @license lucide-react v1.45.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData = {
	name: "log-in",
	size: 24,
	node: [
		["path", {
			d: "m10 17 5-5-5-5",
			key: "1bsop3"
		}],
		["path", {
			d: "M15 12H3",
			key: "6jk70r"
		}],
		["path", {
			d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",
			key: "u53s6r"
		}]
	]
};
__iconData.node;
var LogIn = createLucideIcon(__iconData);
//#endregion
//#region src/components/auth/SignInForm.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function SignInForm({ serverError }) {
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const [errors, setErrors] = (0, import_react.useState)({});
	function validate() {
		const next = {};
		if (!email.trim()) next.email = "Email is required";
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address";
		if (!password) next.password = "Password is required";
		setErrors(next);
		return Object.keys(next).length === 0;
	}
	function clearError(field) {
		if (errors[field]) setErrors((prev) => ({
			...prev,
			[field]: void 0
		}));
	}
	function handleSubmit(e) {
		if (!validate()) e.preventDefault();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		method: "POST",
		action: "/api/auth/signin",
		className: "space-y-4",
		onSubmit: handleSubmit,
		noValidate: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormField, {
				id: "email",
				type: "email",
				label: "Email",
				value: email,
				onChange: (v) => {
					setEmail(v);
					clearError("email");
				},
				placeholder: "you@example.com",
				error: errors.email,
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "size-4" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormField, {
				id: "password",
				label: "Password",
				type: showPassword ? "text" : "password",
				value: password,
				onChange: (v) => {
					setPassword(v);
					clearError("password");
				},
				placeholder: "Your password",
				error: errors.password,
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4" }),
				endContent: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordToggle, {
					visible: showPassword,
					onToggle: () => {
						setShowPassword(!showPassword);
					}
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerError, { message: serverError }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubmitButton, {
				pendingText: "Signing in...",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogIn, { className: "size-4" }),
				children: "Sign in"
			})
		]
	});
}
//#endregion
//#region src/pages/auth/signin.astro
var signin_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Signin,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Signin = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Signin;
	const error = Astro.url.searchParams.get("error");
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Sign in" }, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="bg-cosmic flex min-h-screen items-center justify-center p-4"><div class="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl"><h1 class="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-2xl font-bold text-transparent">Sign in</h1>${renderComponent($$result, "SignInForm", SignInForm, {
		"serverError": error,
		"client:load": true,
		"client:component-hydration": "load",
		"client:component-path": "@/components/auth/SignInForm",
		"client:component-export": "default"
	})}<p class="mt-4 text-center text-sm text-blue-100/60">Don't have an account?${" "}<a href="/auth/signup" class="text-purple-300 hover:underline">Sign up</a></p></div></div>` })}`;
}, "C:/xampp/htdocs/10x-astro-project/src/pages/auth/signin.astro", void 0);
var $$file = "C:/xampp/htdocs/10x-astro-project/src/pages/auth/signin.astro";
var $$url = "/auth/signin";
//#endregion
//#region \0virtual:astro:page:src/pages/auth/signin@_@astro
var page = () => signin_exports;
//#endregion
export { page };
