// Persistent classic Worker. Downloads are bounded; confirmed Pine execution stays serial.
self.window=self;
importScripts('./vendor/vela.global.min.js','./vendor/vela-pinets.global.min.js');
const modules=Promise.all([import('./lib/analysis.mjs'),import('./lib/attention.mjs'),import('./lib/assets.mjs'),import('./lib/storage.mjs'),import('./lib/network.mjs'),import('./lib/candle-cache.mjs')]);
let busy=false,sourcePromise=null;
const send=(type,data)=>postMessage({type,...data});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function scan({config,symbols,imported,previous,streamCandles={},force=false}){
 const started=performance.now();
 const [{closedBars,mapMarket,runPine,analyze,intervals},{attention,ratingContract},{normalizeAssets,assetSignature,filterAvailableAssets},{read,save},{API,createRestClient,newMetrics,poolMap,exchangeMetadata},{cacheKey,candleWindow,seedFromReport,completeRows}]=await modules;
 const minutes=intervals[config.interval];if(!minutes)throw Error('Unsupported interval');
 const metrics=newMetrics(),rest=createRestClient({metrics,onWait:ms=>send('progress',{message:`Respecting request budget · waiting ${Math.ceil(ms/1000)}s`})});
 sourcePromise??=fetch(new URL('./strategy/indicator.pine',self.location.href)).then(r=>{if(!r.ok)throw Error('Indicator source unavailable');return r.text();}).catch(e=>{sourcePromise=null;throw e;});const source=await sourcePromise,sourceHash=await hash(source);let clockOffsetMs=0;
 let asOf,exchange;
 if(imported){asOf=Date.parse(imported.asOf);if(!Number.isFinite(asOf)||asOf>Date.now()+60000)throw Error('Imported asOf must be a valid past UTC timestamp');exchange=imported.exchangeInfo;}
 else{asOf=(await rest.get(API+'/fapi/v1/time')).serverTime;clockOffsetMs=asOf-Date.now();const metadata=await exchangeMetadata(rest,force);exchange=metadata.data;rest.setBudget(exchange.rateLimits?.find(r=>r.rateLimitType==='REQUEST_WEIGHT'&&r.interval==='MINUTE'&&r.intervalNum===1)?.limit);send('metadata',{metadata});}
 if(!exchange?.symbols?.length)throw Error('Missing exchange symbol metadata');
 const assets=normalizeAssets(config.assets),all=assets.filter(a=>a.enabled).map(a=>a.symbol),requested=symbols?.length?symbols:all;
 if(requested.some(s=>!all.includes(s)))throw Error('A requested market is outside the enabled asset list');
 const availability=filterAvailableAssets(config,exchange),eligible=new Set(availability.available.map(a=>a.symbol)),selected=requested.filter(s=>eligible.has(s)),excludedAssets=requested.filter(s=>!eligible.has(s));
 if(!selected.length)throw Error('No enabled assets are available as active Binance USDT perpetuals.');
 let downloaded=0;const downloadStart=performance.now();
 const inputs=await poolMap(selected,4,async base=>{
  const instrument=config.aliases[base]?.label??base+'USD',mapping=mapMarket(base,exchange,config),size=config.lookbackBars-1,key=cacheKey(mapping.symbol,config.interval,size);
  try{
   let cache=imported?null:await read(key);if(!cache&&!imported)cache=seedFromReport(previous,base,mapping.symbol,config.interval,size);
   const window=imported?{raw:completeRows(imported.candles?.[base]??[],asOf,minutes,Number.MAX_SAFE_INTEGER),mode:'import',urls:[],size}:await candleWindow({symbol:mapping.symbol,interval:config.interval,minutes,lookbackBars:config.lookbackBars,asOf,cache,streamRows:streamCandles[mapping.symbol]??[],rest,force});
   downloaded++;send('progress',{message:`Fetched ${downloaded}/${selected.length} · ${base} · ${window.mode}`,done:0,total:selected.length});
   return {base,instrument,mapping,key,cache,window};
  }catch(e){if(e.rateLimited)throw e;downloaded++;return {base,instrument,mapping,error:e.message};}
 });
 metrics.downloadPhaseMs=performance.now()-downloadStart;
 const rows=[];let storageWarning=false;
 for(let i=0;i<inputs.length;i++){
  const input=inputs[i],{base,instrument,mapping,key,cache,window}=input;
  send('progress',{message:`Analyzing ${i+1}/${inputs.length} · ${instrument}`,done:i,total:inputs.length});
  if(input.error){rows.push({base,instrument,mapping,status:'error',reason:input.error});continue;}
  try{
   const {raw}=window,bars=closedBars(raw,asOf,minutes),rawSha256=await hash(JSON.stringify(raw));
   const analysisKey=await hash(JSON.stringify(['analysis-v1',sourceHash,bars,mapping.symbol,minutes,mapping.scale,config.approachLookback,config.atLevelATR,config.nearLevelATR,config.recentSignalHours]));
   let result;
   const analysisStart=performance.now();
   if(!force&&!imported&&cache?.analysisKey===analysisKey&&cache.result&&cache.resultHash===await hash(JSON.stringify(cache.result))){result=structuredClone(cache.result);result.recentSignals=result.recentSignals.filter(e=>Date.parse(e.confirmedAt)>=asOf-config.recentSignalHours*3600000);metrics.analysisReused++;}
   else{const pine=await runPine(source,bars,minutes,mapping.symbol);result=analyze(bars,{...config,scale:mapping.scale},pine,asOf);metrics.analysisRuns++;}
   metrics.analysisMs+=performance.now()-analysisStart;
   result.stale=Date.parse(result.candleCloseAt)<Math.floor(asOf/(minutes*60000))*minutes*60000;
   const row={base,instrument,mapping,status:result.stale?'stale':'ok',...result,chart:bars.slice(-Math.ceil(120*60/minutes)).map(b=>({...b,open:b.open/mapping.scale,high:b.high/mapping.scale,low:b.low/mapping.scale,close:b.close/mapping.scale})),evidence:{url:imported?'Browser-imported candle package':window.urls.at(-1)??'Binance USD-M confirmed candle cache',urls:window.urls,mode:window.mode,rawSha256,analysisKey,rawCandles:raw}};
   rows.push(row);
   if(!imported){try{await save(key,{version:1,source:'binance-usdm',symbol:mapping.symbol,interval:config.interval,size:window.size,raw,result,resultHash:await hash(JSON.stringify(result)),analysisKey,savedAt:Date.now()});}catch{storageWarning=true;}}
  }catch(e){rows.push({base,instrument,mapping,status:'error',reason:e.message});}
 }
 if(!rows.some(r=>r.status==='ok'||r.status==='stale'))throw Error('No markets could be analyzed. The previous saved report is retained.');
 metrics.elapsedMs=performance.now()-started;metrics.concurrency=4;metrics.byteDefinition='Decoded UTF-8 REST response bodies; excludes HTTP/TLS overhead, static assets and WebSocket traffic.';
 const report={schemaVersion:5,clockOffsetMs,excludedAssets,assetsSignature:assetSignature(config),asOf:new Date(asOf).toISOString(),servedAt:new Date().toISOString(),interval:config.interval,config,universe:{source:'Browser-local asset list',verifiedDate:config.assetsUpdatedDate,scope:'User-configured assets; no broker eligibility implied',mode:'Editable browser-local list',partial:!!symbols?.length},strategy:{path:'strategy/indicator.pine',sha256:sourceHash,execution:'Unchanged MSF 11.4.0 indicator; full replay for changed inputs, exact result reuse for identical inputs'},ratingContract,job:{running:false,progress:[],error:null},markets:rows,clientOnly:true,imported:!!imported,importSource:imported?.source??null,metrics,storageWarning};
 for(const m of rows)m.attention=attention(m,report);
 report.ranked=rows.filter(m=>m.attention.fresh&&m.attention.score>0).sort((a,b)=>b.attention.score-a.attention.score||a.base.localeCompare(b.base)).map(m=>m.instrument);
 report.counts={configured:requested.length,filtered:excludedAssets.length,requested:rows.length,ok:rows.filter(m=>m.status==='ok').length,watch:rows.filter(m=>m.attention.interesting).length,error:rows.filter(m=>m.status==='error').length,unmapped:0,unsupported:0,stale:rows.filter(m=>m.status==='stale').length};
 return report;
}
self.onmessage=async e=>{if(e.data.type!=='scan'||busy)return;busy=true;try{send('complete',{report:await scan(e.data)});}catch(error){send('error',{message:error.message,retryAt:error.retryAt??null});}finally{busy=false;}};
