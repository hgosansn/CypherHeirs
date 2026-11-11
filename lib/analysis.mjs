import {prepare} from './reference.mjs';
// PineEngine is supplied by the pinned browser bundle inside a dedicated Worker.

export const intervals={'15m':15,'1h':60,'4h':240};
export function closedBars(raw,asOf,minutes){
 const step=minutes*60000,bars=raw.filter(r=>Number(r[0])+step<=asOf).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5]}));
 for(let i=0;i<bars.length;i++){const b=bars[i];if(!Object.values(b).every(Number.isFinite)||b.time%step||b.open<=0||b.close<=0||b.low<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume<0)throw Error('Invalid candle '+i);if(i&&b.time<=bars[i-1].time)throw Error('Duplicate/out-of-order candle');}
 return bars;
}
export function mapMarket(base,exchange,config){
 const expected=config.scaledBases[base]??base,candidates=config.aliases[base]?.candidates??[expected+'USDT'];
 const s=exchange.symbols.find(s=>candidates.includes(s.symbol)&&s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT'&&s.baseAsset===expected);
 return s?{symbol:s.symbol,baseAsset:s.baseAsset,scale:expected===base?1:1000}:null;
}
export async function runPine(source,bars,minutes,symbol){
 const engine=new globalThis.VelaPinets.PineEngine(),prepared=await engine.prepare(source,'Market brief frozen MSF 11.4.0');let session;
 try{await new Promise((resolve,reject)=>{session=engine.execute({prepared,bars,market:{symbol,timeframe:String(minutes)},mode:'static'},{onModel(){},onDone:resolve,onError:reject});});const c=await session.getContext(['plots','warnings','barIndex']);if(c.barIndex!==bars.length-1||c.warnings?.length)throw Error('Pine execution incomplete or warned: '+JSON.stringify(c.warnings));return c;}finally{session?.stop();}
}
export function analyze(bars,config,pine,asOf){
 const minutes=intervals[config.interval],step=minutes*60000;
 if(bars.length<250)throw Error('Insufficient history: need at least 250 closed bars');
 const ctx=prepare(bars,minutes),i=bars.length-1,b=bars[i],c=ctx[i],scale=config.scale??1;
 const value=(name,j=i)=>{const n=pine.plots[name]?.[j]?.value;return Number.isFinite(n)?n:null;};
 const expectedClose=Math.floor(asOf/step)*step,stale=b.time+step<expectedClose;
 const gaps=bars.slice(1).flatMap((x,j)=>x.time!==bars[j].time+step?[{after:bars[j].time,before:x.time}]:[]);
 const levels=c.levels.map(l=>{
  const distance=Math.abs(b.close-l.price),atrDistance=c.atr>0?distance/c.atr:null,old=bars[Math.max(0,i-config.approachLookback)];
  const approaching=distance<Math.abs(old.close-l.price); // Same frozen reference at both endpoints; descriptive only.
  const touched=b.low<=l.price&&b.high>=l.price;
  return {...l,price:l.price/scale,knownAt:new Date(l.knownAt).toISOString(),distancePercent:100*distance/b.close,distanceATR:atrDistance,approaching,touchedLastBar:touched,status:atrDistance===null?'unavailable':atrDistance<=config.atLevelATR?'at-level':atrDistance<=config.nearLevelATR?(approaching?'approaching':'near-level'):'away'};
 }).sort((a,z)=>(a.distanceATR??Infinity)-(z.distanceATR??Infinity)||a.id.localeCompare(z.id));
 const events=bars.flatMap((bar,j)=>{const entry=value('Entry',j);if(entry===null||bar.time+step<asOf-config.recentSignalHours*3600000)return [];return [{confirmedAt:new Date(bar.time+step).toISOString(),direction:value('Signal side',j)===1?'LONG':'SHORT',family:value('Family R1 C2',j)===1?'R':'C',entryReference:entry/scale,invalidation:value('Invalidation',j)/scale,level:value('Reaction level at entry',j)/scale,trigger:value('Structure trigger at entry',j)/scale}];});
 const pivot=(kind)=>{for(let j=i;j>=0;j--){const p=ctx[j][kind];if(p)return {price:p.price/scale,origin:new Date(bars[p.origin].time).toISOString(),confirmedAt:new Date(bars[p.confirmed].time+step).toISOString()};}return null;};
 return {candleCloseAt:new Date(b.time+step).toISOString(),price:b.close/scale,stale,gaps,historyBars:bars.length,historyFrom:new Date(bars[0].time).toISOString(),atr:c.atr/scale,structure:['bearish','neutral','bullish'][c.trend+1],defended:Number.isFinite(c.defended)?c.defended/scale:null,confirmedSwingHigh:pivot('ph'),confirmedSwingLow:pivot('pl'),rsi14:value('Ribbon RSI 14'),ema50:value('EMA 50')/scale,ema200:value('EMA 200')/scale,armedDirection:value('Armed direction'),recentSignals:events,levels,nearestAbove:levels.filter(l=>l.price>b.close/scale).sort((a,z)=>a.price-z.price)[0]??null,nearestBelow:levels.filter(l=>l.price<b.close/scale).sort((a,z)=>z.price-a.price)[0]??null,interesting:!stale&&levels.some(l=>['at-level','approaching','near-level'].includes(l.status)),levelTiming:'Known before the last closed candle opened, as used by the frozen strategy; VWAP uses preceding-close moments.'};
}
