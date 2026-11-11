// Extracted unchanged prepare/clocks/pivot reference from audited MSF 11.4.0.
import {gt,lt,ge,le,priceRound} from './price.mjs';
const windows=[['Asia','Asia/Tokyo',540,660],['London','Europe/London',480,600],['NY','America/New_York',570,690]];
const fmts=windows.map(([,zone])=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
export function clocks(t,step){return windows.map(([name,zone,start,end],k)=>{const p=Object.fromEntries(fmts[k].formatToParts(t).filter(x=>x.type!=='literal').map(x=>[x.type,x.value])),m=+p.hour*60+(+p.minute),date=p.year+'-'+p.month+'-'+p.day,id=name+':'+date,endTime=t+(end-m)*60000,startTime=t+(start-m)*60000;return {name,zone,id,startTime,endTime,inside:m>=start&&m+step/60000<=end,atStart:m===start};});}
export function pivot(bars,i,kind){if(i<8)return null;const j=i-4,v=bars[j][kind];for(let k=i-8;k<=i;k++){if(kind==='high'?(k>j?ge(bars[k].high,v):gt(bars[k].high,v)):(k>j?le(bars[k].low,v):lt(bars[k].low,v)))return null;}return {price:v,origin:j,confirmed:i,id:kind+':'+j};}
export function prepare(bars,minutes){const step=minutes*60000,rows=[];let sh=null,sl=null,hc=false,lc=false,trend=0,defended=null,atr=null,trSum=0,day=null,week=null,dr=null,wr=null,pd=null,pw=null,wopen=null,v=0,mean=0,m2=0,volComplete=false;const ranges=[null,null,null],prior=[null,null,null];
 for(let i=0;i<bars.length;i++){
  const b=bars[i],prev=bars[i-1],continuous=!prev||b.time===prev.time+step,d=Math.floor(b.time/86400000)*86400000,w=Math.floor((b.time+259200000)/604800000)*604800000-259200000,cs=clocks(b.time,step);
  if(d!==day){pd=dr?.complete&&dr.lastClose===d&&day===d-86400000?{high:dr.high,low:dr.low,knownAt:day+86400000}:null;day=d;dr={high:-Infinity,low:Infinity,complete:b.time===d};}else if(!continuous)dr.complete=false;
  if(w!==week){pw=wr?.complete&&wr.lastClose===w&&week===w-604800000?{high:wr.high,low:wr.low,knownAt:week+604800000}:null;week=w;wr={high:-Infinity,low:Infinity,complete:b.time===w};wopen=b.time===w?b.open:null;v=mean=m2=0;volComplete=b.time===w;}else if(!continuous){wr.complete=false;volComplete=false;}
  const levels=[],add=(id,family,price,knownAt)=>{if(Number.isFinite(price))levels.push({id,family,price,knownAt});};
  if(pd){add('PDH','day',pd.high,pd.knownAt);add('PDL','day',pd.low,pd.knownAt);}if(pw){add('PWH','week',pw.high,pw.knownAt);add('PWL','week',pw.low,pw.knownAt);}add('Weekly Open','weekly-open',wopen,week);
  for(let k=0;k<3;k++){
   const c=cs[k],r=ranges[k];
   if(r&&b.time>=r.endTime){prior[k]=r.complete&&r.lastClose===r.endTime?{high:r.high,low:r.low,knownAt:r.endTime,cycle:r.id}:null;ranges[k]=null;}
   const expectedEnd=b.time>=c.endTime?c.endTime:clocks(b.time-86400000,step)[k].endTime;if(prior[k]&&prior[k].knownAt!==expectedEnd)prior[k]=null;
   if(prior[k]){add(c.name+' ORH',c.name+'-range',prior[k].high,prior[k].knownAt);add(c.name+' ORL',c.name+'-range',prior[k].low,prior[k].knownAt);}
  }
  if(volComplete&&v>0&&b.time!==week){const sd=Math.sqrt(Math.max(0,m2/v));for(const [s,n]of [[0,'W-VWAP'],[-1,'W-VWAP -1sigma'],[1,'W-VWAP +1sigma'],[-2,'W-VWAP -2sigma'],[2,'W-VWAP +2sigma']])add(n,'vwap',mean+s*sd,prev.time+step);}
  const before={sh,sl,hc,lc,trend,defended},ph=pivot(bars,i,'high'),pl=pivot(bars,i,'low');
  if((trend===1&&lt(b.close,defended))||(trend===-1&&gt(b.close,defended))){trend=0;defended=null;}
  if(ph){sh=ph;hc=false;}if(pl){sl=pl;lc=false;}
  if(!hc&&sh&&sl&&gt(b.close,sh.price)&&gt(b.close,sl.price)){defended=trend===1?Math.max(defended,sl.price):sl.price;trend=1;hc=true;}else if(!lc&&sl&&sh&&lt(b.close,sl.price)&&lt(b.close,sh.price)){defended=trend===-1?Math.min(defended,sh.price):sh.price;trend=-1;lc=true;}
  const tr=prev?Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)):b.high-b.low,previousAtr=atr;trSum+=tr;if(i===13)atr=trSum/14;else if(i>13)atr=(atr*13+tr)/14;
  rows.push({before,trend,defended,ph,pl,atr,previousAtr,levels,session:cs.filter(c=>c.inside).sort((a,b)=>a.endTime-b.endTime)[0]??null});
  dr.lastClose=b.time+step;wr.lastClose=b.time+step;dr.high=Math.max(dr.high,b.high);dr.low=Math.min(dr.low,b.low);wr.high=Math.max(wr.high,b.high);wr.low=Math.min(wr.low,b.low);
  if(!(b.volume>0))volComplete=false;else{const weight=b.volume,p=(b.high+b.low+b.close)/3,delta=p-mean,next=v+weight;mean+=weight/next*delta;m2+=weight*delta*(p-mean);v=next;}
  for(let k=0;k<3;k++)if(cs[k].inside){const c=cs[k];if(!ranges[k]||ranges[k].id!==c.id)ranges[k]={...c,high:b.high,low:b.low,lastClose:b.time+step,complete:c.atStart};else{const r=ranges[k];r.complete&&=r.lastClose===b.time;r.high=Math.max(r.high,b.high);r.low=Math.min(r.low,b.low);r.lastClose=b.time+step;}}
 }
 return rows;
}
