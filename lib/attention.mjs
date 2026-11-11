// Editorial attention ordering only. These weights do not alter Pine signals.
export const ratingContract={version:'1.0.0',proximity:60,approach:15,touch:10,signal:15,description:'Distance up to 60 + approaching within 0.5 ATR 15 + last-bar touch within 0.5 ATR 10 + recent signal up to 15 (linear decay over 24h). Not win probability or expected return.'};
export function attention(market,report,now=Date.now()){
 const step=({'15m':15,'1h':60,'4h':240}[report.interval]??60)*60000;
 const fresh=market.status==='ok'&&!market.stale&&Date.parse(market.candleCloseAt)>=Math.floor(now/step)*step;
 const nearest=(market.levels??[]).filter(l=>Number.isFinite(l.distanceATR)).sort((a,b)=>a.distanceATR-b.distanceATR)[0]??null;
 if(!fresh||!nearest)return {score:null,tier:'unrated',fresh,nearest,reasons:[],components:{}};
 const d=nearest.distanceATR,proximity=Math.round(60*Math.max(0,1-d)),approach=d<=.5&&nearest.approaching?15:0,touch=d<=.5&&nearest.touchedLastBar?10:0;
 const age=Math.min(...(market.recentSignals??[]).map(e=>(now-Date.parse(e.confirmedAt))/3600000).filter(h=>h>=0));
 const signal=Number.isFinite(age)?Math.round(15*Math.max(0,1-age/24)):0;
 const score=proximity+approach+touch+signal;
 return {score,tier:score>=75?'focus':score>=50?'watch':score>=25?'observe':'quiet',fresh,nearest,components:{proximity,approach,touch,signal},reasons:[nearest.status==='at-level'?'At a named level':d<=.5?'Near a named level':'Outside attention radius',...(approach?['Closing distance']:[]),...(touch?['Last candle touched']:[]),...(signal?['Recent confirmed signal']:[])]};
}
