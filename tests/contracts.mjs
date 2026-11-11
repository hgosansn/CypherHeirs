import './attention.mjs';
import './data-pipeline.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepare} from '../lib/reference.mjs';
import {closedBars,mapMarket} from '../lib/analysis.mjs';
import {attention} from '../lib/attention.mjs';
import {normalizeAssets,assetSignature,filterAvailableAssets,providerSymbols} from '../lib/assets.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,root),'utf8');
const start=Date.parse('2026-09-07'),bars=Array.from({length:1000},(_,i)=>{const open=100+8*Math.sin(i/15),close=100+8*Math.sin((i+1)/15);return {time:start+i*3600000,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:1000+i};});
const ctx=prepare(bars,60),last=bars.at(-1),day=Math.floor(last.time/86400000)*86400000,previous=bars.filter(b=>b.time>=day-86400000&&b.time<day);
assert.equal(ctx.at(-1).levels.find(l=>l.id==='PDH').price,Math.max(...previous.map(b=>b.high)));
assert.equal(ctx.at(-1).levels.find(l=>l.id==='PDL').price,Math.min(...previous.map(b=>b.low)));
assert.ok(!prepare(bars.filter(b=>b.time!==day-3600000),60).at(-1).levels.some(l=>l.id==='PDH'));
const raw=bars.slice(-2).map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume]);assert.equal(closedBars(raw,last.time+1,60).length,1);assert.throws(()=>closedBars([raw[0],raw[0]],last.time+3600000,60),/Duplicate/);
const config=JSON.parse(await read('config.json'));assert.equal(mapMarket('BTC',{symbols:[]},config),null);
assert.equal(config.assets.length,74);assert.ok(config.assets.every(a=>!('kind' in a)));
assert.equal(normalizeAssets([{symbol:' btc ',enabled:true}])[0].symbol,'BTC');
assert.throws(()=>normalizeAssets([{symbol:'BTC'},{symbol:'btc'}]),/Duplicate/);
assert.throws(()=>normalizeAssets([{symbol:''}]),/symbol/);
assert.throws(()=>normalizeAssets([{symbol:'BTC',enabled:false}]),/Enable/);
assert.deepEqual(normalizeAssets([{symbol:'BTC',kind:'old-category',enabled:true}]),[{symbol:'BTC',enabled:true}]);
const metadata={symbols:[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',contractType:'PERPETUAL',status:'TRADING'},{symbol:'1000PEPEUSDT',baseAsset:'1000PEPE',quoteAsset:'USDT',contractType:'PERPETUAL',status:'TRADING'},{symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',contractType:'PERPETUAL',status:'BREAK'},{symbol:'GOLDUSDT',baseAsset:'GOLD',quoteAsset:'USDT',contractType:'CURRENT_QUARTER',status:'TRADING'}]};
const availability=filterAvailableAssets({...config,assets:[{symbol:'BTC'},{symbol:'PEPE'},{symbol:'ETH'},{symbol:'GOLD'}]},metadata);assert.deepEqual(availability.available.map(a=>a.symbol),['BTC','PEPE']);assert.deepEqual(availability.filtered.map(a=>a.symbol),['ETH','GOLD']);assert.deepEqual(providerSymbols(config,metadata),['BTC','PEPE']);
const modified={...config,assets:config.assets.map(a=>a.symbol==='ETH'?{...a,enabled:false}:a)};assert.notEqual(assetSignature(modified),assetSignature(config));

const now=Date.parse('2026-11-11T12:30:00Z'),market={status:'ok',candleCloseAt:'2026-11-11T12:00:00Z',levels:[{id:'PDH',distanceATR:.1,approaching:true,touchedLastBar:true,status:'at-level'}],recentSignals:[]};assert.equal(attention(market,{interval:'1h'},now).score,79);assert.equal(attention({...market,candleCloseAt:'2026-11-11T11:00:00Z'},{interval:'1h'},now).score,null);
const scope={console,Intl,TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,performance,setTimeout,clearTimeout,structuredClone};scope.window=scope;vm.createContext(scope);vm.runInContext(await read('vendor/vela.global.min.js'),scope);vm.runInContext(await read('vendor/vela-pinets.global.min.js'),scope);
async function run(src,input){const e=new scope.VelaPinets.PineEngine(),prepared=await e.prepare(src,'Static contracts');let session;try{await new Promise((resolve,reject)=>{session=e.execute({prepared,bars:input,market:{symbol:'TESTUSDT',timeframe:'60'},mode:'static'},{onModel(){},onDone:resolve,onError:reject});});const result=await session.getContext(['plots','warnings']);assert.ok(!result.warnings?.length);return result;}finally{session?.stop();}}
const indicatorSource=await read('strategy/indicator.pine'),strategySource=await read('strategy/strategy.pine');assert.equal(createHash('sha256').update(indicatorSource).digest('hex'),'45b23badc27b09a588dc05693d7a7ae9249d4d2c04c95ebc16016671022e645a');
const indicator=await run(indicatorSource,bars),strategy=await run(strategySource,bars),prefix=await run(indicatorSource,bars.slice(0,700));
for(const [name,plot]of Object.entries(indicator.plots)){assert.deepEqual(plot,strategy.plots[name],name+' companion parity');assert.deepEqual(prefix.plots[name],plot.slice(0,700),name+' prefix stability');}
for(const file of ['index.html','dashboard.html','src/landing.tsx','src/App.tsx','client.mjs','scanner-worker.js']){const text=await read(file);assert.ok(!/fetch\(['"]\/api\//.test(text),'No app API in '+file);assert.ok(!/(?:src|href)=["']\/(?!\/)/.test(text),'Relative project paths in '+file);}
console.log('PASS: synthetic period completeness, candles, mappings, editable asset validation, attention freshness, immutable Pine source, browser-bundle indicator/strategy parity, prefix stability, and static paths.');
