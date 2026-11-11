// Dedicated classic Worker: all network requests and Pine execution stay client-side.
self.window=self;
importScripts('./vendor/vela.global.min.js','./vendor/vela-pinets.global.min.js');
const modules=Promise.all([import('./lib/analysis.mjs'),import('./lib/attention.mjs'),import('./lib/assets.mjs')]);
let busy=false;
const send=(type,data)=>postMessage({type,...data});
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),credentials:'omit'});if(!r.ok){const e=Error(`Data provider returned HTTP ${r.status}`);e.rateLimited=[418,429].includes(r.status);throw e;}return r.json();}
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function scan({config,symbols,imported}){
 const [{closedBars,mapMarket,runPine,analyze,intervals},{attention,ratingContract},{normalizeAssets,assetSignature,filterAvailableAssets}]=await modules;
 const api='https://fapi.binance.com',minutes=intervals[config.interval];if(!minutes)throw Error('Unsupported interval');
 const source=await(await fetch(new URL('./strategy/indicator.pine',self.location.href))).text();
 let asOf,exchange;if(imported){asOf=Date.parse(imported.asOf);if(!Number.isFinite(asOf)||asOf>Date.now()+60000)throw Error('Imported asOf must be a valid past UTC timestamp');exchange=imported.exchangeInfo;}else{try{asOf=(await get(api+'/fapi/v1/time')).serverTime;exchange=await get(api+'/fapi/v1/exchangeInfo');}catch(e){throw Error('Browser cannot access Binance futures data. Regional restrictions, connectivity or browser policy may apply. No proxy or spot substitution is used. You can import a saved candle package. '+e.message);}}
 if(!exchange?.symbols?.length)throw Error('Missing exchange symbol metadata');
 const assets=normalizeAssets(config.assets),all=assets.filter(a=>a.enabled).map(a=>a.symbol),requested=symbols?.length?symbols:all;
 const availability=filterAvailableAssets(config,exchange),eligible=new Set(availability.available.map(a=>a.symbol)),selected=requested.filter(s=>eligible.has(s)),excludedAssets=requested.filter(s=>!eligible.has(s));
 if(requested.some(s=>!all.includes(s)))throw Error('A requested market is outside the enabled asset list');
 if(!selected.length)throw Error('No enabled assets are available as active Binance USDT perpetuals.');
 const rows=[];
 for(let i=0;i<selected.length;i++){
  const base=selected[i],instrument=config.aliases[base]?.label??base+'USD',mapping=mapMarket(base,exchange,config);
  send('progress',{message:`${i+1}/${selected.length} · ${instrument} · calculating closed candles`,done:i,total:selected.length});
  if(!mapping){rows.push({base,instrument,status:'unmapped',reason:'No exact active Binance USDT perpetual match'});continue;}
  try{
   const url=api+`/fapi/v1/klines?symbol=${mapping.symbol}&interval=${config.interval}&limit=${config.lookbackBars}&endTime=${asOf}`;
   const raw=imported?imported.candles?.[base]:await get(url);if(!Array.isArray(raw))throw Error('No candles for '+base);
   const bars=closedBars(raw,asOf,minutes),pine=await runPine(source,bars,minutes,mapping.symbol),result=analyze(bars,{...config,scale:mapping.scale},pine,asOf);
   rows.push({base,instrument,mapping,status:result.stale?'stale':'ok',...result,chart:bars.slice(-Math.ceil(120*60/minutes)).map(b=>({...b,open:b.open/mapping.scale,high:b.high/mapping.scale,low:b.low/mapping.scale,close:b.close/mapping.scale})),evidence:{url:imported?'Browser-imported candle package':url,rawSha256:await hash(JSON.stringify(raw)),rawCandles:raw}});
  }catch(e){rows.push({base,instrument,mapping,status:'error',reason:e.message});if(e.rateLimited)throw Error('Exchange rate limit reached. Wait before retrying; the previous saved report is retained.');}
 }
 if(!rows.some(r=>r.status==='ok'||r.status==='stale'))throw Error('No markets could be analyzed. The previous saved report is retained.');
 const report={schemaVersion:4,excludedAssets,assetsSignature:assetSignature(config),asOf:new Date(asOf).toISOString(),servedAt:new Date().toISOString(),interval:config.interval,config,universe:{source:'Browser-local asset list',verifiedDate:config.assetsUpdatedDate,scope:'User-configured assets; no broker eligibility implied',mode:'Editable browser-local list',partial:!!symbols?.length},strategy:{path:'strategy/indicator.pine',sha256:await hash(source),execution:'Unchanged MSF 11.4.0 Pine indicator in browser Worker'},ratingContract,job:{running:false,progress:[],error:null},markets:rows,clientOnly:true,imported:!!imported,importSource:imported?.source??null};
 for(const m of rows)m.attention=attention(m,report);
 const ranked=rows.filter(m=>m.attention.fresh).sort((a,b)=>b.attention.score-a.attention.score||a.base.localeCompare(b.base));
 report.ranked=ranked.map(m=>m.instrument);report.counts={configured:requested.length,filtered:excludedAssets.length,requested:rows.length,ok:rows.filter(m=>m.status==='ok').length,watch:rows.filter(m=>m.status==='ok'&&m.interesting).length,error:rows.filter(m=>m.status==='error').length,unmapped:rows.filter(m=>m.status==='unmapped').length,unsupported:rows.filter(m=>m.status==='unsupported').length,stale:rows.filter(m=>m.status==='stale').length};
 return report;
}
self.onmessage=async e=>{if(e.data.type!=='scan'||busy)return;busy=true;try{send('complete',{report:await scan(e.data)});}catch(error){send('error',{message:error.message});}finally{busy=false;}};
