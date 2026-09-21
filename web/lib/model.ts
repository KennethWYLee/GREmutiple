export type BankId='B'|'C'|'D';
export type Question={id:string;bank:BankId;section:string;number:number;page:number;stem:string;options:{id:string;text:string}[];kind:'equivalence'|'completion';blanks:number;answers:string[][];notes:string;disputed:boolean;valid:boolean;codexExplanation?:string;issue?:string;editorialNote?:string};
export type PublicQuestion=Omit<Question,'answers'|'notes'|'valid'|'disputed'|'codexExplanation'|'issue'>;
export type Picks=Record<string,string[]>;
export function complete(q:Pick<Question,'kind'|'blanks'|'options'>,a:string[]){if(new Set(a).size!==a.length||a.some(x=>!q.options.some(o=>o.id===x)))return false;if(q.kind==='equivalence')return a.length===2;if(q.blanks===1)return a.length===1;return a.length===q.blanks&&['ABC','DEF','GHI'].slice(0,q.blanks).every(g=>a.filter(x=>g.includes(x)).length===1)}
export function correct(q:Question,a:string[]){return complete(q,a)&&q.answers.some(key=>[...key].sort().join('')===[...a].sort().join(''))}
export function choose(q:PublicQuestion,current:string[],option:string){if(q.kind==='equivalence')return current.includes(option)?current.filter(x=>x!==option):current.length<2?[...current,option]:current;if(q.blanks===1)return [option];const group=['ABC','DEF','GHI'].find(g=>g.includes(option))!;return [...current.filter(x=>!group.includes(x)),option].sort()}

