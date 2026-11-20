import {useEffect,useRef,useState} from "react";
import {Camera} from "lucide-react";
import {makePortrait} from "./portrait";

export function PortraitCamera({select,report}:{select:(photo:string)=>void;report:(message:string)=>void}) {
  const video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null), alive=useRef(false);
  const [active,setActive]=useState(false),[busy,setBusy]=useState(false);
  const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;setActive(false);};
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;stream.current?.getTracks().forEach(track=>track.stop());};},[]);
  async function start(){setBusy(true);report("");try{const feed=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});if(!alive.current){feed.getTracks().forEach(track=>track.stop());return;}stream.current=feed;video.current!.srcObject=feed;setActive(true);}catch{report("Kamera nicht verfügbar oder Zugriff verweigert. Du kannst ein Bild auswählen.");}finally{if(alive.current)setBusy(false);}}
  async function capture(){const source=video.current;if(!source?.videoWidth)return;try{const canvas=document.createElement("canvas");canvas.width=canvas.height=144;const side=Math.min(source.videoWidth,source.videoHeight);canvas.getContext("2d")!.drawImage(source,(source.videoWidth-side)/2,(source.videoHeight-side)/2,side,side,0,0,144,144);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)throw Error();const photo=await makePortrait(new File([blob],"portrait.png",{type:"image/png"}));if(alive.current)select(photo);}catch{if(alive.current)report("Foto konnte nicht aufgenommen werden.");}finally{if(alive.current)stop();}}
  return <div className="portrait-camera"><video ref={video} hidden={!active} autoPlay muted playsInline aria-label="Kameravorschau"/>{active ? <><button type="button" onClick={()=>void capture()}>Foto aufnehmen</button><button type="button" onClick={stop}>Abbrechen</button></> : <button type="button" disabled={busy} onClick={()=>void start()}><Camera size={16}/>Kamera öffnen</button>}</div>;
}