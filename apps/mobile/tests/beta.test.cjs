const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { connect } = require('./featureHarness.cjs');
const account = require('../.test-build/core/accountStore.js');
const entries = require('../.test-build/core/entryStore.js');
const places = require('../.test-build/core/placeStore.js');
const { tripOverview } = require('../.test-build/core/tripOverview.js');
const { actionError } = require('../.test-build/core/actionError.js');
const media = require('../.test-build/core/mediaQueue.js');
const actor = { id: 'a', email: 'a@example.test' };
const trip = { id: 'trip', name: 'Synthetic', destination: 'Test island', startDate: '2026-11-01', endDate: '2026-11-07', createdAt: '2026-10-22', version: 1, deleted: false, ownerId: 'a' };
function seed(db) { account.applyPage(db, [trip], 1, [{id: trip.id, role: 'owner'}]); }

test('trip overview includes pending edits/deletions, personal packing, exact money and photo availability', () => {
  const c = connect();
  try {
    seed(c.db);
    places.savePlace(c.db, 'trip', {category:'food',name:'Synthetic cafe',notes:'',address:'',link:'',visited:true}, randomUUID);
    entries.saveEntry(c.db,'trip','budget',{currency:'EUR',budgetMinor:'100'},actor,randomUUID);
    for(const amountMinor of ['10','20']) entries.saveEntry(c.db,'trip','expense',{title:'Synthetic',notes:'',date:'2026-11-01',category:'food',amountMinor,currency:'EUR',payer:''},actor,randomUUID);
    entries.saveEntry(c.db,'trip','packing',{title:'Jacket',packed:true},actor,randomUUID);
    entries.saveEntry(c.db,'trip','memory',{title:'Synthetic photo',notes:'',placeId:null,mediaId:'photo'},actor,randomUUID);
    const all = entries.entrySnapshot(c.db);
    // Include another participant's record defensively: it must not enter the personal overview.
    all.entries.push({...all.entries.find(e=>e.feature==='packing'),id:'foreign',authorId:'b'});
    const overview = () => tripOverview('trip','a',account.accountSnapshot(c.db),places.placeSnapshot(c.db),entries.entrySnapshot(c.db),[]);
    const first = tripOverview('trip','a',account.accountSnapshot(c.db),places.placeSnapshot(c.db),all,[]);
    assert.equal(first.packing,1);assert.equal(first.packed,1);assert.equal(first.spent,'0,30 EUR');assert.equal(first.remaining,'0,70 EUR');assert.equal(first.photos,1);assert.equal(first.localPhotos,0);assert.equal(first.visited,1);
    const expense=all.entries.find(e=>e.feature==='expense'); entries.deleteEntry(c.db,expense.id,actor,randomUUID);
    assert.equal(overview().spent,'0,20 EUR');
    const packed=all.entries.find(e=>e.feature==='packing');entries.deleteEntry(c.db,packed.id,actor,randomUUID);
    assert.equal(overview().packing,0);assert.equal(overview().pending,6);
    const withPhoto=tripOverview('trip','a',account.accountSnapshot(c.db),places.placeSnapshot(c.db),entries.entrySnapshot(c.db),[{id:'photo',tripId:'trip',state:'uploaded'}]);assert.equal(withPhoto.localPhotos,1);
  } finally { c.close(); }
});

test('disk-full transaction and photo failures preserve saved data/queues and show a useful storage message', async () => {
  const c=connect();
  try {
    seed(c.db);entries.saveEntry(c.db,'trip','packing',{title:'Saved jacket',packed:false},actor,randomUUID);
    const before=entries.entrySnapshot(c.db);
    c.db.exec("CREATE TRIGGER disk_full BEFORE INSERT ON pending_entries BEGIN SELECT RAISE(ABORT,'SQLITE_FULL: database or disk is full'); END;");
    let failure;try{entries.saveEntry(c.db,'trip','packing',{title:'Uncommitted',packed:false},actor,randomUUID);}catch(e){failure=e;}
    assert.match(actionError(failure),/Nema dovoljno prostora/);assert.deepEqual(entries.entrySnapshot(c.db),before);
    await assert.rejects(media.attachPhoto(c.db,'trip',actor,{async prepare(){throw Object.assign(Error('private/path ENOSPC'),{code:'ENOSPC'});}}, {uri:'synthetic://source',width:2,height:2},randomUUID()),/ENOSPC/);
    assert.equal(media.mediaSnapshot(c.db).length,0);assert.deepEqual(entries.entrySnapshot(c.db),before);
    assert.ok(!actionError(Object.assign(Error('/private/file'),{code:'ENOSPC'})).includes('/private/file'));
  } finally {c.close();}
});
