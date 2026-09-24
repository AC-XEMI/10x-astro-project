globalThis.process ??= {};
globalThis.process.env ??= {};
import { a as baseService } from "./assets_DKtRuSBz.mjs";
//#region node_modules/@astrojs/cloudflare/dist/entrypoints/image-service-workerd.js
var image_service_workerd_default = {
	...baseService,
	async transform(inputBuffer, transform) {
		return {
			data: inputBuffer,
			format: transform.format
		};
	}
};
//#endregion
export { image_service_workerd_default as default };
