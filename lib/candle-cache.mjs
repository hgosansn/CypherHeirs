import {closedBars} from './analysis.mjs';
import {API,klineWeight} from './network.mjs';
export const cacheKey=(symbol,interval,size)=>`candles:v1:${symbol}:${interval}:${size}`;
export function mergeRows(...sets){const rows=new Map();for(const set of sets)for(const row of set??[])rows.set(Number(row[0]),row);return [...rows.values()].sort((a,b)=>+a[0]-+b[0]);}
export function completeRows(raw,asOf,minutes,size){closedBars(raw,asOf,minutes);return raw.filter(r=>Number(r[0])+minutes*60000<=asOf).slice(-size);}
export function contiguous(raw,step){return raw.every((r,i)=>!i||Number(r[0])===Number(raw[i-1][0])+step);}
export function validCache(cache,{symbol,interval,size,asOf,minutes}){try{return cache?.version===1&&cache.source==='binance-usdm'&&cache.symbol===symbol&&cache.interval===interval&&cache.size===size&&Array.isArray(cache.raw)&&cache.raw.length>0&&cache.raw.length<=size&&completeRows(cache.raw,asOf,minutes,size).length===cache.raw.length&&contiguous(cache.raw,minutes*60000);}catch{return false;}}
// Keep the former rolling window: 1,000 requested bars included the forming bar, so 999 completed bars.
export async function candleWindow({symbol,interval,minutes,lookbackBars,asOf,cache,streamRows=[],rest,force=false}){
 const size=lookbackBars-1,step=minutes*60000,target=Math.floor(asOf/step)*step,urls=[];
 const query=async(params)=>{const url=API+'/fapi/v1/klines?'+new URLSearchParams({symbol,interval,...params});urls.push(url);const raw=await rest.get(url,klineWeight(Number(params.limit)));if(!Array.isArray(raw))throw Error('Invalid candle response');rest.metrics.candleRequests++;rest.metrics.candlesDownloaded+=raw.length;completeRows(raw,asOf,minutes,size);return raw;};
 const cold=async()=>{const raw=await query({limit:lookbackBars,endTime:asOf});return {raw:completeRows(raw,asOf,minutes,size),mode:'full',urls,size};};
 if(force||!validCache(cache,{symbol,interval,size,asOf,minutes}))return cold();
 let raw=completeRows(mergeRows(cache.raw,streamRows),asOf,minutes,size);if(!contiguous(raw,step))raw=completeRows(cache.raw,asOf,minutes,size);
 if(+raw.at(-1)[0]+step===target){rest.metrics.cacheHits++;return {raw,mode:streamRows.length?'stream':'cache',urls,size};}
 if(target-(+raw.at(-1)[0]+step)>size*step)return cold();
 // One overlap candle verifies the last REST snapshot while backfilling every missing close.
 const start=+raw.at(-1)[0],needed=Math.ceil((target-start)/step),limit=Math.min(lookbackBars,needed+1);
 const delta=await query({startTime:start,endTime:asOf,limit});raw=completeRows(mergeRows(raw,delta),asOf,minutes,size);
 if(!contiguous(raw,step))return cold();
 return {raw,mode:'delta',urls,size};
}
export function seedFromReport(previous,base,symbol,interval,size){
 if(!previous||previous.imported||previous.interval!==interval||!previous.clientOnly)return null;
 const market=previous.markets?.find(m=>m.base===base&&m.mapping?.symbol===symbol);
 if(!market?.evidence?.url?.startsWith(API+'/fapi/v1/klines?'))return null;
 try{return {version:1,source:'binance-usdm',symbol,interval,size,raw:completeRows(market.evidence.rawCandles,Date.parse(previous.asOf),({'15m':15,'1h':60,'4h':240})[interval],size)};}catch{return null;}
}
export function streamRow(message,interval,now=Date.now()){
 const k=message?.k;if(message?.e!=='kline'||!k||k.i!==interval||typeof k.x!=='boolean'||message.st===2)return null;
 const step=({'15m':15,'1h':60,'4h':240})[interval]*60000;
 if(!step||!Number.isFinite(+message.E)||+message.E>now+60000||!Number.isFinite(+k.t)||+k.t>now+60000||+k.T!==+k.t+step-1)return null;
 const raw=[+k.t,k.o,k.h,k.l,k.c,k.v,+k.T,k.q,k.n,k.V,k.Q,k.B??'0'];
 try{closedBars([raw],+k.t+step,step/60000);}catch{return null;}
 if(!/^[A-Z0-9_]+$/.test(k.s)||k.s!==message.s)return null;
 if(k.x&&+k.T>now+1000)return null;
 return {symbol:k.s,eventTime:+message.E,closed:k.x,raw,price:Number(k.c),time:+k.t};
}
