import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { board } from "../game/board";
import type { View } from "../game/view";
import type { Sender } from "./panels";
import { boardIdentity } from "./boardIdentity";

export function BoardStamp() {
  return <div className="board-stamp" aria-label="Swiss Market, Bourse helvétique">
    <svg viewBox="-1.95 -1.95 3.75 1.7" aria-hidden="true" fill="none" stroke={boardIdentity.brass}>{boardIdentity.ridges.map((ridge,index) => <polyline key={index} points={ridge.map(point => point.join(",")).join(" ")} strokeWidth={index ? .028 : .055}/>)}</svg>
    <span>SWISS</span><strong>MARKET</strong><small>Bourse helvétique</small>
  </div>;
}

export function BoardFeed({v, send}: {v: View | null; send: Sender}) {
  const [chatOnly, setChatOnly] = useState(false), [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null), follow = useRef(true);
  const publicChat = (v?.chat ?? []).filter(entry => !entry.to);
  const lines = [...(!chatOnly ? (v?.events ?? []).map(entry => ({key:`e${entry.seq}`, time:entry.time, name:entry.kind, text:entry.text, chat:false})) : []), ...publicChat.map(entry => ({key:`c${entry.id}`,time:entry.time,name:entry.name,text:entry.text,chat:true}))].sort((a,b) => a.time-b.time);
  const last = lines.at(-1)?.key;
  useEffect(() => { if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [last, chatOnly]);
  const current = v?.players[v.turn];
  if (!v) return <section className="felt-preview" aria-label="Brettmitte"><BoardStamp/><footer><span>40 Felder</span><i/> <span>{board.filter(tile=>tile.group>=0).length} Besitzfelder</span><i/><span>Werte in CHF</span></footer></section>;
  return <section className="board-feed" aria-label="Brettmitte">
    <div className="feed-seal" aria-hidden="true"><BoardStamp/></div>
    <header><div><small>{v.phase !== "lobby" ? `RUNDE ${v.round}` : "SWISS MARKET"}</small><strong>{v.phase === "lobby" ? "Deine Lobby" : v.phase === "over" ? "Spielende" : v.paused ? "Spielpause" : `${current?.name} am Zug`}</strong></div>
      <button className="feed-filter" aria-pressed={chatOnly} onClick={() => {follow.current=true; setChatOnly(!chatOnly);}}><MessageSquare size={13}/>Nur Chat</button>
    </header>
    <div className="feed-lines" role="log" aria-label={chatOnly ? "Öffentlicher Tischchat" : "Öffentlicher Tischverlauf"} ref={list} onScroll={event => {const node=event.currentTarget; follow.current=node.scrollHeight-node.clientHeight-node.scrollTop<18;}}>
      {lines.length ? lines.map(line => <p key={line.key}><b data-chat={line.chat}>{line.name}</b> {line.text}</p>) : <p className="feed-empty">{chatOnly ? "Noch keine Nachrichten." : "Noch keine Spielzüge."}</p>}
    </div>
    <form onSubmit={event => {event.preventDefault(); const message=text.trim(); if(message){send({type:"CHAT",text:message});setText("");follow.current=true;}}}>
      <input maxLength={300} aria-label="Nachricht an alle am Tisch" placeholder="Nachricht an den Tisch …" value={text} onChange={event=>setText(event.target.value)} />
      <button title="An den Tisch senden" disabled={!text.trim()}><Send size={15}/><span>Senden</span></button>
    </form>
  </section>;
}