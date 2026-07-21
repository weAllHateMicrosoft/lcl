import "server-only";
import crypto from "node:crypto";

// Vertex AI auth (STUDENT-MODEL.md §5). Unlike the other providers, Vertex uses
// a Google Cloud *service account*, not a static API key: we sign a short-lived
// JWT with the SA private key and exchange it for an OAuth access token, which
// we cache (~1h) and send as a bearer. No external SDK — just Node crypto.

export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

export function parseServiceAccount(json: string): ServiceAccount {
  const sa = JSON.parse(json);
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("service-account JSON is missing client_email / private_key / project_id");
  }
  return sa;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// token cache, keyed by service-account email
const cache = new Map<string, { token: string; exp: number }>();

export async function vertexAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(sa.client_email);
  if (hit && hit.exp - 60 > now) return hit.token; // still fresh (60s slack)

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) {
    const err = new Error(`vertex token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(sa.client_email, { token: data.access_token, exp: now + (Number(data.expires_in) || 3600) });
  return data.access_token as string;
}

// The OpenAI-compatible base URL for a project + location. "global" has no
// region prefix on the host; every other location does.
export function vertexBaseUrl(projectId: string, region: string): string {
  const host = region === "global" ? "aiplatform.googleapis.com" : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId}/locations/${region}/endpoints/openapi`;
}

// Vertex's OpenAI-compat surface wants publisher-qualified model ids.
export function vertexModel(model: string): string {
  const m = (model || "gemini-2.5-pro").trim();
  return m.includes("/") ? m : `google/${m}`;
}
