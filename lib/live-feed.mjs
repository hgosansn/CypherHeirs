import {streamRow} from './candle-cache.mjs';
export function miniQuote(message,now=Date.now()){
 if(message?.e!=='24hrMiniTicker'||message.st===2||!/^[A-Z0-9_]+$/.test(message.s)||!Number.isFinite(+message.E)||+message.E>now+60000||!Number.isFinite(Number(message.c))||!(Number(message.c)>0))return null;
 return {symbol:message.s,price:Number(message.c),eventTime:Number(message.E),receivedAt:now};
}
export class LiveFeed{
 constructor({symbols,interval,focus,onQuote=()=>{},onClose=()=>{},onStatus=()=>{},onOpen=()=>{},onTraffic=()=>{},socketFactory=url=>new WebSocket(url),now=Date.now,random=Math.random}){
  Object.assign(this,{symbols:[...new Set(symbols)].filter(s=>/^[A-Z0-9_]+$/.test(s)),interval,focus,onQuote,onClose,onStatus,onOpen,onTraffic,socketFactory,now,random});this.stopped=true;this.attempt=0;this.events=new Map();this.finals=new Map();
 }
 start(){if(!this.stopped)return;this.stopped=false;this.connect();}
 connect(){
  if(this.stopped)return;if(!this.symbols.length||this.symbols.length+1>1024){this.onStatus('unavailable','No valid stream selection');return;}
  this.focus=this.symbols.includes(this.pendingFocus)?this.pendingFocus:this.symbols.includes(this.focus)?this.focus:this.symbols[0];this.pendingFocus=null;
  const streams=[...this.symbols.map(s=>s.toLowerCase()+'@miniTicker'),this.focus.toLowerCase()+'@kline_'+this.interval];
  this.onStatus(this.attempt?'reconnecting':'connecting');
  const socket=this.socketFactory('wss://fstream.binance.com/market/stream?streams='+streams.join('/'));this.socket=socket;
  socket.onopen=()=>{if(this.stopped||socket!==this.socket)return;this.openedAt=this.now();this.onStatus('connected');this.onOpen();if(this.pendingFocus)this.setFocus(this.pendingFocus);this.rotation=setTimeout(()=>socket.close(),(23*60+55)*60000);};
  socket.onmessage=event=>{
   if(this.stopped||socket!==this.socket||typeof event.data!=='string')return;
   this.onTraffic(new TextEncoder().encode(event.data).length);
   let d;try{d=JSON.parse(event.data);d=d.data??d;}catch{return;}
   if(d.e==='serverShutdown'){socket.close();return;}
   const parsed=streamRow(d,this.interval,this.now()),quote=parsed?{symbol:parsed.symbol,price:parsed.price,eventTime:parsed.eventTime,receivedAt:this.now(),candle:{time:parsed.time,open:+parsed.raw[1],high:+parsed.raw[2],low:+parsed.raw[3],close:+parsed.raw[4],volume:+parsed.raw[5],closed:parsed.closed}}:miniQuote(d,this.now());
   if(!quote||!this.symbols.includes(quote.symbol))return;
   const key=quote.symbol+(parsed?':candle':':price'),old=this.events.get(key);
   if(old&&quote.eventTime<old.eventTime)return;
   if(parsed&&old&&(parsed.time<old.time||parsed.time===old.time&&old.closed&&!parsed.closed))return;
   this.events.set(key,{eventTime:quote.eventTime,time:parsed?.time,closed:parsed?.closed});this.onQuote(quote);
   if(parsed?.closed&&parsed.time>(this.finals.get(parsed.symbol)??-Infinity)){this.finals.set(parsed.symbol,parsed.time);this.onClose(parsed);}
  };
  socket.onerror=()=>{if(!this.stopped&&socket===this.socket)this.onStatus('reconnecting','Connection interrupted');};
  socket.onclose=()=>{
   clearTimeout(this.rotation);if(this.stopped||socket!==this.socket)return;
   if(this.now()-(this.openedAt??0)>30000)this.attempt=0;
   const wait=Math.min(60000,2000*2**Math.min(this.attempt++,5))*(.8+.4*this.random());this.onStatus('reconnecting',`Retrying in ${Math.ceil(wait/1000)}s`);this.retry=setTimeout(()=>this.connect(),wait);
  };
 }
 setFocus(symbol){
  if(!this.symbols.includes(symbol))return;clearTimeout(this.focusTimer);this.pendingFocus=symbol;if(symbol===this.focus){this.pendingFocus=null;return;}
  this.focusTimer=setTimeout(()=>{const next=this.pendingFocus;if(this.stopped||!next||next===this.focus)return;
   if(this.socket?.readyState!==1)return;{const suffix='@kline_'+this.interval;this.socket.send(JSON.stringify({method:'UNSUBSCRIBE',params:[this.focus.toLowerCase()+suffix],id:'focus-off-'+this.now()}));this.socket.send(JSON.stringify({method:'SUBSCRIBE',params:[next.toLowerCase()+suffix],id:'focus-on-'+this.now()}));}
   this.focus=next;this.pendingFocus=null;
  },1000);
 }
 stop(){this.stopped=true;clearTimeout(this.retry);clearTimeout(this.rotation);clearTimeout(this.focusTimer);if(this.socket){this.socket.onclose=null;this.socket.close();}this.socket=null;}
}
