const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');const {tmpdir}=require('node:os');const {connect,mediaIO,png}=require('./featureHarness.cjs');
const account=require('../.test-build/core/accountStore.js');const entries=require('../.test-build/core/entryStore.js');const media=require('../.test-build/core/mediaQueue.js');
const {synchronizeEntries}=require('../.test-build/core/entrySync.js');const {ApiError}=require('../.test-build/core/sync.js');
const a={id:'a',email:'a@example.test'},b={id:'b',email:'b@example.test'};
const trip={id:'trip',name:'Synthetic',destination:'Test island',startDate:'2026-11-01',endDate:'2026-11-07',createdAt:'2026-10-22',version:1,deleted:false,ownerId:'a'};
const plan={title:'Synthetic walk',notes:'Test',date:'2026-11-02',time:'09:30',category:'activity',placeId:null,done:false};
function seed(db,role='owner'){account.applyPage(db,[trip],1,[{id:'trip',role}]);}
function folder(){return fs.mkdtempSync(path.join(tmpdir(),'tripora-features-'));}function clean(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('tripora-features-'));fs.rmSync(root,{recursive:true,force:true});}
const view=(id,feature,data,version=2,author=a,deleted=false)=>({id,tripId:'trip',feature,data,version,authorId:author.id,authorEmail:author.email,deleted,createdAt:'2026-10-22'});

test('rejected oversized media recovery preserves immutable outbox and original files through lost acknowledgement/restart',async()=>{
 const root=folder();let c;try{
  const file=path.join(root,'recovery.sqlite');c=connect(file);seed(c.db);const io=mediaIO(path.join(root,'durable'));const source=path.join(root,'picker.png');fs.writeFileSync(source,png());
  const id=randomUUID(),original=await media.attachPhoto(c.db,'trip',a,io,{uri:source,width:2,height:2},id);
  entries.saveEntry(c.db,'trip','memory',{title:'Retained title',notes:'Retained note',placeId:null,mediaId:id},a,randomUUID);
  const before=entries.entrySnapshot(c.db);fs.writeFileSync(source,png(3,2));const replacement=await io.prepare(source,3,2,randomUUID());let repairs=0;io.repairOversized=async()=>{repairs++;return replacement;};
  const calls=[];const api={async request(_path,body){calls.push(structuredClone(body));if(calls.length===1)throw new ApiError(400,{code:'invalid_media'});if(calls.length===2)throw Error('lost ack');return{};}};
  assert.equal(await media.synchronizeMedia(c.db,api,io),1);assert.equal(repairs,1);assert.equal(calls[0].id,calls[1].id);assert.equal(calls[0].id,id);assert.notEqual(calls[0].sha256,calls[1].sha256);assert.deepEqual(entries.entrySnapshot(c.db),before);
  assert.equal(media.mediaSnapshot(c.db)[0].uri,replacement.uri);assert.ok(fs.existsSync(original.uri));assert.ok(fs.existsSync(original.thumbnailUri));
  c.close();c=connect(file);assert.equal(await media.synchronizeMedia(c.db,api,io),0);assert.deepEqual(calls[1],calls[2]);assert.deepEqual(entries.entrySnapshot(c.db),before);assert.equal(media.mediaSnapshot(c.db)[0].state,'uploaded');
  const op=before.pending[0].operation;entries.acknowledgeEntry(c.db,op.operationId,view(op.entryId,'memory',op.data));entries.deleteEntry(c.db,op.entryId,a,randomUUID);const deletion=entries.entrySnapshot(c.db).pending[0].operation;entries.acknowledgeEntry(c.db,deletion.operationId,view(op.entryId,'memory',op.data,3,a,true));await media.cleanupLocalMedia(c.db,io);assert.ok(!fs.existsSync(original.uri));assert.ok(!fs.existsSync(replacement.uri));
 }finally{c?.close();clean(root);}
});

