import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupLocal, restoreLocal, withMaintenance } from './local-backup.mjs';
const root=fileURLToPath(new URL('../../local-data/',import.meta.url));

test('local snapshots verify corruption/path traversal, preserve empty directories and refuse overwrite/active locks', async()=>{
  await mkdir(root,{recursive:true});const work=await mkdtemp(join(root,'backup-test-'));
  try {
    const source=join(work,'source'),snapshot=join(work,'snapshot'),target=join(work,'restored');
    await mkdir(join(source,'postgres','empty'),{recursive:true});await mkdir(join(source,'media'));
    await writeFile(join(source,'postgres','PG_VERSION'),'17');await writeFile(join(source,'settings.json'),'{"synthetic":true}');await writeFile(join(source,'media','synthetic.png'),'synthetic');
    await withMaintenance(async()=>{await assert.rejects(backupLocal(source,snapshot),/lock exists/);});
    await assert.rejects(backupLocal(source,join(source,'nested')),/nested/);
    await assert.rejects(backupLocal(source,join(root,'..','outside')),/strictly inside/);
    await backupLocal(source,snapshot);
    await mkdir(join(work,'incomplete.partial'));await assert.rejects(restoreLocal(join(work,'incomplete.partial'),target),/Incomplete snapshot/);
    const manifest=await readFile(join(snapshot,'manifest.json'),'utf8');
    await writeFile(join(snapshot,'media','synthetic.png'),'corrupted');
    await assert.rejects(restoreLocal(snapshot,target),/checksum mismatch/);await assert.rejects(access(target));
    await writeFile(join(snapshot,'media','synthetic.png'),'synthetic');
    const evil=JSON.parse(manifest);evil.files[0].name='../outside';await writeFile(join(snapshot,'manifest.json'),JSON.stringify(evil));
    await assert.rejects(restoreLocal(snapshot,target),/Invalid snapshot path/);await assert.rejects(access(target));
    await writeFile(join(snapshot,'manifest.json'),manifest);await restoreLocal(snapshot,target);
    assert.equal(await readFile(join(target,'settings.json'),'utf8'),'{"synthetic":true}');await access(join(target,'postgres','empty'));
    await assert.rejects(restoreLocal(snapshot,target),/already exists/);
  }finally{
    assert.equal(resolve(work).startsWith(resolve(root)+ (process.platform==='win32'?'\\':'/')),true);await rm(work,{recursive:true,force:true});
  }
});
