import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('資料庫暫時無法使用');return env.DB}
export function isOwner(email:string){return String((env as unknown as {ADMIN_EMAILS?:string}).ADMIN_EMAILS||'').toLowerCase().split(/[;,]/).map(x=>x.trim()).includes(email.toLowerCase())}