test('media repair is restricted to pending invalid_media and failed storage retains originals/outbox',async()=>{
 const root=folder();const c=connect();try{
  seed(c.db);const io=mediaIO(path.join(root,'durable')),source=path.join(root,'picker.png');fs.writeFileSync(source,png());const id=randomUUID();const original=await media.attachPhoto(c.db,'trip',a,io,{uri:source,width:2,height:2},id);entries.saveEntry(c.db,'trip','memory',{title:'Keep',notes:'',placeId:null,mediaId:id},a,randomUUID);const before=entries.entrySnapshot(c.db);
  let repairs=0;const replacement=await io.prepare(source,2,2,randomUUID());io.repairOversized=async()=>{repairs++;return replacement;};
  for(const error of [new ApiError(409,{code:'media_id_reused'}),new ApiError(400,{code:'other'}),Error('offline')]){await media.synchronizeMedia(c.db,{async request(){throw error;}},io);assert.equal(repairs,0);}
  const row=media.mediaSnapshot(c.db)[0];c.db.run('UPDATE local_media SET body=? WHERE id=?',[JSON.stringify({...row,state:'uploaded'}),id]);await media.synchronizeMedia(c.db,{async request(){throw new ApiError(400,{code:'invalid_media'});}},io);assert.equal(repairs,0);c.db.run('UPDATE local_media SET body=? WHERE id=?',[JSON.stringify(row),id]);
  c.db.exec("CREATE TRIGGER fail_repair BEFORE UPDATE ON local_media WHEN NEW.body LIKE '%recoveryCopies%' BEGIN SELECT RAISE(ABORT,'disk');END;");
  assert.equal(await media.synchronizeMedia(c.db,{async request(){throw new ApiError(400,{code:'invalid_media'});}},io),1);assert.equal(repairs,1);assert.equal(media.mediaSnapshot(c.db)[0].uri,original.uri);assert.ok(fs.existsSync(original.uri));assert.ok(!fs.existsSync(replacement.uri));assert.deepEqual(entries.entrySnapshot(c.db),before);
 }finally{c.close();clean(root);}
});

test('plan validates calendar dates, local times, place references and protects trip date changes',()=>{const c=connect();try{seed(c.db);entries.saveEntry(c.db,'trip','plan',plan,a,randomUUID);for(const changes of [{date:'2026-02-30'},{date:'2026-11-08'},{date:'',time:'09:00'},{time:'24:00'},{placeId:'other-trip-place'}])assert.throws(()=>entries.saveEntry(c.db,'trip','plan',{...plan,...changes},a,randomUUID));
 assert.throws(()=>account.saveAccountTrip(c.db,{...trip,endDate:'2026-11-01'},randomUUID,'trip'),/aktivnosti/);
 const activity=entries.entrySnapshot(c.db).entries[0];entries.saveEntry(c.db,'trip','plan',{...plan,date:'',time:''},a,randomUUID,activity.id);
 assert.doesNotThrow(()=>account.saveAccountTrip(c.db,{...trip,endDate:'2026-11-01'},randomUUID,'trip'));
}finally{c.close();}});

test('packing is personal even for owner; shared expense author is immutable and owner may moderate',()=>{const c=connect();try{seed(c.db);entries.applyEntryPage(c.db,[view('private','packing',{title:'Jacket',packed:false},2,b),view('expense','expense',{title:'Meal',notes:'',date:'2026-11-01',category:'food',amountMinor:'100',currency:'EUR',payer:'Someone else'},3,b)],3);
 assert.equal(entries.canEditEntry(c.db,entries.entrySnapshot(c.db).entries[0],a),false);assert.throws(()=>entries.deleteEntry(c.db,'private',a,randomUUID),/ovlast/);
 assert.throws(()=>entries.applyEntryPage(c.db,[view('foreign-private','packing',{title:'Private',packed:false},4,b)],4,a),/Osobna/);
 entries.saveEntry(c.db,'trip','budget',{currency:'EUR',budgetMinor:'10000'},a,randomUUID);
 entries.saveEntry(c.db,'trip','expense',{title:'Owner correction',notes:'',date:'2026-11-01',category:'food',amountMinor:'150',currency:'EUR',payer:'Different payer'},a,randomUUID,'expense');
 const e=entries.entrySnapshot(c.db).entries.find(v=>v.id==='expense');assert.equal(e.authorId,'b');assert.equal(e.data.payer,'Different payer');
}finally{c.close();}});

