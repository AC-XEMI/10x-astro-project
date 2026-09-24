globalThis.process ??= {};
globalThis.process.env ??= {};
import { M as createAstro, an as __toESM, d as renderComponent, in as __exportAll, v as renderTemplate, y as maybeRenderHead } from "./runtime_zVK3H1hm.mjs";
import { t as require_react } from "./react_DBxBzWad.mjs";
import { t as createComponent } from "./compiler_0IH4gCD7.mjs";
import { t as $$Layout } from "./Layout_DE7D9av2.mjs";
import { a as require_jsx_runtime, c as createLucideIcon, i as FormField, n as SubmitButton, o as Mail, r as PasswordToggle, s as Lock, t as ServerError } from "./ServerError_dLWLKSU_.mjs";
//#region node_modules/lucide-react/dist/esm/icons/user-plus.mjs
/**
* @license lucide-react v1.45.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData = {
	name: "user-plus",
	size: 24,
	node: [
		["path", {
			d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
			key: "1yyitq"
		}],
		["circle", {
			cx: "9",
			cy: "7",
			r: "4",
			key: "nufk8"
		}],
		["line", {
			x1: "19",
			x2: "19",
			y1: "8",
			y2: "14",
			key: "1bvyxn"
		}],
		["line", {
			x1: "22",
			x2: "16",
			y1: "11",
			y2: "11",
			key: "1shjgl"
		}]
	]
};
__iconData.node;
var UserPlus = createLucideIcon(__iconData);
//#endregion
//#region src/components/auth/SignUpForm.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var MIN_PASSWORD_LENGTH = 6;
function SignUpForm({ serverError }) {
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [confirmPassword, setConfirmPassword] = (0, import_react.useState)("");
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const [showConfirmPassword, setShowConfirmPassword] = (0, import_react.useState)(false);
	const [errors, setErrors] = (0, import_react.useState)({});
	function validate() {
		const next = {};
		if (!email.trim()) next.email = "Email is required";
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address";
		if (!password) next.password = "Password is required";
		else if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
		if (!confirmPassword) next.confirmPassword = "Please confirm your password";
		else if (password !== confirmPassword) next.confirmPassword = "Passwords do not match";
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
	const passwordHint = !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "mt-1 text-xs text-blue-100/50",
		children: [
			MIN_PASSWORD_LENGTH - password.length,
			" more character",
			MIN_PASSWORD_LENGTH - password.length !== 1 ? "s" : "",
			" needed"
		]
	}) : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		method: "POST",
		action: "/api/auth/signup",
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
				placeholder: "Min. 6 characters",
				error: errors.password,
				hint: passwordHint,
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4" }),
				endContent: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordToggle, {
					visible: showPassword,
					onToggle: () => {
						setShowPassword(!showPassword);
					}
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormField, {
				id: "confirmPassword",
				name: "confirmPassword",
				label: "Confirm password",
				type: showConfirmPassword ? "text" : "password",
				value: confirmPassword,
				onChange: (v) => {
					setConfirmPassword(v);
					clearError("confirmPassword");
				},
				placeholder: "Re-enter your password",
				error: errors.confirmPassword,
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4" }),
				endContent: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordToggle, {
					visible: showConfirmPassword,
					onToggle: () => {
						setShowConfirmPassword(!showConfirmPassword);
					}
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerError, { message: serverError }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubmitButton, {
				pendingText: "Creating account...",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "size-4" }),
				children: "Create account"
			})
		]
	});
}
//#endregion
//#region src/pages/auth/signup.astro
var signup_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Signup,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Signup = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Signup;
	const error = Astro.url.searchParams.get("error");
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Sign up" }, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="bg-cosmic flex min-h-screen items-center justify-center p-4"><div class="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl"><h1 class="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-2xl font-bold text-transparent">Sign up</h1>${renderComponent($$result, "SignUpForm", SignUpForm, {
		"serverError": error,
		"client:load": true,
		"client:component-hydration": "load",
		"client:component-path": "@/components/auth/SignUpForm",
		"client:component-export": "default"
	})}<p class="mt-4 text-center text-sm text-blue-100/60">Already have an account?${" "}<a href="/auth/signin" class="text-purple-300 hover:underline">Sign in</a></p></div></div>` })}`;
}, "C:/xampp/htdocs/10x-astro-project/src/pages/auth/signup.astro", void 0);
var $$file = "C:/xampp/htdocs/10x-astro-project/src/pages/auth/signup.astro";
var $$url = "/auth/signup";
//#endregion
//#region \0virtual:astro:page:src/pages/auth/signup@_@astro
var page = () => signup_exports;
//#endregion
export { page };
