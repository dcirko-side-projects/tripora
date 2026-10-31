import { ApiError } from './sync';

export type Account = { id: string; email: string; server: string; scope: string };
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type Session = Account & { accessToken: string; refreshToken: string; expiresAt: number };
export interface SessionStorage { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> }
export type Requester = (url: string, options?: RequestInit) => Promise<Response>;
export class SessionClient {
  private session: Session | null = null;
  private refreshing: { generation: number; task: Promise<void> } | null = null;
  private generation = 0;
  private storageWork: Promise<void> = Promise.resolve();
  constructor(
    readonly baseUrl: string, private storage: SessionStorage,
    private scopeFor: (value: string) => Promise<string>, private send: Requester = fetch,
    private now: () => number = Date.now,
  ) {}
  private publicAccount(): Account {
    const { id, email, server, scope } = this.session!;
    return { id, email, server, scope };
  }
  private assertGeneration(generation: number): void {
    if (generation !== this.generation) throw new ApiError(401);
  }
  private currentSession(generation: number): Session {
    this.assertGeneration(generation);
    if (!this.session) throw new ApiError(401);
    return this.session;
  }
  private enqueueStorage(action: () => Promise<void>): Promise<void> {
    const next = this.storageWork.catch(() => {}).then(action);
    this.storageWork = next;
    return next;
  }
  private persist(next: Session, generation: number): Promise<void> {
    return this.enqueueStorage(async () => {
      if (generation !== this.generation) throw new ApiError(401);
      await this.storage.write(JSON.stringify(next));
      if (generation !== this.generation) throw new ApiError(401);
      this.session = next;
    });
  }
  async restore(): Promise<Account | null> {
    const generation = this.generation;
    await this.storageWork.catch(() => {});
    this.assertGeneration(generation);
    const raw = await this.storage.read();
    this.assertGeneration(generation);
    if (!raw) return null;
    let candidate: Session;
    try { candidate = JSON.parse(raw) as Session; }
    catch { throw new Error('Spremljena sesija nije ispravna. Odjavi se i prijavi ponovno.'); }
    if (!candidate || typeof candidate !== 'object') throw new Error('Spremljena sesija nije ispravna. Odjavi se i prijavi ponovno.');
    if (candidate.server !== this.baseUrl) return null;
    if (![candidate.id, candidate.email, candidate.scope, candidate.accessToken, candidate.refreshToken].every(v => typeof v === 'string' && v.length > 0) ||
      !Number.isFinite(candidate.expiresAt) || candidate.scope !== await this.scopeFor(this.baseUrl + '|' + candidate.id))
      throw new Error('Spremljena sesija nije ispravna. Odjavi se i prijavi ponovno.');
    this.assertGeneration(generation);
    this.session = candidate;
    return this.publicAccount();
  }
  private async call<T>(path: string, body?: unknown, access?: string): Promise<T> {
    let response: Response;
    let text: string;
    // Free hosted instances can need about a minute to wake. Keep the same
    // request in flight; replaying arbitrary POSTs could duplicate side effects.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);
    try {
      response = await this.send(this.baseUrl + path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      text = await response.text();
    } catch {
      throw new Error(controller.signal.aborted
        ? 'Server nije odgovorio na vrijeme. Možda se pokreće nakon neaktivnosti. Pokušaj ponovno; lokalni podaci su sačuvani.'
        : 'Veza sa serverom nije dostupna. Provjeri mrežu i dostupnost servera. Lokalni podaci su sačuvani.');
    } finally { clearTimeout(timeout); }
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch {
      if (!response.ok) throw new ApiError(response.status);
      throw new Error('Server je vratio neispravan odgovor. Pokušaj ponovno.');
    }
    if (!response.ok) throw new ApiError(response.status, data ?? {});
    return data as T;
  }
  async signIn(email: string, password: string, register: boolean): Promise<Account> {
    const generation = ++this.generation;
    if (register) {
      await this.call('/auth/register', { email: email.trim(), password });
      const options = await this.call<{ requireConfirmedEmail: boolean }>('/auth/options');
      this.assertGeneration(generation);
      if (options.requireConfirmedEmail) throw new ApiError(403, { code: 'email_confirmation_required' });
    }
    const tokens = await this.call<Tokens>('/auth/login?useCookies=false', { email: email.trim(), password });
    const user = await this.call<{ id: string; email: string }>('/auth/me', undefined, tokens.accessToken);
    const next: Session = { ...user, server: this.baseUrl, scope: await this.scopeFor(this.baseUrl + '|' + user.id),
      accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: this.now() + tokens.expiresIn * 1000 };
    if (generation !== this.generation) throw new ApiError(401);
    await this.persist(next, generation);
    return this.publicAccount();
  }
  async requestPasswordReset(email: string): Promise<void> { await this.call('/auth/forgotPassword', { email: email.trim() }); }
  async resetPassword(email: string, resetCode: string, newPassword: string): Promise<void> { await this.call('/auth/resetPassword', { email: email.trim(), resetCode: resetCode.trim(), newPassword }); }
  async resendConfirmation(email: string): Promise<void> { await this.call('/auth/resendConfirmationEmail', { email: email.trim() }); }
  async confirmEmail(email: string, code: string): Promise<void> { await this.call('/auth/confirm-code', { email: email.trim(), code: code.trim() }); }
  private refresh(): Promise<void> {
    const generation = this.generation;
    if (this.refreshing?.generation === generation) return this.refreshing.task;
    const task = this.refreshSession().finally(() => {
      if (this.refreshing?.task === task) this.refreshing = null;
    });
    this.refreshing = { generation, task };
    return task;
  }
  private async refreshSession(): Promise<void> {
    if (!this.session) throw new ApiError(401);
    const previous = this.session;
    const generation = this.generation;
    const tokens = await this.call<Tokens>('/auth/refresh', { refreshToken: previous.refreshToken });
    if (generation !== this.generation || this.session !== previous) throw new ApiError(401);
    const next = { ...previous, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: this.now() + tokens.expiresIn * 1000 };
    await this.persist(next, generation);
  }
  async request<T>(path: string, body?: unknown): Promise<T> {
    const generation = this.generation;
    if (this.currentSession(generation).expiresAt <= this.now() + 30000) await this.refresh();
    try {
      const result = await this.call<T>(path, body, this.currentSession(generation).accessToken);
      this.currentSession(generation);
      return result;
    }
    catch (error) {
      // A late response belongs to the account that started it, including a 401 retry.
      this.currentSession(generation);
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await this.refresh();
      const result = await this.call<T>(path, body, this.currentSession(generation).accessToken);
      this.currentSession(generation);
      return result;
    }
  }
  async signOut(): Promise<void> {
    this.generation++;
    this.session = null;
    // Serialize secure-storage writes and clearing, including sign-in already writing.
    await this.enqueueStorage(async () => { await this.storage.clear(); this.session = null; });
  }
}