test('money arithmetic is exact for comma/dot input, pending edits, deletion and currency lock',()=>{const c=connect();try{seed(c.db);assert.equal(entries.minorUnits('0,10'),'10');assert.equal(entries.minorUnits('0.20'),'20');for(const invalid of ['0','-1','1.001','1e3','1,000.00','NaN'])assert.throws(()=>entries.minorUnits(invalid));
 entries.saveEntry(c.db,'trip','budget',{currency:'EUR',budgetMinor:'10000'},a,randomUUID);
 for(const amountMinor of ['10','20'])entries.saveEntry(c.db,'trip','expense',{title:'Synthetic',notes:'',date:'2026-10-31',category:'food',amountMinor,currency:'EUR',payer:''},a,randomUUID);
 assert.deepEqual(entries.tripTotals(c.db,'trip'),{currency:'EUR',spent:'30',budget:'10000',remaining:'9970'});assert.equal(entries.formatMoney('-5','EUR'),'-0,05 EUR');
 assert.throws(()=>entries.saveEntry(c.db,'trip','budget',{currency:'USD',budgetMinor:'1'},a,randomUUID),/Valuta/);
 const expense=entries.entrySnapshot(c.db).entries.find(e=>e.feature==='expense');entries.deleteEntry(c.db,expense.id,a,randomUUID);assert.equal(entries.tripTotals(c.db,'trip').spent,'20');
}finally{c.close();}});

test('v2 to v3 migration preserves queues, invalidates old readiness and records survive restart',()=>{const root=folder();let c;try{const file=path.join(root,'account.sqlite');c=connect(file);seed(c.db);account.saveAccountTrip(c.db,{...trip,name:'Pending trip'},randomUUID,'trip');const before=account.accountSnapshot(c.db);
 c.db.run('UPDATE account_trips SET body=? WHERE id=?',[JSON.stringify({...before.trips[0],offlinePreparedAt:'2026-10-01T00:00:00Z'}),'trip']);
 c.db.exec('DROP TABLE pending_entries;DROP TABLE account_entries;DROP TABLE entry_meta;DROP TABLE local_media;PRAGMA user_version=2');account.initAccountStore(c.db);assert.deepEqual(account.accountSnapshot(c.db),before);
 entries.saveEntry(c.db,'trip','packing',{title:'Offline jacket',packed:false},a,randomUUID);const row=entries.entrySnapshot(c.db).entries[0];entries.saveEntry(c.db,'trip','packing',{title:'Offline jacket',packed:true},a,randomUUID,row.id);const state=entries.entrySnapshot(c.db);c.close();c=connect(file);assert.deepEqual(entries.entrySnapshot(c.db),state);assert.ok(state.pending[0].followupId);
}finally{c?.close();clean(root);}});

