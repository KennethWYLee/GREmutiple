import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Isolated in-memory database and mocked authenticated identity: no live accounts or HTTP identity headers.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('drizzle/0000_amazing_blockbuster.sql','utf8'));
let signedIn=null;
function prepared(sql,values=[]){const stmt=sqlite.prepare(sql);return {bind:(...v)=>prepared(sql,v),first:async()=>stmt.get(...values)||null,all:async()=>({results:stmt.all(...values)}),run:async()=>({meta:{changes:stmt.run(...values).changes}}),execute:()=>({meta:{changes:stmt.run(...values).changes}})}}
const database={prepare:prepared,batch:async(items)=>{sqlite.exec('BEGIN');try{const result=items.map(s=>s.execute());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
function module(path,deps={}){const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)((name)=>{if(name in deps)return deps[name];throw new Error('Unexpected import '+name)},exports);return exports}
const model=module('lib/model.ts');
const bank=module('lib/bank.ts',{'../data/questions.json':JSON.parse(readFileSync('data/questions.json','utf8'))});
const routes=module('app/api/gre/route.ts',{'../../chatgpt-auth':{getChatGPTUser:async()=>signedIn},'../../../lib/store':{db:()=>database,isOwner:email=>email==='owner@test.invalid'},'../../../lib/bank':bank,'../../../lib/model':model});
const owner={userId:'test-owner',email:'owner@test.invalid',displayName:'Test Owner'};
const learner={userId:'test-learner',email:'learner@test.invalid',displayName:'Test Learner'};
const stranger={userId:'test-stranger',email:'stranger@test.invalid',displayName:'Test Stranger'};
async function call(who,body,path='',origin='https://test.invalid'){signedIn=who;const r=new Request('https://test.invalid/api/gre'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',Origin:origin}:{},body:body?JSON.stringify(body):undefined});const response=await(body?routes.POST(r):routes.GET(r));return {status:response.status,data:await response.json()}}
test('Complete authenticated approval, practice, grading, persistence and revocation lifecycle',async()=>{
 assert.equal((await call(null)).status,401);
 assert.equal((await call(learner,{action:'start',bank:'B'})).status,403);
 assert.equal((await call(learner,{action:'apply'})).status,200);
 assert.equal((await call(learner,null,'?action=admin')).status,403);
 assert.equal((await call(owner,{action:'review',id:learner.userId,status:'approved'})).status,200);
 assert.equal((await call(learner,{action:'start',bank:'B'},'','https://evil.invalid')).status,403);
 const first=await call(learner,{action:'start',bank:'B'});assert.equal(first.status,200);const s=first.data;
 assert.equal(s.questions.length,15);assert.equal(new Set(s.questions.map(q=>q.id)).size,15);
 for(const q of s.questions)for(const field of ['answers','notes','codexExplanation','issue'])assert.equal(field in q,false,'answer disclosure: '+field);
 assert.equal((await call(learner,{action:'start',bank:'B'})).data.id,s.id);
 assert.equal((await call(learner,{action:'submit',id:s.id,version:0,picks:{}})).status,400);
 await call(stranger,{action:'apply'});await call(owner,{action:'review',id:stranger.userId,status:'approved'});
 assert.equal((await call(stranger,null,'?action=session&id='+s.id)).status,404);
 const picks=Object.fromEntries(s.questions.map(q=>[q.id,bank.questionMap.get(q.id).answers[0]]));
 const save=await call(learner,{action:'save',id:s.id,version:0,picks});assert.equal(save.status,200);
 assert.equal((await call(learner,{action:'save',id:s.id,version:0,picks})).status,409);
 const restored=(await call(learner,null,'?action=session&id='+s.id)).data;assert.deepEqual(restored.picks,picks);assert.equal(restored.startedAt,s.startedAt);
 const submitted=await call(learner,{action:'submit',id:s.id,version:save.data.version,picks});assert.equal(submitted.status,200);assert.equal(submitted.data.score,15);assert.ok(submitted.data.submittedAt>=s.startedAt);
 assert.ok(submitted.data.questions.every(q=>'answers' in q&&'notes' in q));
 const retry=(await call(learner,{action:'submit',id:s.id,version:0,picks:{}})).data;assert.equal(retry.score,15);assert.equal(retry.submittedAt,submitted.data.submittedAt);
 assert.equal((await call(learner)).data.banks.find(b=>b.id==='B').done,15);
 const next=(await call(learner,{action:'start',bank:'B'})).data;assert.ok(next.questions.every(q=>!picks[q.id]));
 for(const b of ['C','D'])assert.equal((await call(learner,{action:'start',bank:b})).data.questions.length,15);
 await call(owner,{action:'review',id:learner.userId,status:'rejected'});
 assert.equal((await call(learner,null,'?action=session&id='+s.id)).status,403);
 assert.equal((await call(learner,{action:'save',id:next.id,version:0,picks:{}})).status,403);
});
test('Each account has independent bank progress, history and session ownership',async()=>{
 const alice={userId:'isolation-alice',email:'alice@test.invalid',displayName:'Alice'};
 const bob={userId:'isolation-bob',email:'bob@test.invalid',displayName:'Bob'};
 for(const user of [alice,bob]){
  await call(user,{action:'apply'});
  await call(owner,{action:'review',id:user.userId,status:'approved'});
 }
 const progress=async user=>(await call(user)).data.banks.map(b=>b.done);
 const finish=async(user,bankId)=>{
  const started=await call(user,{action:'start',bank:bankId});assert.equal(started.status,200);
  const s=started.data;
  const picks=Object.fromEntries(s.questions.map(q=>[q.id,bank.questionMap.get(q.id).answers[0]]));
  assert.equal((await call(user,{action:'submit',id:s.id,version:s.version,picks})).status,200);
  return s;
 };
 const first=await finish(alice,'B');
 assert.deepEqual(await progress(alice),[15,0,0]);
 assert.deepEqual(await progress(bob),[0,0,0]);
 assert.deepEqual((await call(bob)).data.history,[]);
 for(const action of ['save','submit'])assert.equal((await call(bob,{action,id:first.id,version:0,picks:{}})).status,404);
 const bobRound=await finish(bob,'C');
 await finish(alice,'B');
 assert.deepEqual(await progress(alice),[30,0,0]);
 assert.deepEqual(await progress(bob),[0,15,0]);
 const aliceHistory=(await call(alice)).data.history;
 const bobHistory=(await call(bob)).data.history;
 assert.equal(aliceHistory.length,2);
 assert.equal(bobHistory.length,1);assert.equal(bobHistory[0].id,bobRound.id);
 assert.ok(aliceHistory.every(s=>s.id!==bobRound.id));
 assert.equal((await call(alice,null,'?action=session&id='+bobRound.id)).status,404);
});
test('All answer keys satisfy single, multiple and blank-group scoring rules',()=>{
 assert.equal(bank.allQuestions.length,1175);assert.equal(bank.questions.length,1167);
 for(const q of bank.questions){assert.ok(q.stem.includes('_'),q.id);assert.ok(q.notes||q.codexExplanation,q.id);for(const key of q.answers)assert.ok(model.complete(q,key),q.id);assert.equal(model.correct(q,[]),false)}
 const equiv=bank.questions.find(q=>q.kind==='equivalence');assert.equal(model.complete(equiv,[equiv.answers[0][0]]),false);
 const two=bank.questions.find(q=>q.blanks===2);assert.equal(model.complete(two,['A','B']),false);
 const three=bank.questions.find(q=>q.blanks===3);assert.equal(model.complete(three,['A','D']),false);
});
test('Repeated correctly answered questions never inflate unique progress',async()=>{
 const user={userId:'repeat',email:'repeat@test.invalid',displayName:'Repeat'};
 await call(user,{action:'apply'});await call(owner,{action:'review',id:user.userId,status:'approved'});
 let s=(await call(user,{action:'start',bank:'C'})).data;
 let picks=Object.fromEntries(s.questions.map(q=>[q.id,bank.questionMap.get(q.id).answers[0]]));
 await call(user,{action:'submit',id:s.id,version:0,picks});
 const id='repeat-session';sqlite.prepare('INSERT INTO sessions(id,user_id,bank,question_ids,answers,started_at) VALUES(?,?,?,?,?,?)').run(id,user.userId,'C',JSON.stringify(s.questions.map(q=>q.id)),'{}',Date.now());
 await call(user,{action:'submit',id,version:0,picks});
 assert.equal((await call(user)).data.banks.find(b=>b.id==='C').done,15);
});

