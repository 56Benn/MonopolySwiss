import { useEffect, useRef } from "react";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { board, colours, groups, money, rate, recoveryBonus, startBonus, taxes } from "../game/board";
import { buildBlock, buildPrice, levelName, maxLevel, members, quotedRent, refundShare, rent as liveRent, repayAmount } from "../game/economy";
import type { View } from "../game/view";
import { companyLogo, isSurveyPhoto, siteCaption, sitePhoto } from "./companyLogos";
import { FieldEmblem } from "./FieldTile";
import type { Sender } from "./panels";
import { assetOptions, type PayRequest } from "./Settlement";
import { Spark } from "./Spark";
import { loanDue } from "./HandsetApps";

export const specialRule = (id:number) => id === 0 ? `${money(startBonus)} beim Überqueren, ${money(startBonus*2)} bei direkter Landung. Wer weniger als die Hälfte des durchschnittlichen Nettovermögens besitzt, erhält zusätzlich ${money(recoveryBonus)} Aufbauhilfe.` : taxes[id] ? `Zahlung an die Bank: ${taxes[id].label}, mindestens ${money(board[id].base)}.` : id === 20 ? "Casino: 10M Bonus und Einladung an alle zu einer Runde Blackjack." : id === 30 ? "Direkt ins Gefängnis, ohne START-Bonus." : id === 10 ? "Nur zu Besuch, sofern kein Haftbefehl vorliegt. Wer sitzt, erhält keine Miete." : "Bei Landung wird eine Karte gezogen.";

export function FieldCard({id,v,close,send,pay,trade}:{id:number;v:View|null;close:()=>void;send:Sender;pay:(request:PayRequest)=>void;trade:(owner:string,tile:number)=>void}) {
  const tile=board[id], group=tile.group, asset=v?.assets[id], value=asset?.value ?? tile.base, logo=companyLogo(tile);
  const family=members(id).length, company=group>=0 && group<8, owner=v?.players.find(person=>person.id===asset?.owner);
  const photo=sitePhoto(id), caption=siteCaption(id), heading=useRef<HTMLHeadingElement>(null), closer=useRef(close);
  const previous=asset && asset.history.length>1 ? asset.history.at(-2)! : value, change=previous ? (value/previous-1)*100 : 0;
  const rent=(count:number,level:number)=>money(quotedRent(group,value,count,count===family,level,1,v?.settings.rent??10000));
  const rents = company ? [["Grundmiete",rent(1,0)],["Vollständige Branche",rent(family,0)],...Array.from({length:maxLevel},(_,index)=>[levelName(index+1),rent(family,index+1)])] : group<0 ? [] : Array.from({length:family},(_,index)=>[`${index+1} ${group===8 ? (index ? "Flughäfen" : "Flughafen") : "VC"}`,rent(index+1,0)+(group===9 ? " / Punkt" : "")]);
  const mine=!!v && asset?.owner===v.me, manage=mine && ["roll","debt"].includes(v!.phase) && v!.players[v!.turn].id===v!.me && !v!.tradeUntil;
  const tradeable=members(id).every(other=>!v?.assets[other.id].levels.length);
  const blocked=v && mine && company && v.phase==="roll" ? buildBlock(v,v.me,id) ?? (v.own.cash<buildPrice(value) ? "Nicht genug Geld" : null) : null;
  const current=v && asset?.owner && group!==9 ? liveRent(v,id,7) : null;
  useEffect(()=>{closer.current=close;},[close]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[id]);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")closer.current();};document.addEventListener("keydown",escape);return ()=>document.removeEventListener("keydown",escape);},[]);
  return <section className="field-card" role="dialog" aria-modal="false" aria-label={tile.name}>
    <header><h2 ref={heading} tabIndex={-1}>{tile.name}</h2><button className="icon" title="Schliessen" onClick={close}><X size={18}/></button></header>
    <div className="deed-band" style={{borderColor:colours[group]??"#b99d65"}}>{groups[group]??"Sonderfeld"} · Feld {String(id).padStart(2,"0")}</div>
    <div className="field-card-body">
      {photo && caption ? <figure className="site-figure"><img className="site-photo" src={photo} alt={caption}/><figcaption>{logo && <img className="site-brand" src={logo} alt=""/>}<span>{caption}</span><a href={`/orte/quellen.html#feld-${id}`} target="_blank" rel="noreferrer">{isSurveyPhoto(id) ? "© swisstopo" : "Bildnachweis"}</a></figcaption></figure>
        : <div className="deed-mark">{logo ? <img src={logo} alt={tile.name}/> : <FieldEmblem tile={tile}/>}</div>}
      {group<0 ? <p className="deed-rule">{specialRule(id)}</p> : <>
        <div className="deed-value"><b>{money(value)}</b>{asset && asset.history.length>1 && <><span className={change>=0?"positive":"negative"}>{change>=0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}{change.toLocaleString("de-CH",{maximumFractionDigits:1,signDisplay:"exceptZero"})} %</span><Spark values={asset.history}/></>}</div>
        {current!==null && <p className="deed-current">Aktuelle Miete: <b>{money(current)}</b>{asset!.levels.length ? ` · ${levelName(asset!.levels.length)}` : ""}</p>}
        <div className="deed-caption">Mieten</div><dl>{rents.map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
        <dl className="deed-prices">
          <div><dt>Startwert</dt><dd>{money(tile.base)}</dd></div>
          <div><dt>{asset?.loan ? "Offenes Darlehen" : "Beleihungswert"}</dt><dd>{money(asset?.loan || rate(value,5000))}</dd></div>
          {v && asset?.loan ? <div data-due={loanDue(v,id)?.urgent || undefined}><dt>Rückzahlung</dt><dd>{money(repayAmount(asset.loan))} · {loanDue(v,id)?.text ?? "offen"}</dd></div> : null}
          {company && <div><dt>Ausbau je Stufe</dt><dd>{money(buildPrice(value))}</dd></div>}
          {company && <div><dt>Ausbau</dt><dd>{asset?.levels.length ? levelName(asset.levels.length) : "keiner"}</dd></div>}
          <div><dt>Besitzer</dt><dd>{owner ? `${owner.name}${owner.id===v?.me ? " (du)" : ""}${owner.jail ? " · im Gefängnis" : ""}` : "Bank"}</dd></div>
        </dl>
        {mine && <div className="deed-actions">
          {asset!.levels.length>0 && <small>Stufenverkauf bringt {refundShare/100} % des ursprünglichen Preises, nur bei offener Zahlung.</small>}
          {manage ? <>{assetOptions(v!,id).map(({op,label,amount})=><button key={op} onClick={()=>op==="repay" ? pay({amount,reason:`Tilgung ${tile.short}`,to:"Spielbank",cmd:{type:"ASSET",tile:id,op}}) : send({type:"ASSET",tile:id,op})}>{label} · {money(amount)}</button>)}
            {blocked && <button disabled title={blocked}>Ausbauen · {money(buildPrice(value))}<small>{blocked}</small></button>}</> : <small>Verwaltung im eigenen Zug vor dem Würfeln.</small>}
        </div>}
        {owner && !mine && tradeable && v?.phase==="roll" && !v.players.find(person=>person.id===v.me)?.out && <button className="deed-more" onClick={()=>trade(owner.id,id)}>Handel mit {owner.name} anbieten</button>}
        {owner && !mine && !tradeable && <p className="deed-rule">Ausgebaute Branchen sind nicht handelbar.</p>}
      </>}
    </div>
  </section>;
}