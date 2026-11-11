import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
export async function prepareRuntime(){await fs.mkdir(new URL('.runtime-static/',root),{recursive:true});for(const file of ['config.json','scanner-worker.js','lib','vendor','licenses','strategy','universe-source.json','THIRD_PARTY_NOTICES.md','LICENSE','LICENSE-MPL-2.0.txt','.nojekyll'])await fs.cp(new URL(file,root),new URL('.runtime-static/'+file,root),{recursive:true,force:true});}
