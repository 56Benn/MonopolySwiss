import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const lessons = [
  { title: "Das Brett lesen", body: "Hier bewegen sich die Figuren. Ein Klick auf ein Feld öffnet seine Karte mit Foto, Mieten und Verwaltung. Das Brett bleibt dabei bedienbar.", targets:[".table-stage"] },
  { title: "Dein Zug", body: "Im Handy siehst du, wer am Zug ist, von welchem Feld zu welchem Feld gefahren wurde, und hier würfelst du.", targets:[".turn-card", ".device-frame"] },
  { title: "Dein Spielhandy", body: "Unten wechselst du zwischen Tisch, Portfolio, Handel, News und Chat. Zahlungen bestätigst du mit einem Wisch nach rechts.", targets:[".device-frame .phone-tabs", ".device-frame"] },
  { title: "Ansicht wechseln", body: "Hier schaltest du zwischen Fotobrett und 3D um. Im Handy-Menü wählst du, ob das Handy links oder rechts steht.", targets:[".board-mode"] },
] as const;

const stepMs = 25_000, limitMs = 180_000;
export function TableGuide({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const started = useRef(Date.now());
  const until = useRef(started.current + stepMs);
  const active = useRef(0);
  const leave = useRef(close);
  const layer=useRef<HTMLDialogElement>(null), panel=useRef<HTMLDivElement>(null);
  const [geometry,setGeometry]=useState({left:0,top:0,width:0,height:0,x:12,y:12});
  useLayoutEffect(()=>{
    const dialog=layer.current!;
    dialog.showModal();
    return ()=>dialog.close();
  },[]);
  useLayoutEffect(()=>{
    const target=lessons[step].targets.map(selector=>document.querySelector<HTMLElement>(selector)).find(node=>node && node.getClientRects().length);
    if(!target) return;
    target.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
    const measure=()=>{
      const rect=target.getBoundingClientRect(), box=panel.current!.getBoundingClientRect();
      const left=Math.max(2,rect.left-3),top=Math.max(2,rect.top-3),right=Math.min(innerWidth-2,rect.right+3),bottom=Math.min(innerHeight-2,rect.bottom+3);
      const fitsBelow=bottom+box.height+16<=innerHeight;
      const x=right+box.width+16<=innerWidth ? right+8 : left-box.width>=16 ? left-box.width-8 : left+(right-left-box.width)/2;
      const y=fitsBelow ? bottom+8 : top-box.height>=16 ? top-box.height-8 : bottom-box.height-12;
      setGeometry({left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top),x:Math.max(8,Math.min(x,innerWidth-box.width-8)),y:Math.max(8,Math.min(y,innerHeight-box.height-8))});
    };
    measure(); const observer=new ResizeObserver(measure);observer.observe(target);observer.observe(panel.current!);
    window.addEventListener("resize",measure);document.addEventListener("scroll",measure,true);
    return ()=>{observer.disconnect();window.removeEventListener("resize",measure);document.removeEventListener("scroll",measure,true);};
  },[step]);
  useEffect(() => { leave.current = close; }, [close]);
  function go(next: number) {
    if (next >= lessons.length || Date.now() >= started.current + limitMs) return leave.current();
    active.current = next;
    until.current = Date.now() + stepMs;
    setStep(next);
  }
  useEffect(() => {
    function advance() {
      const now = Date.now();
      if (now >= started.current + limitMs) return leave.current();
      if (now < until.current) return;
      const elapsedSteps = 1 + Math.floor((now - until.current) / stepMs);
      if (active.current + elapsedSteps >= lessons.length) return leave.current();
      active.current += elapsedSteps;
      until.current += elapsedSteps * stepMs;
      setStep(active.current);
    }
    const timer = window.setInterval(advance, 250);
    const deadline = window.setTimeout(() => leave.current(), Math.max(0, started.current + limitMs - Date.now()));
    document.addEventListener("visibilitychange", advance);
    return () => { clearInterval(timer); clearTimeout(deadline); document.removeEventListener("visibilitychange", advance); };
  }, []);
  const {title,body} = lessons[step];
  return <dialog ref={layer} className="table-tour" aria-label="Tischtour" onCancel={close}>
    <div className="tour-spot" aria-hidden="true" style={{left:geometry.left,top:geometry.top,width:geometry.width,height:geometry.height}}/>
    <div ref={panel} className="table-guide tour-panel" style={{left:geometry.x,top:geometry.y}}>
      <div className="guide-meta"><span>Tischtour · Schritt {step + 1} von {lessons.length}</span><button aria-label="Tour schliessen" onClick={close}><X size={15}/></button></div>
      <div className="guide-progress" aria-hidden="true">{lessons.map((lesson,index) => <i key={lesson.title} data-done={index <= step} />)}</div>
      <div aria-live="polite"><h3>{title}</h3><p>{body}</p></div>
      <div className="guide-controls"><button onClick={close}>Überspringen</button><button aria-label="Zurück" disabled={!step} onClick={() => go(step - 1)}><ArrowLeft size={16}/></button><button className="primary" onClick={() => go(step + 1)}>{step === lessons.length - 1 ? "Fertig" : "Weiter"}<ArrowRight size={16}/></button></div>
    </div>
  </dialog>;
}