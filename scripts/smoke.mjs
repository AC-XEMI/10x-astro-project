// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
// Local Supabase's mail catcher (Mailpit, [inbucket] in supabase/config.toml): the activation email lands here.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

// Path + query of the activation link in the newest email to `email`; polls while it is being delivered.
async function activationLinkPath() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const id = search.ok ? (await search.json()).messages?.[0]?.ID : undefined;
    if (id) {
      const message = await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json();
      // The link's host is the Supabase site_url; only its path + query are requested from BASE_URL.
      const path = /https?:\/\/[^/"\s<]+(\/auth\/confirm\?[^"\s<]+)/.exec(message.HTML || message.Text)?.[1];
      if (!path) throw new Error(`No /auth/confirm link in the activation email to ${email}`);
      return path.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No activation email for ${email} in Mailpit at ${MAILPIT_URL}`);
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["reports redirects anonymous user", () => request("/reports"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin refused before activation",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/signin?error=email_not_confirmed" },
  ],
  [
    "forged activation link rejected",
    () => request("/auth/confirm?token_hash=forged&type=email"),
    { status: 302, location: "/auth/confirm-email?error=confirmation_link_invalid" },
  ],
  ["activation link signs in", async () => request(await activationLinkPath()), { status: 302, location: "/reports" }],
  ["signout after activation", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=invalid_credentials" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/reports" },
  ],
  ["reports renders for signed-in user", () => request("/reports"), { status: 200 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["reports redirects after signout", () => request("/reports"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
