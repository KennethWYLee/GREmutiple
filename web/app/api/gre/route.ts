import {getChatGPTUser} from '../../chatgpt-auth';
import {db,isOwner} from '../../../lib/store';
import {allQuestions,bankInfo,questions,questionMap,publicQuestion} from '../../../lib/bank';
import {complete,correct,type Picks} from '../../../lib/model';
export const dynamic='force-dynamic';
type Member={id:string;email:string;name:string;status:string};
type Session={id:string;user_id:string;bank:string;question_ids:string;answers:string;version:number;started_at:number;submitted_at:number|null;score:number|null};
class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
async function identity(){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'請先登入。');const owner=isOwner(user.email);
 if(owner)await db().prepare("INSERT INTO members(id,email,name,status,created_at) VALUES(?,?,?,'approved',?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,status='approved'").bind(user.userId,user.email,user.displayName,Date.now()).run();
 const member=await db().prepare('SELECT * FROM members WHERE id=?').bind(user.userId).first<Member>();
 return {user,member,owner};}
function requireApproved(member:Member|null){if(member?.status!=='approved')throw new HttpError(403,'此帳號尚未獲准使用題庫。')}
async function ownSession(id:unknown,userId:string){if(typeof id!=='string')throw new HttpError(400,'缺少練習編號。');const s=await db().prepare('SELECT * FROM sessions WHERE id=? AND user_id=?').bind(id,userId).first<Session>();if(!s)throw new HttpError(404,'找不到這回練習。');return s}
function present(s:Session){const picks=JSON.parse(s.answers) as Picks;return {id:s.id,bank:s.bank,version:s.version,startedAt:s.started_at,submittedAt:s.submitted_at,score:s.score,picks,questions:(JSON.parse(s.question_ids) as string[]).map(id=>{const q=questionMap.get(id)!;return s.submitted_at?{...publicQuestion(q),answers:q.answers,notes:q.notes,codexExplanation:q.codexExplanation,disputed:q.disputed,correct:correct(q,picks[id]||[])}:publicQuestion(q)})}}
function validatePicks(s:Session,input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'答案格式不正確。');const ids=JSON.parse(s.question_ids) as string[];const out:Picks={};for(const [id,value] of Object.entries(input)){const q=questionMap.get(id);if(!ids.includes(id)||!q||!Array.isArray(value)||value.some(x=>typeof x!=='string'||!q.options.some(o=>o.id===x))||new Set(value).size!==value.length)throw new HttpError(400,'答案含有無效的題目或選項。');if(value.length>(q.kind==='equivalence'?2:q.blanks))throw new HttpError(400,'選項數量超過限制。');out[id]=[...value].sort()}return out}
async function status(userId:string){const rows=await db().prepare('SELECT bank,COUNT(DISTINCT question_id) AS done FROM attempts WHERE user_id=? AND answered=1 GROUP BY bank').bind(userId).all<{bank:string;done:number}>();return bankInfo.map(b=>({...b,done:rows.results.find(r=>r.bank===b.id)?.done||0}))}
async function handle(request:Request,write=false){try{if(write){if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'請從網站本身操作。');if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'請使用 JSON。')}
 const {user,member,owner}=await identity();
 if(!write){const action=new URL(request.url).searchParams.get('action')||'state';
  if(action==='state'){const allowed=member?.status==='approved';const history=allowed?(await db().prepare('SELECT id,bank,started_at,submitted_at,score FROM sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 15').bind(user.userId).all()).results:[];return json({user:{name:user.displayName,email:user.email,owner,status:member?.status||'new'},banks:allowed?await status(user.userId):bankInfo.map(b=>({...b,done:0})),history})}
  requireApproved(member);
  if(action==='session')return json(present(await ownSession(new URL(request.url).searchParams.get('id'),user.userId)));
  if(action==='admin'){if(!owner)throw new HttpError(403,'僅限管理員。');const members=(await db().prepare('SELECT id,email,name,status,created_at,reviewed_at FROM members ORDER BY created_at DESC').all()).results;return json({members:members.map(m=>({...m,owner:isOwner(String(m.email))})),quarantined:allQuestions.filter(q=>!q.valid).map(q=>({id:q.id,section:q.section,number:q.number,page:q.page,answers:q.answers,bank:q.bank,issue:q.issue}))})}
  throw new HttpError(404,'找不到此操作。');
 }
 const raw=await request.text();if(raw.length>64000)throw new HttpError(413,'資料過大。');let body;try{body=JSON.parse(raw)}catch{throw new HttpError(400,'資料格式不正確。')}
 if(body.action==='apply'){if(member?.status==='rejected')throw new HttpError(403,'申請未獲核准，請聯絡管理員。');await db().prepare("INSERT INTO members(id,email,name,status,created_at) VALUES(?,?,?,'pending',?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name").bind(user.userId,user.email,user.displayName,Date.now()).run();return json({ok:true})}
 requireApproved(member);
 if(body.action==='review'){if(!owner)throw new HttpError(403,'僅限管理員。');if(!['approved','rejected','pending'].includes(body.status)||typeof body.id!=='string')throw new HttpError(400,'無效的審核狀態。');const target=await db().prepare('SELECT * FROM members WHERE id=?').bind(body.id).first<Member>();if(!target)throw new HttpError(404,'找不到申請。');if(isOwner(target.email))throw new HttpError(400,'不能更改管理員權限。');await db().prepare('UPDATE members SET status=?,reviewed_at=? WHERE id=?').bind(body.status,Date.now(),body.id).run();return json({ok:true})}
 if(body.action==='start'){if(!['B','C','D'].includes(body.bank))throw new HttpError(400,'請選擇 B、C 或 D 題庫。');let active=await db().prepare('SELECT * FROM sessions WHERE user_id=? AND bank=? AND submitted_at IS NULL').bind(user.userId,body.bank).first<Session>();if(active)return json(present(active));
  const prior=await db().prepare('SELECT DISTINCT question_id FROM attempts WHERE user_id=? AND bank=? AND answered=1').bind(user.userId,body.bank).all<{question_id:string}>();const seen=new Set(prior.results.map(r=>r.question_id));const pool=questions.filter(q=>q.bank===body.bank);const shuffle=<T,>(a:T[])=>{for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
  const ids=[...shuffle(pool.filter(q=>!seen.has(q.id))),...shuffle(pool.filter(q=>seen.has(q.id)))].slice(0,15).map(q=>q.id);if(ids.length!==15)throw new HttpError(503,'可用題目不足 15 題。');
  const id=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO sessions(id,user_id,bank,question_ids,answers,started_at) VALUES(?,?,?,?,'{}',?)").bind(id,user.userId,body.bank,JSON.stringify(ids),Date.now()).run();active=await db().prepare('SELECT * FROM sessions WHERE user_id=? AND bank=? AND submitted_at IS NULL').bind(user.userId,body.bank).first<Session>();return json(present(active!))}
 if(['save','submit'].includes(body.action)){const s=await ownSession(body.id,user.userId);if(s.submitted_at){if(body.action==='submit')return json(present(s));throw new HttpError(409,'這回已交卷。')}
  if(body.version!==s.version)throw new HttpError(409,'另一個視窗已更新此回，請重新載入後再操作。');const picks=validatePicks(s,body.picks);
  if(body.action==='save'){const result=await db().prepare('UPDATE sessions SET answers=?,version=version+1 WHERE id=? AND user_id=? AND version=? AND submitted_at IS NULL').bind(JSON.stringify(picks),s.id,user.userId,s.version).run();if(!result.meta.changes)throw new HttpError(409,'這回已更新，請重新載入。');return json({version:s.version+1})}
  const qs=(JSON.parse(s.question_ids) as string[]).map(id=>questionMap.get(id)!);
  if(!qs.every(q=>complete(q,picks[q.id]||[])))throw new HttpError(400,'請完成全部 15 題後再交卷。');
  const at=Date.now();const score=qs.filter(q=>correct(q,picks[q.id])).length;
  // D1 batch is atomic. A conditional update wins once; subsequent inserts key off its unique submission timestamp.
  const statements=[db().prepare('UPDATE sessions SET answers=?,version=version+1,submitted_at=?,score=? WHERE id=? AND user_id=? AND version=? AND submitted_at IS NULL').bind(JSON.stringify(picks),at,score,s.id,user.userId,s.version),...qs.map(q=>db().prepare('INSERT OR IGNORE INTO attempts(session_id,user_id,question_id,bank,correct,answered) SELECT ?,?,?,?,?,1 WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND submitted_at=? AND version=?)').bind(s.id,user.userId,q.id,s.bank,correct(q,picks[q.id])?1:0,s.id,at,s.version+1))];
  const result=await db().batch(statements);if(!result[0].meta.changes)throw new HttpError(409,'這回已更新或交卷，請重新載入。');return json(present(await ownSession(s.id,user.userId)))}
 throw new HttpError(400,'無效的操作。');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('GRE request failed',e);return json({error:'暫時無法儲存或載入。你的畫面答案仍保留，請稍後重試。'},503)}}
export const GET=(request:Request)=>handle(request);
export const POST=(request:Request)=>handle(request,true);