test('entry acknowledgement and page writes roll back; retries keep immutable body then latest draft',async()=>{const c=connect();try{seed(c.db);entries.saveEntry(c.db,'trip','plan',plan,a,randomUUID);const initial=entries.entrySnapshot(c.db);const op=initial.pending[0].operation;
 c.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON pending_entries BEGIN SELECT RAISE(ABORT,'disk');END;");assert.throws(()=>entries.acknowledgeEntry(c.db,op.operationId,view(op.entryId,'plan',plan)),/disk/);assert.deepEqual(entries.entrySnapshot(c.db),initial);c.db.exec('DROP TRIGGER fail_ack');
 let lose=true;let version=1;let remote;const receipts=new Map();const requests=[];const api={async request(path,body){if(path.endsWith('/push')){requests.push(structuredClone(body));if(!receipts.has(body.operationId)){remote=view(body.entryId,body.feature,body.data,++version);receipts.set(body.operationId,remote);}if(lose){lose=false;throw Error('lost ack');}return receipts.get(body.operationId);}return{items:remote?[remote]:[],cursor:version,hasMore:false};}};
 await assert.rejects(synchronizeEntries(c.db,api,a),/lost ack/);entries.saveEntry(c.db,'trip','plan',{...plan,title:'Latest local'},a,randomUUID,op.entryId);await synchronizeEntries(c.db,api,a);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[2].data.title,'Latest local');assert.equal(entries.entrySnapshot(c.db).pending.length,0);
}finally{c.close();}});

test('entry conflicts preserve latest local version and reject tombstone resurrection; validation errors can be repaired',()=>{const c=connect();try{seed(c.db);entries.applyEntryPage(c.db,[view('activity','plan',plan)],2);entries.saveEntry(c.db,'trip','plan',{...plan,title:'Local'},a,randomUUID,'activity');entries.applyEntryPage(c.db,[view('activity','plan',{...plan,title:'Remote'},3)],3);
 let p=entries.entrySnapshot(c.db).pending[0];assert.equal(entries.entrySnapshot(c.db).entries[0].data.title,'Local');entries.resolveEntryConflict(c.db,p.operation.operationId,'local',a,randomUUID);p=entries.entrySnapshot(c.db).pending[0];assert.equal(p.operation.baseVersion,3);entries.markEntryError(c.db,p.operation.operationId,'Podaci nisu prihvaćeni. Uredi zapis i pokušaj ponovno.');
 entries.saveEntry(c.db,'trip','plan',{...plan,title:'Repaired'},a,randomUUID,'activity');assert.notEqual(entries.entrySnapshot(c.db).pending[0].operation.operationId,p.operation.operationId);
 entries.applyEntryPage(c.db,[view('activity','plan',plan,4,a,true)],4);p=entries.entrySnapshot(c.db).pending[0];assert.throws(()=>entries.resolveEntryConflict(c.db,p.operation.operationId,'local',a,randomUUID),/obrisan/);entries.resolveEntryConflict(c.db,p.operation.operationId,'server',a,randomUUID);assert.equal(entries.entrySnapshot(c.db).entries[0].deleted,true);
}finally{c.close();}});

test('removed membership pauses entries without erasing outbox; author-only permission survives remote apply',async()=>{const c=connect();try{seed(c.db,'member');entries.saveEntry(c.db,'trip','plan',plan,b,randomUUID);const before=entries.entrySnapshot(c.db).pending[0].operation;account.applyPage(c.db,[],1,[]);let pushes=0;await synchronizeEntries(c.db,{async request(path){if(path.endsWith('/push'))pushes++;return{items:[],cursor:0,hasMore:false};}},b);
 assert.equal(pushes,0);assert.deepEqual(entries.entrySnapshot(c.db).pending[0].operation,before);assert.equal(entries.entrySnapshot(c.db).pending[0].error,entries.ENTRY_ACCESS_REMOVED);
}finally{c.close();}});

