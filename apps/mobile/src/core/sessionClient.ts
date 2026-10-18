import { ApiError } from './sync';

export type Account = { id: string; email: string; server: string; scope: string };
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type Session = Account & { accessToken: string; refreshToken: string; expiresAt: number };
export interface SessionStorage { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> }
export type Requester = (url: string, options?: RequestInit) => Promise<Response>;
export class SessionClient {
  private session: Session | null = null;
  constructor(
    readonly baseUrl: string, private storage: SessionStorage,
    private scopeFor: (value: string) => Promise<string>, private send: Requester = fetch,
    private now: () => number = Date.now,
  ) {}
  private publicAccount(): Account {
    const { id, email, server, scope } = this.session!;
    return { id, email, server, scope };
  }
  async restore(): Promise<Account | null> {
    const raw = await this.storage.read();
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Session;
    if (candidate.server !== this.baseUrl) return null;
    if (![candidate.id, candidate.email, candidate.scope, candidate.accessToken, candidate.refreshToken].every(v => typeof v === 'string' && v.length > 0) ||
      !Number.isFinite(candidate.expiresAt) || candidate.scope !== await this.scopeFor(this.baseUrl + '|' + candidate.id))
      throw new Error('Spremljena sesija nije ispravna. Odjavi se i prijavi ponovno.');
    this.session = candidate;
    return this.publicAccount();
  }
  private async call<T>(path: string, body?: unknown, access?: string): Promise<T> {
    let response: Response;
    try {
      response = await this.send(this.baseUrl + path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error('Veza sa serverom nije dostupna. Lokalni podaci su sačuvani.'); }
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new ApiError(response.status, data ?? {});
    return data as T;
  }
  async signIn(email: string, password: string, register: boolean): Promise<Account> {
    if (register) await this.call('/auth/register', { email: email.trim(), password });
    const tokens = await this.call<Tokens>('/auth/login?useCookies=false', { email: email.trim(), password });
    const user = await this.call<{ id: string; email: string }>('/auth/me', undefined, tokens.accessToken);
    const next: Session = { ...user, server: this.baseUrl, scope: await this.scopeFor(this.baseUrl + '|' + user.id),
      accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: this.now() + tokens.expiresIn * 1000 };
    await this.storage.write(JSON.stringify(next));
    this.session = next; return this.publicAccount();
  }
  private async refresh(): Promise<void> {
    if (!this.session) throw new ApiError(401);
    const tokens = await this.call<Tokens>('/auth/refresh', { refreshToken: this.session.refreshToken });
    const next = { ...this.session, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: this.now() + tokens.expiresIn * 1000 };
    await this.storage.write(JSON.stringify(next)); this.session = next;
  }
  async request<T>(path: string, body?: unknown): Promise<T> {
    if (!this.session) throw new ApiError(401);
    if (this.session.expiresAt <= this.now() + 30000) await this.refresh();
    try { return await this.call<T>(path, body, this.session!.accessToken); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await this.refresh();
      return this.call<T>(path, body, this.session!.accessToken);
    }
  }
  async signOut(): Promise<void> {
    await this.storage.clear(); this.session = null;
  }
}
