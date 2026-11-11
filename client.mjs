import {normalizeAssets,assetSignature,filterAvailableAssets,providerSymbols} from './lib/assets.mjs';
import {attention,ratingContract} from './lib/attention.mjs';
import {defaultProfile,normalizeProfile} from './lib/rules.mjs';
import {read,save} from './lib/storage.mjs';
import {createRestClient,exchangeMetadata} from './lib/network.mjs';
import {LiveFeed} from './lib/live-feed.mjs';
let worker=null,report=null,config=null,exchange=null,availabilityError=null,attentionProfile=defaultProfile();
let job={running:false,progress:[],error:null},live={enabled:true,state:'idle',reason:'Run a scan to start live updates',receivedBytes:0,messages:0,retryAt:0},quotes=new Map(),pending=new Map(),history=[];
let feed=null,feedSignature='',focusBase='',releaseFeed=null,claiming=false,quoteTimer=null,autoTimer=null,lastAuto=0,autoFailures=0,settleScan=null,initialized=false;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('cypher-heirs:workspace-v1'):null;
const emit=(name,detail)=>dispatchEvent(new CustomEvent('cypher-heirs:'+name,{detail}));
const broadcast=data=>channel?.postMessage(data);
function updateLive(state,reason=''){live={...live,state,reason};emit('live');if(releaseFeed)broadcast({type:'feed-state',state,reason,enabled:live.enabled});}
function emitQuotes(){if(quoteTimer)return;quoteTimer=setTimeout(()=>{quoteTimer=null;emit('live');if(releaseFeed)broadcast({type:'quotes',quotes:[...quotes],receivedBytes:live.receivedBytes,messages:live.messages});},1000);}
function receivedQuote(q){const old=quotes.get(q.symbol);if(old?.eventTime>q.eventTime){if(q.candle){quotes.set(q.symbol,{...old,candle:q.candle,candleReceivedAt:Date.now()});emitQuotes();}return;}quotes.set(q.symbol,{...old,...q,receivedAt:Date.now(),candleReceivedAt:q.candle?Date.now():old?.candleReceivedAt,candle:q.candle??old?.candle});emitQuotes();}
function closedCandle(c){const step=({'15m':15,'1h':60,'4h':240}[report?.interval]??60)*60000,known=report?.markets.find(m=>m.mapping?.symbol===c.symbol);if(known&&Date.parse(known.candleCloseAt)>=c.time+step)return;if(!pending.has(c.symbol))pending.set(c.symbol,new Map());pending.get(c.symbol).set(c.time,c.raw);scheduleAuto(1500);}
function needsRefresh(){if(!report||report.imported)return false;const now=Date.now()+(report.clockOffsetMs??0),step=({'15m':15,'1h':60,'4h':240}[report.interval]??60)*60000,target=Math.floor(now/step)*step;return report.assetsChanged||report.counts.error>0||report.markets.some(m=>m.chart?.length&&Date.parse(m.candleCloseAt)<target);}
function symbolsForAuto(){return report?.universe.partial?report.markets.map(m=>m.base).filter(b=>config.assets.some(a=>a.symbol===b&&a.enabled)):undefined;}
function scheduleAuto(delay=1500){if(!live.enabled||report?.imported)return;clearTimeout(autoTimer);autoTimer=setTimeout(()=>{
 if(!live.enabled||document.hidden||navigator.onLine===false||!releaseFeed||!report||job.running)return;
 const earliest=Math.max(live.retryAt??0,lastAuto+Math.min(300000,autoFailures?15000*2**Math.min(autoFailures-1,5):0));
 if(Date.now()<earliest){scheduleAuto(Math.min(60000,earliest-Date.now()+100));return;}
 lastAuto=Date.now();startScan({symbols:symbolsForAuto(),automatic:true});
 },delay);}
