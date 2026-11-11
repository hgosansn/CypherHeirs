import {mapMarket} from './analysis.mjs';
export function normalizeAssets(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>200)throw Error('Use between 1 and 200 assets.');
 const seen=new Set(),assets=rows.map((row,i)=>{
  const symbol=String(row.symbol??'').trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9&]{0,23}$/.test(symbol))throw Error(`Row ${i+1}: use an asset symbol such as BTC, ETH or S&P500.`);
  if(seen.has(symbol))throw Error(`Duplicate asset: ${symbol}`);seen.add(symbol);
  return {symbol,enabled:row.enabled!==false};
 });
 if(!assets.some(a=>a.enabled))throw Error('Enable at least one asset to scan.');
 return assets;
}
export const assetSignature=config=>JSON.stringify(normalizeAssets(config.assets));
export function filterAvailableAssets(config,exchange){const assets=normalizeAssets(config.assets);return {available:assets.filter(a=>mapMarket(a.symbol,exchange,config)),filtered:assets.filter(a=>!mapMarket(a.symbol,exchange,config))};}
export function providerSymbols(config,exchange){const scaled=Object.fromEntries(Object.entries(config.scaledBases??{}).map(([base,contract])=>[contract,base]));return [...new Set(exchange.symbols.filter(s=>s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT').map(s=>scaled[s.baseAsset]??s.baseAsset))].filter(symbol=>mapMarket(symbol,exchange,config)).sort();}
