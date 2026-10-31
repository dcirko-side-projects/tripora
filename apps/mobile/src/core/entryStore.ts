import { InputError, LocalDatabase, validateTrip } from './localStore';
export type Feature = 'plan' | 'packing' | 'budget' | 'expense' | 'memory';
export type PlanData = {
    title: string;
    notes: string;
    date: string;
    time: string;
    category: 'activity' | 'transport' | 'stay';
    placeId: string | null;
    done: boolean;
};
export type PackingData = {
    title: string;
    packed: boolean;
};
export type BudgetData = {
    currency: 'EUR' | 'USD' | 'GBP';
    budgetMinor: string | null;
};
export type ExpenseData = {
    title: string;
    notes: string;
    date: string;
    category: string;
    amountMinor: string;
    currency: BudgetData['currency'];
    payer: string;
};
export type MemoryData = {
    title: string;
    notes: string;
    placeId: string | null;
    mediaId: string | null;
};
export type DataMap = {
    plan: PlanData;
    packing: PackingData;
    budget: BudgetData;
    expense: ExpenseData;
    memory: MemoryData;
};
export type EntryData = DataMap[Feature];
export type Actor = {
    id: string;
    email: string;
};
export type Entry = {
    [F in Feature]: {
        id: string;
        tripId: string;
        feature: F;
        data: DataMap[F];
        authorId: string;
        authorEmail: string;
        createdAt: string;
        version: number;
        deleted: boolean;
    };
}[Feature];
export type EntryOperation = {
    operationId: string;
    entryId: string;
    tripId: string;
    feature: Feature;
    kind: 'create' | 'update' | 'delete';
    baseVersion: number;
    data: EntryData | null;
};
export type EntryPending = {
    operation: EntryOperation;
    error: string | null;
    conflict: Entry | null;
    followupId: string | null;
};
export type EntrySnapshot = {
    entries: Entry[];
    pending: EntryPending[];
    cursor: number;
};
export const ENTRY_ACCESS_REMOVED = 'Pristup je uklonjen. Lokalni plan, troškovi i uspomene ostaju sačuvani.';
type Row = {
    body: string;
    error: string | null;
    conflict: string | null;
    followup_id: string | null;
};
export type ParentTrip = {
    id: string;
    startDate: string;
    endDate: string;
    version: number;
    deleted: boolean;
    accessRevoked?: boolean;
    role?: 'owner' | 'member';
    ownerId?: string;
};
export function initEntryStore(db: LocalDatabase): void {
    db.exec(`CREATE TABLE account_entries (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL REFERENCES account_trips(id), feature TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE pending_entries (operation_id TEXT PRIMARY KEY NOT NULL, entry_id TEXT NOT NULL UNIQUE REFERENCES account_entries(id), body TEXT NOT NULL, error TEXT, conflict TEXT, followup_id TEXT);
    CREATE TABLE entry_meta (id INTEGER PRIMARY KEY CHECK(id=1), cursor INTEGER NOT NULL);
    INSERT INTO entry_meta VALUES (1,0);
    CREATE TABLE local_media (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL REFERENCES account_trips(id), body TEXT NOT NULL);`);
}
export function readParent(db: LocalDatabase, id: string): ParentTrip {
    const row = db.all<{
        body: string;
    }>('SELECT body FROM account_trips WHERE id=?', [id])[0];
    if (!row)
        throw new InputError('Putovanje nije dostupno na uređaju.');
    return JSON.parse(row.body);
}
export function minorUnits(value: string, zero = false): string {
    if (!/^\d{1,10}([.,]\d{1,2})?$/.test(value.trim()))
        throw new InputError('Unesi pozitivan iznos s najviše dvije decimale, bez razdjelnika tisuća.');
    const [major, fraction = ''] = value.trim().replace(',', '.').split('.');
    const result = BigInt(major) * 100n + BigInt(fraction.padEnd(2, '0'));
    if ((!zero && result === 0n) || result > 999999999999n)
        throw new InputError('Iznos je izvan dopuštenog raspona.');
    return result.toString();
}
export function formatMoney(value: string, currency: string): string {
    const n = BigInt(value);
    const abs = n < 0n ? -n : n;
    return `${n < 0n ? '-' : ''}${abs / 100n},${(abs % 100n).toString().padStart(2, '0')} ${currency}`;
}
function validMoney(value: string, zero = false) { return /^(0|[1-9]\d{0,11})$/.test(value) && (zero || BigInt(value) > 0n); }
function validDate(value: string): boolean {
    try {
        validateTrip({ name: 'x', destination: 'x', startDate: value, endDate: value });
        return true;
    }
    catch {
        return false;
    }
}
function title(value: string): string { const result = value.trim(); if (!result || result.length > 120)
    throw new InputError('Naslov mora imati 1–120 znakova.'); return result; }
