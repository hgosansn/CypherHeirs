import {normalizeAssets,assetSignature,filterAvailableAssets,providerSymbols} from './lib/assets.mjs';
import {attention} from './lib/attention.mjs';
let worker=null,report=null,job={running:false,progress:[],error:null},config=null,exchange=null,availabilityError=null;
const DB='levellens-client',store='state';
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(store);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function read(key){try{const db=await database();return await new Promise((resolve,reject)=>{const t=db.transaction(store),r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close();});}catch{return null;}}
async function save(key,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).put(value,key);t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>{db.close();reject(t.error);};});}
export async function initialize(){config=await read('assets-config')??await(await fetch(new URL('./config.json',document.baseURI))).json();config.assets=normalizeAssets(config.assets);report=await read('report');exchange=await read('exchange-info');try{const r=await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo',{signal:AbortSignal.timeout(20000),credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!data.symbols?.length)throw Error('Missing symbol metadata');exchange=data;try{await save('exchange-info',data);}catch{}}catch(e){availabilityError='Could not refresh Binance availability ('+e.message+'). '+(exchange?'Showing the last verified list.':'Showing saved assets without an availability check.');}return currentReport();}
export function currentReport(){if(!report)return null;for(const m of report.markets)m.attention=attention(m,report);report.assetsChanged=report.assetsSignature!==assetSignature(config);report.servedAt=new Date().toISOString();report.job=job;return report;}
export function currentConfig(){return config;}
export function assetAvailability(){return {exchange,error:availabilityError,...(exchange?filterAvailableAssets(config,exchange):{available:config.assets,filtered:[]}),symbols:exchange?providerSymbols(config,exchange):[]};}
export function status(){return job;}
export function startScan({symbols,imported}={}){
 if(job.running)return;job={running:true,progress:['Starting browser worker…'],error:null};
 worker?.terminate();worker=new Worker(new URL('./scanner-worker.js',document.baseURI));
 worker.onmessage=async e=>{const d=e.data;if(d.type==='progress'){job.progress=[d.message];job.done=d.done;job.total=d.total;dispatchEvent(new CustomEvent('cypher-heirs:progress'));}
  if(d.type==='complete'){report=d.report;job={running:false,progress:['Scan complete'],error:null};try{await save('report',report);}catch{job.warning='Browser storage unavailable; export this report to retain it.';}worker.terminate();dispatchEvent(new CustomEvent('cypher-heirs:complete'));}
  if(d.type==='error'){job={running:false,progress:[],error:d.message};worker.terminate();dispatchEvent(new CustomEvent('cypher-heirs:error',{detail:d.message}));}
 };
 worker.onerror=e=>{job={running:false,progress:[],error:e.message||'Browser worker failed'};worker.terminate();dispatchEvent(new CustomEvent('cypher-heirs:error',{detail:job.error}));};
 worker.postMessage({type:'scan',config,symbols,imported});dispatchEvent(new CustomEvent('cypher-heirs:progress'));
}
export async function saveAssets(rows){if(job.running)throw Error('Wait for the current scan to finish before saving assets.');const next={...config,assets:normalizeAssets(rows),assetsUpdatedDate:new Date().toISOString().slice(0,10)};await save('assets-config',next);config=next;return config;}
export async function starterAssets(){const builtIn=await(await fetch(new URL('./config.json',document.baseURI))).json();return normalizeAssets(builtIn.assets);}
export async function importCandles(file){if(file.size>30*1024*1024)throw Error('Import limit: 30 MB');const data=JSON.parse(await file.text());if(typeof data.source!=='string'||!data.source.trim()||data.source.length>300||!data.exchangeInfo||!data.candles||!data.asOf)throw Error('Expected {source, asOf, exchangeInfo, candles:{BTC:[Binance kline rows],…}}');const symbols=Object.keys(data.candles);startScan({symbols,imported:data});}
