import {useEffect,useRef,useState,type ReactNode} from "react";
import {ArrowRight, Building2, Check, ChevronsRight} from "lucide-react";
import {motion} from "motion/react";
import {board,M,money,rate} from "../game/board";
import {members,buildPrice,buildBlock,refundShare} from "../game/economy";
import type {View} from "../game/view";
import type {Command} from "../game/model";
import type {Sender} from "./panels";
import {Yield} from "./Yield";
import {companyLogo} from "./companyLogos";

export function assetOptions(v:View,id:number){
  const asset=v.assets[id],group=members(id),own=group.filter(tile=>v.assets[tile.id].owner===v.me),levels=asset.levels.length;
  const developed=own.some(tile=>v.assets[tile.id].levels.length>0),build=buildPrice(asset.value),repay=rate(asset.loan,11000);
  const turn=v.players[v.turn].id===v.me && !v.tradeUntil,paying=turn && v.phase==="debt" && !!v.debt && !v.debt.purchase,managing=turn && v.phase==="roll";
  return ([
    {op:"build",label:"Ausbauen",amount:build,ok:managing && !buildBlock(v,v.me,id) && v.own.cash>=build},
    {op:"reduce",label:"Stufe verkaufen",amount:rate(asset.levels.at(-1)??0,refundShare),ok:paying && levels>0 && (v.settings.even===false || own.every(tile=>v.assets[tile.id].levels.length<=levels))},
    {op:"repay",label:"Darlehen tilgen",amount:repay,ok:managing && asset.loan>0 && repay<=v.own.cash},
    {op:"loan",label:"Beleihen",amount:rate(asset.value,5000),ok:(managing || paying) && !developed && !asset.loan},
    {op:"sell",label:"An Bank verkaufen",amount:rate(asset.value,6000)-asset.loan,ok:paying && !developed && rate(asset.value,6000)>asset.loan}
  ] as const).filter(action=>action.ok);
}
export type PayRequest = { amount: number; reason: string; to: string; cmd: Command };
export type Receipt = { amount: number; reason: string; to: string };
export function PurchaseOffer({v,send}:{v:View;send:Sender}) {
  const tile=board[v.players[v.turn].pos],value=v.assets[tile.id].value,logo=companyLogo(tile);
  const coupon=v.own.cards.includes("C22"),discounted=value-Math.min(10*M,rate(value,1500)),short=v.own.cash<value;
  return <div className="field-decision"><section role="dialog" aria-label="Kaufentscheidung" className="purchase-slip"><small>KAUFENTSCHEIDUNG · FELD {tile.id}</small><header>{logo ? <img src={logo} alt=""/> : <Building2/>}<h2>{tile.name}</h2></header><Yield id={tile.id} v={v}/>
    {short && <p className="cash-warning" role="status">Nicht genug Geld: Du hast {money(v.own.cash)}, der Kauf kostet {money(value)}.</p>}
    <button className="primary wide" disabled={short} onClick={()=>send({type:"BUY_COMPANY"})}>Kaufen · {money(value)}</button>
    {coupon && <button className="wide" disabled={v.own.cash<discounted} onClick={()=>send({type:"BUY_COMPANY",coupon:true})}>Mit Gutschein kaufen · {money(discounted)}</button>}
    <button className="wide" onClick={()=>send({type:"DECLINE"})}>Passen</button></section></div>;
}
export function SwipePay({onPay,disabled}:{onPay:()=>void;disabled?:boolean}) {
  const track=useRef<HTMLDivElement>(null),start=useRef(0),done=useRef(false);
  const [x,setX]=useState(0),[drag,setDrag]=useState(false);
  const max=()=>Math.max(1,(track.current?.clientWidth??0)-56);
  const finish=()=>{if(done.current)return;done.current=true;setX(max());onPay();};
  const share=Math.round(x/max()*100);
  return <div className="swipe-pay">
    <span className="swipe-label">Zum Zahlen nach rechts wischen</span>
    <div className="swipe-track" ref={track} data-disabled={!!disabled}>
      <i className="swipe-fill" style={{width:x+52}}/>
      <span className="swipe-hint" aria-hidden="true">Überweisen <ChevronsRight size={17}/></span>
      <button type="button" className="swipe-knob" role="slider" aria-label="Überweisung bestätigen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} disabled={disabled} data-dragging={drag}
        style={{transform:`translateX(${x}px)`,transition:drag?"none":"transform .35s ease"}}
        onPointerDown={event=>{if(disabled || done.current)return;event.currentTarget.setPointerCapture(event.pointerId);start.current=event.clientX-x;setDrag(true);}}
        onPointerMove={event=>{if(drag)setX(Math.min(max(),Math.max(0,event.clientX-start.current)));}}
        onPointerUp={()=>{if(!drag)return;setDrag(false);if(x>=max()*.92)finish();else setX(0);}}
        onPointerCancel={()=>{setDrag(false);if(!done.current)setX(0);}}
        onKeyDown={event=>{if(disabled || done.current)return;if(event.key==="ArrowRight"||event.key==="End"){event.preventDefault();const next=event.key==="End"?max():Math.min(max(),x+max()/5);setX(next);if(next>=max()*.92)finish();}else if(event.key==="ArrowLeft"||event.key==="Home"){event.preventDefault();setX(event.key==="Home"?0:Math.max(0,x-max()/5));}}}>
        <ArrowRight size={20}/>
      </button>
    </div>
  </div>;
}
function Countdown({until}:{until:number}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return ()=>clearInterval(timer);},[]);return <span className="bill-clock" role="timer">Frist {Math.max(0,Math.ceil((until-now)/1000))} s</span>;}
function Transfer({kicker,amount,reason,to,available,onPay,disabled,until,children}:{kicker:string;amount:number;reason:string;to:string;available:number;onPay:()=>void;disabled?:boolean;until?:number;children?:ReactNode}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  return <section className="device-screen bank-sheet">
    <small>{kicker}{until ? <Countdown until={until}/> : null}</small><h2 ref={heading} tabIndex={-1}>Banküberweisung</h2>
    <b className="bill-total">{money(amount)} CHF</b><dl className="facts"><div><dt>Zweck</dt><dd>{reason}</dd></div><div><dt>Empfänger</dt><dd>{to}</dd></div><div><dt>Verfügbar</dt><dd>{money(available)} CHF</dd></div></dl>
    <SwipePay onPay={onPay} disabled={disabled}/>
    {children}
  </section>;
}
export function BankSettlement({v,send,paid}:{v:View;send:Sender;paid:(receipt:Receipt)=>void}) {
  const bill=v.debt!,shortfall=bill.amount-v.own.cash,finance=shortfall>0,to=v.players.find(person=>person.id===bill.to)?.name??"Spielbank";
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(finance)heading.current?.focus({preventScroll:true});},[finance]);
  if(!finance) return <Transfer kicker={bill.purchase?"KAUFPREIS":"ZAHLUNGSAUFTRAG"} amount={bill.amount} reason={bill.reason} to={to} available={v.own.cash} until={v.deadline} disabled={v.paused} onPay={()=>{send({type:"CONFIRM_PAYMENT"});paid({amount:bill.amount,reason:bill.reason,to});}}>{bill.purchase && <button className="wide" onClick={()=>send({type:"DECLINE"})}>Kauf abbrechen</button>}</Transfer>;
  return <section className="device-screen bank-sheet">
    <small>LIQUIDITÄT <Countdown until={v.deadline}/></small><h2 ref={heading} tabIndex={-1}>Finanzierung</h2>
    <b className="bill-total">{money(bill.amount)} CHF</b><dl className="facts"><div><dt>Zweck</dt><dd>{bill.reason}</dd></div><div><dt>Empfänger</dt><dd>{to}</dd></div><div><dt>Verfügbar</dt><dd>{money(v.own.cash)} CHF</dd></div></dl>
    <p className="shortfall">Es fehlen <strong>{money(shortfall)} CHF</strong>. Wähle, womit du Geld beschaffst.</p>
    {board.filter(tile=>v.assets[tile.id].owner===v.me).map(tile=>{const options=assetOptions(v,tile.id);return options.length ? <div key={tile.id} className="finance-row"><strong>{tile.short}</strong>{options.map(action=><button key={action.op} onClick={()=>send({type:"ASSET",tile:tile.id,op:action.op})}>{action.label} · +{money(action.amount)}</button>)}</div> : null;})}
    {!v.assets.some(asset=>asset.owner===v.me) && <p>Kein Besitz zur Finanzierung verfügbar. Ohne Deckung folgt bei Fristende der Konkurs.</p>}
    {bill.purchase && <button className="wide" onClick={()=>send({type:"DECLINE"})}>Kauf abbrechen</button>}
  </section>;
}
export function TransferSheet({request,v,send,paid,cancel}:{request:PayRequest;v:View;send:Sender;paid:(receipt:Receipt)=>void;cancel:()=>void}) {
  const short=request.amount>v.own.cash;
  return <Transfer kicker="ZAHLUNGSAUFTRAG" amount={request.amount} reason={request.reason} to={request.to} available={v.own.cash} disabled={short || v.paused} onPay={()=>{send(request.cmd);paid({amount:request.amount,reason:request.reason,to:request.to});}}>
    {short && <p className="shortfall">Dein Guthaben reicht dafür nicht.</p>}
    <button className="wide" onClick={cancel}>Abbrechen</button>
  </Transfer>;
}
export function PaidScreen({receipt}:{receipt:Receipt}) {
  return <section className="device-screen paid-screen" role="status">
    <motion.span className="paid-check" initial={{scale:.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:260,damping:16}}><Check size={44}/></motion.span>
    <h2>Zahlung ausgeführt</h2>
    <b>{money(receipt.amount)} CHF</b>
    <p>{receipt.reason}<br/>an {receipt.to}</p>
  </section>;
}