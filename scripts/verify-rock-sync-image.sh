#!/bin/sh
# CI-only public TLS controls and injected worker dependencies. Never starts sync.
set -eu
cd /app
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
assert.equal(process.version,'v24.22.1');
const hosts=['dv-g3b-emudhra.we-have-a-problem.com','dv-g3b-aaa-emudhra.we-have-a-problem.com'];
for(const host of hosts)await assert.rejects(fetch('https://'+host+'/',{signal:AbortSignal.timeout(10000)}),e=>e.cause?.code==='CERT_REVOKED');
assert.equal((await fetch('https://www.google.com/generate_204',{signal:AbortSignal.timeout(10000)})).status,204);
for(const options of [['-CAfile','/etc/ssl/certs/ca-certificates.crt','-no-CApath','-no-CAstore'],['-CApath','/etc/ssl/certs','-no-CAfile','-no-CAstore']]){
 for(const host of [...hosts,'www.google.com']){
  const r=spawnSync('openssl',['s_client','-connect',host+':443','-servername',host,'-verify_return_error',...options],{input:'',encoding:'utf8',timeout:12000});const out=r.stdout+r.stderr;assert(!r.error);
  assert(host==='www.google.com'?r.status===0&&/Verification: OK|Verify return code: 0/.test(out):r.status!==0&&/certificate verify failed|unable to get local issuer certificate/i.test(out));
 }
}
const scratch=mkdtempSync('/tmp/rock-sync-registry-');
try{
 writeFileSync(scratch+'/npmrc','');
 for(const tool of ['npm','pnpm'])for(const host of [...hosts,'registry.npmjs.org']){
  const r=spawnSync(tool,['view','is-number@7.0.0','version','--registry=https://'+host+'/'],{env:{PATH:process.env.PATH,HOME:scratch,SSL_CERT_DIR:process.env.SSL_CERT_DIR,NPM_CONFIG_USERCONFIG:scratch+'/npmrc',NPM_CONFIG_GLOBALCONFIG:scratch+'/npmrc',NPM_CONFIG_CACHE:scratch+'/cache',NPM_CONFIG_FETCH_RETRIES:'0',NPM_CONFIG_FETCH_TIMEOUT:'10000'},encoding:'utf8',timeout:20000});
  const cert=/CERT_REVOKED|certificate revoked|UnknownIssuer|unable to get local issuer certificate|certificate verify failed/i.test(r.stdout+r.stderr);
  assert(!r.error&&(host==='registry.npmjs.org'?r.status===0&&/7\.0\.0/.test(r.stdout):r.status!==0&&cert));
 }
}finally{rmSync(scratch,{recursive:true,force:true})}
console.log('PASS: production Node, OS bundle/directory and actual installed npm/pnpm reject both affected chains and reach valid controls');
JS
PAYLOAD_SECRET=synthetic-image-only-payload-secret-0000000000000000 DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/fixture ROCK_API_KEY=synthetic-no-provider-credential ROCK_API_URL=https://audit.invalid node --import tsx --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import net from 'node:net';
net.Socket.prototype.connect=function(){throw new Error('Network is forbidden in the isolated worker fixture')};
const {runRockSyncWorker,runWorkerEntrypoint,notifyCompletedWorker}=await import('./src/workers/rock-sync.ts');
let sync=0,notify=0;
const completed=await runRockSyncWorker({runSync:async()=>{sync++;return[]},withLock:async op=>({acquired:true,value:await op()}),notifyWebsite:async result=>{assert.deepEqual(result,[]);notify++}});
assert.deepEqual(completed,{status:'completed',results:[]});assert.equal(sync,1);assert.equal(notify,1);
const skipped=await runRockSyncWorker({runSync:async()=>{throw new Error('Unexpected sync')},withLock:async()=>({acquired:false}),notifyWebsite:async()=>{throw new Error('Unexpected notification')}});assert.equal(skipped.status,'skipped');
let heartbeat=0;await notifyCompletedWorker(skipped,async()=>{heartbeat++});assert.equal(heartbeat,0);await notifyCompletedWorker(completed,async()=>{heartbeat++});assert.equal(heartbeat,1);
const exits=[];await runWorkerEntrypoint({run:async()=>{},exit:code=>{exits.push(code)},notify:async()=>{throw new Error('Unexpected provider request')}});assert.deepEqual(exits,[0]);
await runWorkerEntrypoint({run:async()=>{throw new Error('synthetic expected worker failure')},exit:code=>{exits.push(code)},notify:async()=>{heartbeat++}});assert.deepEqual(exits,[0,1]);assert.equal(heartbeat,2);
console.log('PASS: worker completion, lock skip, heartbeat decisions and entrypoint success/failure using injected dependencies; no real sync, database or provider');
JS
