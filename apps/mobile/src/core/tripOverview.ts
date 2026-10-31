import { AccountSnapshot } from './accountStore';
import { EntrySnapshot, formatMoney } from './entryStore';
import { LocalMedia } from './mediaQueue';
import { PlaceSnapshot } from './placeStore';

export function tripOverview(tripId: string, actorId: string, trips: AccountSnapshot, places: PlaceSnapshot, entries: EntrySnapshot, media: LocalMedia[]) {
  const savedPlaces = places.places.filter(p => p.tripId === tripId && !p.deleted);
  const records = entries.entries.filter(e => e.tripId === tripId && !e.deleted && (e.feature !== 'packing' || e.authorId === actorId));
  const plans = records.filter(e => e.feature === 'plan');
  const packing = records.filter(e => e.feature === 'packing');
  const memories = records.filter(e => e.feature === 'memory');
  const photoIds = new Set(memories.flatMap(e => e.feature === 'memory' && e.data.mediaId ? [e.data.mediaId] : []));
  const localPhotos = new Set(media.filter(m => m.tripId === tripId && photoIds.has(m.id)).map(m => m.id));
  const budget = records.find(e => e.feature === 'budget');
  const expenses = records.filter(e => e.feature === 'expense');
  let spent = 0n;
  const currency = budget?.feature === 'budget' ? budget.data.currency : null;
  const currencyMismatch = expenses.some(e => e.feature === 'expense' && e.data.currency !== currency);
  for (const e of expenses) if (e.feature === 'expense' && e.data.currency === currency) spent += BigInt(e.data.amountMinor);
  const queued = [
    ...trips.pending.filter(p => p.operation.tripId === tripId),
    ...places.pending.filter(p => p.operation.tripId === tripId),
    ...entries.pending.filter(p => p.operation.tripId === tripId && (p.operation.feature !== 'packing' || entries.entries.some(e => e.id === p.operation.entryId && e.authorId === actorId))),
  ];
  const photosPending = media.filter(m => m.tripId === tripId && photoIds.has(m.id) && m.state === 'pending');
  return {
    places: savedPlaces.length, visited: savedPlaces.filter(p => p.visited).length,
    plans: plans.length, unscheduled: plans.filter(e => e.feature === 'plan' && !e.data.date).length,
    packing: packing.length, packed: packing.filter(e => e.feature === 'packing' && e.data.packed).length,
    memories: memories.length, photos: photoIds.size, localPhotos: localPhotos.size,
    pending: queued.length + photosPending.length,
    attention: queued.filter(p => p.conflict || p.error).length + media.filter(m => m.tripId === tripId && m.error).length,
    spent: currency && !currencyMismatch ? formatMoney(spent.toString(), currency) : null,
    remaining: budget?.feature === 'budget' && budget.data.budgetMinor !== null && !currencyMismatch ? formatMoney((BigInt(budget.data.budgetMinor) - spent).toString(), budget.data.currency) : null,
    currencyMismatch,
  };
}