test('photos copy durably before metadata and survive source removal/restart; interrupted upload retries same ID',async()=>{const root=folder();let c;try{const file=path.join(root,'a.sqlite');c=connect(file);seed(c.db);const source=path.join(root,'picker.png');fs.writeFileSync(source,png());const io=mediaIO(path.join(root,'durable'));const id=randomUUID();await media.attachPhoto(c.db,'trip',a,io,{uri:source,width:2,height:2},id);fs.unlinkSync(source);
 entries.saveEntry(c.db,'trip','memory',{title:'Photo memory',notes:'Offline',placeId:null,mediaId:id},a,randomUUID);c.close();c=connect(file);const saved=media.mediaSnapshot(c.db)[0];assert.ok(fs.existsSync(saved.uri));assert.ok(fs.existsSync(saved.thumbnailUri));
 let lose=true;const calls=[];const api={async request(_path,body){calls.push(body);if(lose){lose=false;throw Error('lost upload acknowledgement');}return{id};}};
 assert.equal(await media.synchronizeMedia(c.db,api,io),1);assert.equal(media.mediaSnapshot(c.db)[0].state,'pending');assert.equal(await media.synchronizeMedia(c.db,api,io),0);assert.deepEqual(calls[0],calls[1]);assert.equal(media.mediaSnapshot(c.db)[0].state,'uploaded');
}finally{c?.close();clean(root);}});

test('photo downloads verify hashes, partial download cannot claim saved and confirmed deletion cleans local files',async()=>{const root=folder();const c=connect();try{seed(c.db);const io=mediaIO(path.join(root,'durable'));const source=path.join(root,'picker.png');fs.writeFileSync(source,png());const id=randomUUID();const photo=await media.attachPhoto(c.db,'trip',a,io,{uri:source,width:2,height:2},id);
 entries.saveEntry(c.db,'trip','memory',{title:'Photo',notes:'',placeId:null,mediaId:id},a,randomUUID);const op=entries.entrySnapshot(c.db).pending[0].operation;entries.acknowledgeEntry(c.db,op.operationId,view(op.entryId,'memory',op.data));entries.deleteEntry(c.db,op.entryId,a,randomUUID);
 await media.cleanupLocalMedia(c.db,io);assert.ok(fs.existsSync(photo.uri));const del=entries.entrySnapshot(c.db).pending[0].operation;entries.acknowledgeEntry(c.db,del.operationId,view(op.entryId,'memory',op.data,3,a,true));await media.cleanupLocalMedia(c.db,io);assert.ok(!fs.existsSync(photo.uri));assert.equal(media.mediaSnapshot(c.db).length,0);
 const remote=view('remote-memory','memory',{title:'Remote',notes:'',placeId:null,mediaId:randomUUID()},4,b);entries.applyEntryPage(c.db,[remote],4,a);
 const hash=require('./featureHarness.cjs').hash(png());let calls=0;const api={async request(){calls++;return{base64:png().toString('base64'),sha256:calls===1?hash:'bad-hash'};}};
 await assert.rejects(media.downloadPhoto(c.db,remote,a,api,io),/Corrupt/);assert.equal(media.mediaSnapshot(c.db).length,0);
}finally{c.close();clean(root);}});

test('entry pull applies records and cursor atomically under disk failure',()=>{const c=connect();try{seed(c.db);const before=entries.entrySnapshot(c.db);c.db.exec("CREATE TRIGGER fail_entry_page BEFORE UPDATE ON entry_meta BEGIN SELECT RAISE(ABORT,'disk');END;");assert.throws(()=>entries.applyEntryPage(c.db,[view('new-plan','plan',plan)],2,a),/disk/);assert.deepEqual(entries.entrySnapshot(c.db),before);}finally{c.close();}});

test('photo count limit rejects before copying and leaves pending local work unchanged',async()=>{const c=connect();try{seed(c.db);for(let i=0;i<100;i++){const id=randomUUID();c.db.run('INSERT INTO local_media (id,trip_id,body) VALUES (?,?,?)',[id,'trip',JSON.stringify({id,tripId:'trip',authorId:'a',createdAt:'2026-10-22',uri:'synthetic',thumbnailUri:'synthetic',sha256:'x',thumbnailSha256:'x',state:'pending',error:null})]);}let prepared=false;await assert.rejects(media.attachPhoto(c.db,'trip',a,{async prepare(){prepared=true;}},{uri:'synthetic',width:2,height:2},randomUUID()),/100/);assert.equal(prepared,false);assert.equal(media.mediaSnapshot(c.db).length,100);}finally{c.close();}});
