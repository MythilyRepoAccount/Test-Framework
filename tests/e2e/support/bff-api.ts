import { expect, type APIRequestContext, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';

export const BFF_URL = process.env.BFF_URL ?? 'http://localhost:8090';

type Playwright = PlaywrightWorkerArgs['playwright'];
type Credentials = { email: string; password: string };

export type SubmitClaimBody = {
  incidentDate: string;
  incidentLocation: string;
  description: string;
  claimAmount: number;
};

/** A response read in full before its request context was disposed. */
export type SubmitClaimResult = { status: number; body: string };

/**
 * An authenticated BFF API session, independent of any browser context.
 * Opened once per suite in beforeAll and closed in afterAll.
 */
export class BffApiSession {
  private constructor(
    private readonly playwright: Playwright,
    private readonly request: APIRequestContext
  ) {}

  /** Fails fast with a clear message if the stack is down, then logs in. */
  static async start(playwright: Playwright, user: Credentials): Promise<BffApiSession> {
    const request = await playwright.request.newContext({ baseURL: BFF_URL });

    const health = await request.get('/actuator/health').catch(() => null);
    if (!health?.ok()) {
      await request.dispose();
      throw new Error(`BFF is not healthy at ${BFF_URL}. Start the Docker/Podman stack before running the suite.`);
    }

    const login = await request.post('/api/auth/login', { data: user });
    expect(login.status(), `API login as ${user.email}`).toBe(200);
    return new BffApiSession(playwright, request);
  }

  getClaim(claimId: string): Promise<APIResponse> {
    return this.request.get(`/api/claims/${claimId}`);
  }

  /**
   * The BFF rotates the XSRF-TOKEN cookie on every POST, so concurrent POSTs sharing one
   * cookie jar would invalidate each other's tokens. Each submission therefore runs in its
   * own context carrying this session's auth cookies, and is safe to call concurrently.
   */
  async submitClaim(claim: SubmitClaimBody): Promise<SubmitClaimResult> {
    const isolated = await this.playwright.request.newContext({
      baseURL: BFF_URL,
      storageState: await this.request.storageState(),
    });
    try {
      const response = await isolated.post('/api/claims', {
        data: claim,
        headers: { 'X-XSRF-TOKEN': await freshCsrfToken(isolated) },
      });
      return { status: response.status(), body: await response.text() };
    } finally {
      await isolated.dispose();
    }
  }

  /** Ends the Keycloak session (logout is CSRF-protected) and releases the context. */
  async end(): Promise<void> {
    await this.request.post('/api/auth/logout', { headers: { 'X-XSRF-TOKEN': await freshCsrfToken(this.request) } });
    await this.request.dispose();
  }
}

async function freshCsrfToken(request: APIRequestContext): Promise<string> {
  await request.get('/api/auth/csrf');
  const { cookies } = await request.storageState();
  return cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
}
