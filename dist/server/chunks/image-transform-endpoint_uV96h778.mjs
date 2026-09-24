globalThis.process ??= {};
globalThis.process.env ??= {};
import { in as __exportAll } from "./runtime_zVK3H1hm.mjs";
import { t as transform } from "./image-binding-transform_XTDw06BL.mjs";
import { env } from "cloudflare:workers";
//#region node_modules/@astrojs/cloudflare/dist/entrypoints/image-transform-endpoint.js
var image_transform_endpoint_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	prerender: () => false
});
var GET = async (ctx) => {
	const cache = caches.default;
	if (cache) {
		const cached = await cache.match(ctx.request.url);
		if (cached) return cached;
	}
	const response = await transform(ctx.request.url, env.IMAGES, env.ASSETS);
	if (!response.ok) return response;
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	const cachedResponse = new Response(response.body, {
		status: response.status,
		headers
	});
	if (cache) {
		const cfContext = ctx.locals.cfContext;
		if (cfContext) cfContext.waitUntil(cache.put(ctx.request.url, cachedResponse.clone()));
	}
	return cachedResponse;
};
//#endregion
//#region \0virtual:astro:page:node_modules/@astrojs/cloudflare/dist/entrypoints/image-transform-endpoint@_@js
var page = () => image_transform_endpoint_exports;
//#endregion
export { page };