function stopFeed(reason='paused'){
 feed?.stop();feed=null;feedSignature='';const release=releaseFeed;releaseFeed=null;release?.();updateLive(reason,reason==='hidden'?'Paused while this tab is hidden':'');
}
function syncFeed(){
 if(!initialized)return;
 if(!live.enabled){stopFeed('off');return;}if(navigator.onLine===false){stopFeed('offline');return;}if(document.hidden){stopFeed('hidden');return;}
 if(!report||report.imported){stopFeed(report?.imported?'replay':'idle');return;}
 if(!navigator.locks||!channel){stopFeed('unavailable');live.reason='Live sharing requires Web Locks and BroadcastChannel support.';return;}
 const markets=report.markets.filter(m=>m.mapping&&m.chart?.length&&config.assets.some(a=>a.symbol===m.base&&a.enabled)),symbols=markets.map(m=>m.mapping.symbol),signature=report.interval+':'+symbols.join(',');
 if(!symbols.length){stopFeed('idle');return;}
 if(releaseFeed){
  if(feedSignature===signature){const focus=markets.find(m=>m.base===focusBase)?.mapping.symbol;feed?.setFocus(focus);return;}
  feed?.stop();feed=null;
  feedSignature=signature;
  feed=new LiveFeed({symbols,interval:report.interval,now:()=>Date.now()+(report?.clockOffsetMs??0),focus:markets.find(m=>m.base===focusBase)?.mapping.symbol,onQuote:receivedQuote,onClose:closedCandle,onStatus:updateLive,onOpen:()=>{if(needsRefresh()||pending.size)scheduleAuto(1000);},onTraffic:bytes=>{live.receivedBytes+=bytes;live.messages++;}});feed.start();return;
 }
 if(claiming)return;claiming=true;
 navigator.locks.request('cypher-heirs:live-owner',{ifAvailable:true},async lock=>{
  if(!lock){updateLive('shared','Following the live connection in another tab');return;}
  await new Promise(resolve=>{releaseFeed=resolve;syncFeed();});
 }).catch(e=>updateLive('unavailable',e.message)).finally(()=>{claiming=false;});
}
function getWorker(){
 if(worker)return worker;worker=new Worker(new URL('./scanner-worker.js?v=cache-live-v1',document.baseURI));
 worker.onmessage=async e=>{const d=e.data;
  if(d.type==='progress'){job={...job,progress:[d.message],done:d.done??job.done,total:d.total??job.total};emit('progress');}
  if(d.type==='metadata'){exchange=d.metadata.data;availabilityError=null;emit('update');}
  if(d.type==='complete'){
   report=d.report;job={running:false,progress:['Scan complete'],error:null};autoFailures=report.counts.error||report.counts.stale?autoFailures+1:0;live.retryAt=0;
   try{if(!report.imported)history=[{asOf:report.asOf,scope:report.markets.map(m=>m.base).join(','),interval:report.interval,metrics:report.metrics},...history].slice(0,6);await save('report',report);if(!report.imported)await save('performance-history',history);}catch{job.warning='Browser storage unavailable; this scan may not survive a reload.';}
   for(const [symbol,rows]of pending){for(const [time]of rows)if(time+({'15m':15,'1h':60,'4h':240}[report.interval]??60)*60000<=Date.parse(report.asOf))rows.delete(time);if(!rows.size)pending.delete(symbol);}
   settleScan?.(true);settleScan=null;emit('complete');broadcast({type:'report'});syncFeed();if(pending.size)scheduleAuto(1500);
  }
  if(d.type==='error'){job={running:false,progress:[],error:d.message};live.retryAt=d.retryAt??0;autoFailures++;settleScan?.(false);settleScan=null;emit('error',d.message);if(live.enabled)scheduleAuto(15000);}
 };
 worker.onerror=e=>{worker?.terminate();worker=null;job={running:false,progress:[],error:e.message||'Browser worker failed'};autoFailures++;settleScan?.(false);settleScan=null;emit('error',job.error);};
 return worker;
}
export async function initialize(){
 config=await read('assets-config')??await(await fetch(new URL('./config.json',document.baseURI))).json();config.assets=normalizeAssets(config.assets);
 attentionProfile=normalizeProfile(await read('attention-profile'));report=await read('report');exchange=await read('exchange-info');history=await read('performance-history')??[];
 live.enabled=(await read('live-enabled'))!==false;initialized=true;
 // Show saved results before any exchange request. Metadata refresh is independent of rendering.
 exchangeMetadata(createRestClient()).then(meta=>{exchange=meta.data;availabilityError=null;emit('update');}).catch(e=>{availabilityError='Availability refresh failed ('+e.message+'). '+(exchange?'Using last verified metadata.':'No availability metadata yet.');emit('update');});
 syncFeed();return currentReport();
}
export function currentReport(){
 if(!report)return null;report.attentionProfile=structuredClone(attentionProfile);report.ratingContract=ratingContract;
 const localNow=Date.now(),now=localNow+(report.clockOffsetMs??0);
 for(const m of report.markets){m.attention=attention(m,report,now);m.interesting=m.attention.interesting;const q=quotes.get(m.mapping?.symbol);m.live=q?{...q,candleFresh:localNow-(q.candleReceivedAt??0)<15000,price:q.price/(m.mapping.scale??1),candle:q.candle?Object.fromEntries(Object.entries(q.candle).map(([k,v])=>[k,['open','high','low','close'].includes(k)?v/(m.mapping.scale??1):v])):null,fresh:live.enabled&&['connected','shared'].includes(live.state)&&localNow-q.receivedAt<15000&&Math.abs(now-q.eventTime)<15000}:null;}
 report.ranked=report.markets.filter(m=>m.attention.fresh&&m.attention.score>0).sort((a,b)=>b.attention.score-a.attention.score||a.base.localeCompare(b.base)).map(m=>m.instrument);
 report.counts.watch=report.markets.filter(m=>m.interesting).length;report.assetsChanged=report.assetsSignature!==assetSignature(config);report.servedAt=new Date().toISOString();report.job=job;
 report.liveSession=liveStatus();report.performanceHistory=history;return report;
}
export function currentConfig(){return config;}
export function assetAvailability(){return {exchange,error:availabilityError,...(exchange?filterAvailableAssets(config,exchange):{available:config.assets,filtered:[]}),symbols:exchange?providerSymbols(config,exchange):[]};}
export function status(){return job;}
export function liveStatus(){return {...live,owner:!!releaseFeed,scope:report?.markets?.length??0};}
export async function setLiveEnabled(enabled){live.enabled=!!enabled;try{await save('live-enabled',live.enabled);}catch{}broadcast({type:'live-setting',enabled:live.enabled});syncFeed();emit('live');}
export function setFocusMarket(base){focusBase=base;if(releaseFeed)syncFeed();else broadcast({type:'focus',base});}
export function startScan({symbols,imported,force=false,automatic=false}={}){
 if(job.running||!config)return Promise.resolve(false);job={running:true,progress:[force?'Rebuilding from exchange…':'Checking cached candles…'],error:null,automatic};emit('progress');
 const execute=async lock=>{
  if(lock===null){job={running:false,progress:[],error:null,warning:'Another tab is scanning. Its completed report will be shared.'};emit('progress');return false;}
  return new Promise(resolve=>{settleScan=resolve;try{getWorker().postMessage({type:'scan',config,symbols,imported,force,previous:report,streamCandles:Object.fromEntries([...pending].map(([s,r])=>[s,[...r.values()]]))});}catch(e){job={running:false,progress:[],error:e.message};settleScan=null;emit('error',e.message);resolve(false);}});
 };
 return (navigator.locks?navigator.locks.request('cypher-heirs:scan',{ifAvailable:true},execute):execute(true)).catch(e=>{job={running:false,progress:[],error:e.message};emit('error',e.message);return false;});
}
export async function saveAssets(rows){if(job.running)throw Error('Wait for the current scan to finish before saving assets.');const next={...config,assets:normalizeAssets(rows),assetsUpdatedDate:new Date().toISOString().slice(0,10)};await save('assets-config',next);config=next;broadcast({type:'preferences'});syncFeed();return config;}
export async function starterAssets(){const builtIn=await(await fetch(new URL('./config.json',document.baseURI))).json();return normalizeAssets(builtIn.assets);}
export async function importCandles(file){if(file.size>30*1024*1024)throw Error('Import limit: 30 MB');const data=JSON.parse(await file.text());if(typeof data.source!=='string'||!data.source.trim()||data.source.length>300||!data.exchangeInfo||!data.candles||!data.asOf)throw Error('Expected {source, asOf, exchangeInfo, candles:{BTC:[Binance kline rows],…}}');startScan({symbols:Object.keys(data.candles),imported:data});}
export function currentAttentionProfile(){return structuredClone(attentionProfile);}
export async function saveAttentionProfile(value){const next=normalizeProfile(value);await save('attention-profile',next);attentionProfile=next;broadcast({type:'preferences'});return currentReport();}
if(channel)channel.onmessage=async e=>{const d=e.data;
 if(d.type==='quotes'&&!releaseFeed){for(const [symbol,q]of d.quotes??[]){const old=quotes.get(symbol);if(!old||old.eventTime<=q.eventTime)quotes.set(symbol,q);}live.receivedBytes=d.receivedBytes;live.messages=d.messages;emit('live');}
 if(d.type==='feed-state'&&!releaseFeed&&live.enabled){live.state=d.state==='connected'?'shared':d.state;live.reason=d.reason;emit('live');}
 if(d.type==='live-setting'){live.enabled=d.enabled;syncFeed();}
 if(d.type==='focus'&&releaseFeed){focusBase=d.base;syncFeed();}
 if(d.type==='report'&&!job.running){report=await read('report')??report;history=await read('performance-history')??history;job={running:false,progress:[],error:null};emit('update');syncFeed();}
 if(d.type==='preferences'){config=await read('assets-config')??config;attentionProfile=normalizeProfile(await read('attention-profile'));emit('update');syncFeed();}
};
if(typeof document!=='undefined'){
 document.addEventListener('visibilitychange',()=>{syncFeed();if(!document.hidden&&live.enabled&&(needsRefresh()||pending.size))scheduleAuto(1000);});
 addEventListener('online',()=>{syncFeed();scheduleAuto(1500);});addEventListener('offline',()=>stopFeed('offline'));addEventListener('pagehide',()=>stopFeed('hidden'));addEventListener('pageshow',()=>syncFeed());
 setInterval(()=>{if(!initialized||document.hidden||!live.enabled)return;syncFeed();if(releaseFeed&&needsRefresh()){const step=({'15m':15,'1h':60,'4h':240}[report.interval]??60)*60000,now=Date.now()+(report.clockOffsetMs??0);if(now%step>5000)scheduleAuto(1000);}},15000);
}
