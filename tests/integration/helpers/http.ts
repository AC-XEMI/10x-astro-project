export interface UploadFile {
  field: string;
  name: string;
  content: Uint8Array<ArrayBuffer> | string;
  type: string;
}

export interface RequestOptions {
  method?: string;
  form?: Record<string, string>;
  multipart?: { fields?: Record<string, string>; file?: UploadFile };
  json?: unknown;
  readBody?: boolean;
}

export interface HttpResponse {
  status: number;
  // Path (plus query) of the Location header, resolved against the base URL; null without a redirect.
  location: string | null;
  body?: string;
}

export type CookieSnapshot = ReadonlyMap<string, string>;

// Same contract as scripts/smoke.mjs: no redirect following, an Origin header (Astro's checkOrigin
// rejects form POSTs without it) and a cookie jar that carries the session between requests.
export class HttpClient {
  private jar = new Map<string, string>();

  constructor(readonly baseUrl: string) {}

  snapshotCookies(): CookieSnapshot {
    return new Map(this.jar);
  }

  restoreCookies(snapshot: CookieSnapshot): void {
    this.jar = new Map(snapshot);
  }

  clearCookies(): void {
    this.jar.clear();
  }

  async request(path: string, options: RequestOptions = {}): Promise<HttpResponse> {
    const headers: Record<string, string> = { Origin: this.baseUrl };
    if (this.jar.size > 0) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");

    let body: string | FormData | undefined;
    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.form).toString();
    } else if (options.multipart) {
      const data = new FormData();
      for (const [key, value] of Object.entries(options.multipart.fields ?? {})) data.append(key, value);
      const file = options.multipart.file;
      if (file) data.append(file.field, new Blob([file.content], { type: file.type }), file.name);
      body = data;
    } else if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      method: options.method ?? (body === undefined ? "GET" : "POST"),
      redirect: "manual",
      headers,
      body,
    });
    this.storeCookies(response);

    const rawLocation = response.headers.get("location");
    const location = rawLocation === null ? null : relativeLocation(rawLocation, this.baseUrl);

    if (options.readBody) return { status: response.status, location, body: await response.text() };
    await response.body?.cancel();
    return { status: response.status, location };
  }

  private storeCookies(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair = "", ...attrs] = raw.split(";");
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const expired = attrs.some((attr) => {
        const [key = "", attrValue = ""] = attr.trim().split("=");
        if (/^max-age$/i.test(key)) return Number(attrValue) <= 0;
        if (/^expires$/i.test(key)) return Date.parse(attrValue) <= Date.now();
        return false;
      });
      if (expired || value === "") this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }
}

function relativeLocation(location: string, baseUrl: string): string {
  const url = new URL(location, baseUrl);
  return url.origin === new URL(baseUrl).origin ? url.pathname + url.search : url.href;
}

export async function signInViaApp(
  http: HttpClient,
  credentials: { email: string; password: string },
): Promise<HttpResponse> {
  return http.request("/api/auth/signin", { form: { email: credentials.email, password: credentials.password } });
}
