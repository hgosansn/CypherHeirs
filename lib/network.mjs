import {read,save,locked} from './storage.mjs';
export const API='https://fapi.binance.com';
const browserStorage={read,save,locked},fallbacks=new WeakMap();
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function klineWeight(limit){return limit<100?1:limit<500?2:limit<=1000?5:10;}
export function retryAt(response,now=Date.now()){
 const h=response.headers?.get('Retry-After'),seconds=Number(h);return h&&Number.isFinite(seconds)?now+Math.max(0,seconds)*1000:h&&Number.isFinite(Date.parse(h))?Math.max(now,Date.parse(h)):now+(response.status===418?900000:60000);
}
export function newMetrics(){return {requests:0,responseBodyBytes:0,requestWeight:0,candleRequests:0,candlesDownloaded:0,cacheHits:0,analysisReused:0,analysisRuns:0,fetchMs:0,analysisMs:0,queueMs:0};}
export function createRestClient({metrics=newMetrics(),fetchImpl=globalThis.fetch,budget=600,onWait=()=>{},storage=browserStorage}={}){
 const {read:load,save:store,locked:withLock}=storage;let halted=null;const fallback=fallbacks.get(storage)??{};fallbacks.set(storage,fallback);
 async function reserve(weight){
  for(;;){if(halted)throw halted;
   const wait=await withLock('cypher-heirs:rest-budget',async()=>{
    const now=Date.now(),cooldown=await load('binance:cooldown')??fallback.cooldown;if(cooldown?.until>now){const e=Error(`Binance HTTP ${cooldown.status}: requests paused until ${new Date(cooldown.until).toISOString()}`);e.rateLimited=true;e.retryAt=cooldown.until;throw e;}
    const window=Math.floor(now/60000),old=await load('binance:budget')??fallback.budget,used=old?.window===window?old.used:0;
    if(used+weight>budget)return (window+1)*60000-now+100;
    fallback.budget={window,used:used+weight};try{await store('binance:budget',fallback.budget);}catch{}return 0;
   });
   if(!wait)return;onWait(wait);metrics.queueMs+=wait;await sleep(wait);
  }
 }
 return {metrics,storage,setBudget(limit){if(Number.isFinite(limit)&&limit>0)budget=Math.max(1,Math.min(600,Math.floor(limit/2)));},async get(url,weight=1){
  if(!url.startsWith(API+'/'))throw Error('Unexpected data endpoint');await reserve(weight);if(halted)throw halted;
  const t=performance.now();metrics.requests++;metrics.requestWeight+=weight;
  let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(25000),credentials:'omit'});}catch(e){metrics.fetchMs+=performance.now()-t;throw e;}
  if([418,429].includes(response.status)){
   const until=retryAt(response);fallback.cooldown={until,status:response.status};try{await store('binance:cooldown',fallback.cooldown);}catch{}
   const e=Error(`Binance HTTP ${response.status}: requests paused until ${new Date(until).toISOString()}`);e.rateLimited=true;e.retryAt=until;halted=e;throw e;
  }
  const body=await response.text();metrics.responseBodyBytes+=new TextEncoder().encode(body).length;metrics.fetchMs+=performance.now()-t;
  const used=Number(response.headers.get('X-MBX-USED-WEIGHT-1M'));if(Number.isFinite(used)&&used>=budget){try{await withLock('cypher-heirs:rest-budget',async()=>{const old=await load('binance:budget'),window=Math.floor(Date.now()/60000);await store('binance:budget',{window,used:Math.max(old?.window===window?old.used:0,used)});});}catch{}}
  if(!response.ok)throw Error('Data provider returned HTTP '+response.status);
  return JSON.parse(body);
 }};
}
export async function poolMap(items,concurrency,task){
 const result=Array(items.length);let next=0,failure=null;
 await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{while(!failure){const i=next++;if(i>=items.length)return;try{result[i]=await task(items[i],i);}catch(e){failure=e;}}}));
 if(failure)throw failure;return result;
}
export async function exchangeMetadata(rest,force=false){
 const {read:load,save:store,locked:withLock}=rest.storage??{read,save,locked};return withLock('cypher-heirs:metadata',async()=>{
  const old=await load('binance:metadata');if(!force&&old?.data?.symbols?.length&&Date.now()-old.savedAt<21600000)return {...old,cached:true};
  const data=await rest.get(API+'/fapi/v1/exchangeInfo');if(!data.symbols?.length)throw Error('Missing exchange symbol metadata');
  const item={data,savedAt:Date.now()};try{await store('binance:metadata',item);await store('exchange-info',data);}catch{}return item;
 });
}
