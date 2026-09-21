import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from './chatgpt-auth';
import {bankInfo} from '../lib/bank';
import Practice from './practice';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Practice signedIn={!!user} signin={chatGPTSignInPath('/')} signout={chatGPTSignOutPath('/')} initialBanks={bankInfo.map(b=>({...b,done:0}))}/>;}