function notes(value: string): string { if (value.length > 2000)
    throw new InputError('Bilješka može imati do 2000 znakova.'); return value.trim(); }
function placeAllowed(db: LocalDatabase, tripId: string, id: string | null) {
    if (!id)
        return;
    const row = db.all<{
        body: string;
    }>('SELECT body FROM account_places WHERE id=? AND trip_id=?', [id, tripId])[0];
    if (!row || JSON.parse(row.body).deleted)
        throw new InputError('Odaberi postojeće mjesto ovog putovanja ili ukloni poveznicu.');
}
export function validateEntry<F extends Feature>(db: LocalDatabase, tripId: string, feature: F, raw: DataMap[F]): DataMap[F] {
    const trip = readParent(db, tripId);
    let result: EntryData;
    switch (feature) {
        case 'plan': {
            const p = raw as PlanData;
            if (!['activity', 'transport', 'stay'].includes(p.category) || typeof p.done !== 'boolean' || (p.date ? !validDate(p.date) || p.date < trip.startDate || p.date > trip.endDate : !!p.time) || (p.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)))
                throw new InputError('Provjeri datum unutar putovanja i lokalno vrijeme HH:mm. Bez datuma ostavi vrijeme prazno.');
            placeAllowed(db, tripId, p.placeId);
            result = { title: title(p.title), notes: notes(p.notes), category: p.category, date: p.date, time: p.time, placeId: p.placeId, done: p.done };
            break;
        }
        case 'packing': {
            const p = raw as PackingData;
            if (typeof p.packed !== 'boolean')
                throw new InputError('Neispravan status pakiranja.');
            result = { title: title(p.title), packed: p.packed };
            break;
        }
        case 'budget': {
            const b = raw as BudgetData;
            if (!['EUR', 'USD', 'GBP'].includes(b.currency) || (b.budgetMinor !== null && !validMoney(b.budgetMinor, true)))
                throw new InputError('Provjeri valutu i budžet.');
            const all = entrySnapshot(db).entries;
            const old = all.find(e => e.id === tripId && e.feature === 'budget');
            if (old?.feature === 'budget' && old.data.currency !== b.currency && all.some(e => e.tripId === tripId && e.feature === 'expense'))
                throw new InputError('Valuta se ne mijenja nakon prvog troška.');
            result = { currency: b.currency, budgetMinor: b.budgetMinor };
            break;
        }
        case 'expense': {
            const e = raw as ExpenseData;
            const budget = entrySnapshot(db).entries.find(v => v.id === tripId && v.feature === 'budget' && !v.deleted);
            if (!validDate(e.date) || !validMoney(e.amountMinor) || budget?.feature !== 'budget' || budget.data.currency !== e.currency || e.payer.length > 120)
                throw new InputError('Vlasnik prvo postavlja valutu putovanja. Provjeri iznos i datum troška.');
            result = { title: title(e.title), notes: notes(e.notes), date: e.date, category: title(e.category), amountMinor: e.amountMinor, currency: e.currency, payer: e.payer.trim() };
            break;
        }
        case 'memory': {
            const m = raw as MemoryData;
            placeAllowed(db, tripId, m.placeId);
            result = { title: title(m.title), notes: notes(m.notes), placeId: m.placeId, mediaId: m.mediaId };
            break;
        }
        default: throw new InputError('Nepoznata vrsta zapisa.');
    }
    return result as DataMap[F];
}
function put(db: LocalDatabase, entry: Entry) { db.run('INSERT INTO account_entries (id,trip_id,feature,body) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body', [entry.id, entry.tripId, entry.feature, JSON.stringify(entry)]); }
function read(db: LocalDatabase, id: string): Entry | undefined { const row = db.all<{
    body: string;
}>('SELECT body FROM account_entries WHERE id=?', [id])[0]; return row && JSON.parse(row.body); }
function pending(db: LocalDatabase, id: string): Row | undefined { return db.all<Row>('SELECT body,error,conflict,followup_id FROM pending_entries WHERE entry_id=?', [id])[0]; }
function enqueue(db: LocalDatabase, op: EntryOperation) { db.run('INSERT INTO pending_entries (operation_id,entry_id,body) VALUES (?,?,?)', [op.operationId, op.entryId, JSON.stringify(op)]); }
export function canEditEntry(db: LocalDatabase, entry: Entry, actor: Actor): boolean {
    const trip = readParent(db, entry.tripId);
    if (trip.deleted || trip.accessRevoked)
        return false;
    const owner = trip.ownerId ? trip.ownerId === actor.id : trip.role !== 'member';
    if (entry.feature === 'packing')
        return entry.authorId === actor.id;
    if (entry.feature === 'budget')
        return owner;
    return entry.feature === 'plan' || entry.authorId === actor.id || owner;
}
function stage(db: LocalDatabase, entry: Entry, actor: Actor, newId: () => string, kind: EntryOperation['kind']) {
    if (!canEditEntry(db, entry, actor))
        throw new InputError('Nemaš ovlast za promjenu ovog zapisa.');
    const queued = pending(db, entry.id);
    if (queued?.conflict || (queued?.error && !queued.error.startsWith('Podaci nisu prihvaćeni.')))
        throw new InputError('Prvo riješi označenu promjenu zapisa.');
    put(db, entry);
    if (queued?.error?.startsWith('Podaci nisu prihvaćeni.')) {
        const rejected: EntryOperation = JSON.parse(queued.body);
        db.run('DELETE FROM pending_entries WHERE entry_id=?', [entry.id]);
        if (rejected.kind === 'create' && entry.deleted)
            return;
        enqueue(db, { ...rejected, operationId: newId(), kind: rejected.kind === 'create' ? 'create' : kind, data: kind === 'delete' ? null : entry.data });
        return;
    }
    if (queued)
        db.run('UPDATE pending_entries SET followup_id=? WHERE entry_id=?', [queued.followup_id ?? newId(), entry.id]);
    else
        enqueue(db, { operationId: newId(), entryId: entry.id, tripId: entry.tripId, feature: entry.feature, kind, baseVersion: entry.version, data: kind === 'delete' ? null : entry.data });
}
export function saveEntry<F extends Feature>(db: LocalDatabase, tripId: string, feature: F, data: DataMap[F], actor: Actor, newId: () => string, id?: string): void {
    db.transaction(() => {
        const clean = validateEntry(db, tripId, feature, data);
        const key = feature === 'budget' ? tripId : id;
        const old = key ? read(db, key) : undefined;
        if ((id && !old) || (old && (old.tripId !== tripId || old.feature !== feature || old.deleted)))
            throw new InputError('Zapis nije dostupan.');
        const entry = { id: key ?? newId(), tripId, feature, data: clean, authorId: old?.authorId ?? actor.id, authorEmail: old?.authorEmail ?? actor.email, createdAt: old?.createdAt ?? new Date().toISOString(), version: old?.version ?? 0, deleted: false } as Entry;
        stage(db, entry, actor, newId, old ? 'update' : 'create');
    });
}
export function deleteEntry(db: LocalDatabase, id: string, actor: Actor, newId: () => string): void {
    db.transaction(() => { const entry = read(db, id); if (!entry || entry.deleted || entry.feature === 'budget')
        throw new InputError('Zapis nije dostupan za brisanje.'); stage(db, { ...entry, deleted: true }, actor, newId, 'delete'); });
}
export function entrySnapshot(db: LocalDatabase): EntrySnapshot {
    return { entries: db.all<{
            body: string;
        }>('SELECT body FROM account_entries').map(r => JSON.parse(r.body) as Entry),
        pending: db.all<Row>('SELECT body,error,conflict,followup_id FROM pending_entries ORDER BY rowid').map(r => ({ operation: JSON.parse(r.body), error: r.error, conflict: r.conflict ? JSON.parse(r.conflict) : null, followupId: r.followup_id })),
        cursor: db.all<{
            cursor: number;
        }>('SELECT cursor FROM entry_meta WHERE id=1')[0].cursor };
}
export function acknowledgeEntry(db: LocalDatabase, id: string, remote: Entry): void {
    db.transaction(() => {
        const row = db.all<Row>('SELECT body,error,conflict,followup_id FROM pending_entries WHERE operation_id=?', [id])[0];
        if (!row)
            throw new Error('Potvrda nema pripadajuću promjenu.');
        const op: EntryOperation = JSON.parse(row.body);
        if (op.entryId !== remote.id || op.tripId !== remote.tripId || op.feature !== remote.feature)
            throw new Error('Potvrda ne pripada zapisu.');
        const local = read(db, op.entryId)!;
        db.run('DELETE FROM pending_entries WHERE operation_id=?', [id]);
        if (row.followup_id && !remote.deleted) {
            put(db, { ...local, authorId: remote.authorId, authorEmail: remote.authorEmail, version: remote.version, createdAt: remote.createdAt });
            enqueue(db, { ...op, operationId: row.followup_id, baseVersion: remote.version, kind: local.deleted ? 'delete' : 'update', data: local.deleted ? null : local.data });
        }
        else
            put(db, remote);
    });
}
export function markEntryError(db: LocalDatabase, id: string, error: string, conflict: Entry | null = null): void { db.run('UPDATE pending_entries SET error=?,conflict=? WHERE operation_id=?', [error, conflict ? JSON.stringify(conflict) : null, id]); }
export function refreshEntryAccess(db: LocalDatabase): void {
    for (const row of db.all<Row>('SELECT body,error,conflict,followup_id FROM pending_entries')) {
        const op: EntryOperation = JSON.parse(row.body);
        const trip = readParent(db, op.tripId);
        if (trip.accessRevoked)
            db.run('UPDATE pending_entries SET error=? WHERE operation_id=?', [ENTRY_ACCESS_REMOVED, op.operationId]);
        else if (row.error === ENTRY_ACCESS_REMOVED)
            db.run('UPDATE pending_entries SET error=? WHERE operation_id=?', [row.conflict ? 'Sukob verzija zapisa.' : null, op.operationId]);
    }
}
export function applyEntryPage(db: LocalDatabase, items: Entry[], cursor: number, actor?: Actor): void {
    if (!Number.isSafeInteger(cursor) || cursor < 0 || items.some(e => e.version > cursor))
        throw new Error('Neispravna stranica zapisa.');
    db.transaction(() => {
        if (cursor < entrySnapshot(db).cursor)
            throw new Error('Kursor zapisa ne smije ići unatrag.');
        for (const remote of items) {
            readParent(db, remote.tripId);
            if (actor && remote.feature === 'packing' && remote.authorId !== actor.id)
                throw new Error('Osobna packing lista ne pripada računu.');
            const old = read(db, remote.id);
            if (old && (old.tripId !== remote.tripId || old.feature !== remote.feature || old.authorId !== remote.authorId))
                throw new Error('Zapis ne smije promijeniti roditelja, vrstu ili autora.');
            const queued = pending(db, remote.id);
            if (queued) {
                const op: EntryOperation = JSON.parse(queued.body);
                if (remote.version > op.baseVersion)
                    markEntryError(db, op.operationId, 'Sukob verzija zapisa.', remote);
            }
            else
                put(db, remote);
        }
        refreshEntryAccess(db);
        db.run('UPDATE entry_meta SET cursor=? WHERE id=1', [cursor]);
    });
}
export function resolveEntryConflict(db: LocalDatabase, id: string, choice: 'local' | 'server', actor: Actor, newId: () => string): void {
    db.transaction(() => {
        const row = db.all<Row>('SELECT body,error,conflict,followup_id FROM pending_entries WHERE operation_id=?', [id])[0];
        if (!row?.conflict)
            throw new InputError('Sukob nije dostupan.');
        const op: EntryOperation = JSON.parse(row.body);
        const remote: Entry = JSON.parse(row.conflict);
        const local = read(db, op.entryId)!;
        if (readParent(db, local.tripId).accessRevoked)
            throw new InputError(ENTRY_ACCESS_REMOVED);
        if (choice === 'local') {
            if (remote.deleted)
                throw new InputError('Zapis je obrisan na serveru.');
            if (!canEditEntry(db, local, actor))
                throw new InputError('Nemaš ovlast za promjenu zapisa.');
            if (!local.deleted)
                validateEntry(db, local.tripId, local.feature, local.data);
        }
        db.run('DELETE FROM pending_entries WHERE operation_id=?', [id]);
        if (choice === 'server')
            put(db, remote);
        else {
            put(db, { ...local, version: remote.version });
            enqueue(db, { ...op, operationId: newId(), baseVersion: remote.version, kind: local.deleted ? 'delete' : 'update', data: local.deleted ? null : local.data });
        }
    });
}
export function tripTotals(db: LocalDatabase, tripId: string): {
    currency: string;
    spent: string;
    budget: string | null;
    remaining: string | null;
} | null {
    const all = entrySnapshot(db).entries;
    const settings = all.find(e => e.id === tripId && e.feature === 'budget' && !e.deleted);
    if (settings?.feature !== 'budget')
        return null;
    let sum = 0n;
    for (const e of all)
        if (e.tripId === tripId && e.feature === 'expense' && !e.deleted) {
            if (e.data.currency !== settings.data.currency)
                throw new InputError('Valuta troška nije usklađena s putovanjem.');
            sum += BigInt(e.data.amountMinor);
        }
    return { currency: settings.data.currency, spent: sum.toString(), budget: settings.data.budgetMinor, remaining: settings.data.budgetMinor === null ? null : (BigInt(settings.data.budgetMinor) - sum).toString() };
}
