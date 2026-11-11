import {defaultProfile,normalizeProfile,levelCatalog,signalKey} from './rules.mjs';
export const ratingContract={version:'2.0.0',description:'Strongest enabled level + strongest enabled signal; rounded, capped at 100. Editable attention, not probability.'};
export function attention(market,report,now=Date.now(),settings=report.attentionProfile??defaultProfile()){
 const p=normalizeProfile(settings),step=({'15m':15,'1h':60,'4h':240}[report.interval]??60)*60000;
 const fresh=market.status==='ok'&&!market.stale&&Date.parse(market.candleCloseAt)>=Math.floor(now/step)*step&&Date.parse(market.candleCloseAt)<=now;
 const components={proximity:0,approach:0,touch:0,signal:0},details=[];
 const activeSignals=(market.recentSignals??[]).filter(e=>{const h=(now-Date.parse(e.confirmedAt))/3600000;return p.signals[signalKey(e)]?.enabled&&h>=0&&h<=p.signalHours;});
 const activeLevels=(market.levels??[]).filter(l=>levelCatalog.some(c=>c.id===l.id)&&p.levels[l.id]?.enabled&&Number.isFinite(l.distanceATR)&&l.distanceATR>=0).map(l=>{
  const d=l.distanceATR,chart=market.chart??[],old=chart.at(-1-p.approachBars),last=chart.at(-1),approaching=last&&old?Math.abs(last.close-l.price)<Math.abs(old.close-l.price):p.approachBars===(report.config?.approachLookback??3)&&!!l.approaching;
  const status=d<=p.atATR?'at-level':d<=p.nearATR?(approaching?'approaching':'near-level'):'away';
  const factors={proximity:Math.max(0,1-d/p.radiusATR),approach:d<=p.nearATR&&approaching?1:0,touch:d<=p.nearATR&&l.touchedLastBar?1:0};
  const multiplier=p.levels[l.id].weight/100,points={};for(const key of Object.keys(factors))points[key]=p.components[key].enabled?Math.round(p.components[key].weight*factors[key]*multiplier):0;
  return {...l,status,approaching,points,factors,multiplier,total:Object.values(points).reduce((s,v)=>s+v,0)};
 }).sort((a,b)=>a.distanceATR-b.distanceATR||a.id.localeCompare(b.id));
 const nearest=activeLevels[0]??null,bestLevel=[...activeLevels].sort((a,b)=>b.total-a.total||a.distanceATR-b.distanceATR||a.id.localeCompare(b.id))[0]??null;
 const signalCandidates=activeSignals.map(e=>{const age=(now-Date.parse(e.confirmedAt))/3600000,factor=Math.max(0,1-age/p.signalHours),multiplier=p.signals[signalKey(e)].weight/100;return {...e,age,factor,multiplier,points:p.components.signal.enabled?Math.round(p.components.signal.weight*factor*multiplier):0};}).sort((a,b)=>b.points-a.points||a.age-b.age);
 const bestSignal=signalCandidates[0]??null;
 if(bestLevel)for(const k of ['proximity','approach','touch'])components[k]=bestLevel.points[k];components.signal=bestSignal?.points??0;
 for(const k of ['proximity','approach','touch'])details.push({key:k,enabled:p.components[k].enabled,weight:p.components[k].weight,factor:bestLevel?.factors[k]??0,multiplier:bestLevel?.multiplier??0,points:fresh?components[k]:null,source:bestLevel?.id??'No enabled level available'});
 details.push({key:'signal',enabled:p.components.signal.enabled,weight:p.components.signal.weight,factor:bestSignal?.factor??0,multiplier:bestSignal?.multiplier??0,points:fresh?components.signal:null,source:bestSignal?`${bestSignal.family} ${bestSignal.direction} · ${bestSignal.age.toFixed(1)}h old`:'No enabled signal in the lookback'});
 const rawScore=Object.values(components).reduce((s,v)=>s+v,0),hasRules=Object.values(p.components).some(c=>c.enabled&&c.weight>0),score=fresh?Math.min(100,rawScore):null;
 const tier=score===null?'unrated':!hasRules?'off':score>=p.focus?'focus':score>=p.watch?'watch':score>=p.observe?'observe':'quiet';
 return {score,rawScore:fresh?rawScore:null,tier,fresh,nearest,bestLevel,bestSignal,activeLevels,activeSignals,details,components:fresh?components:{},hasRules,interesting:fresh&&score>0&&score>=p.watch,reasons:!fresh?['Outdated or unavailable candles; no current score']:!hasRules?['All weighted attention rules are disabled']:[...details.filter(d=>d.points>0).map(d=>`${d.source}: ${d.key} +${d.points}`),...(rawScore>100?['Capped at 100']:[])]};
}
