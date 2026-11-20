const notes = {buy:[510,660,890],sell:[800,610,480],jail:[240,160,100],phone:[660,880,660],accepted:[590,760,990],rejected:[490,340,270],pay:[500,400],casino:[420,630,850],message:[880,1320],turn:[523,659,784],warn:[880,0,880],win:[523,659,784,1046],lose:[392,330,262]} as const;
export type Cue = keyof typeof notes | "roll" | "step" | "card" | "money";
let context:AudioContext|undefined, noise:AudioBuffer|undefined;
export function unlockSound(){try {context??=new AudioContext();if(context.state==="suspended")void context.resume().catch(()=>{});}catch{return;}}
function burst(audio:AudioContext,start:number,{gain,frequency,q,length}:{gain:number;frequency:number;q:number;length:number}){
  noise??=(()=>{const buffer=audio.createBuffer(1,audio.sampleRate*.4,audio.sampleRate),data=buffer.getChannelData(0);for(let index=0;index<data.length;index++)data[index]=Math.random()*2-1;return buffer;})();
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),level=audio.createGain();
  source.buffer=noise;filter.type="bandpass";filter.frequency.value=frequency;filter.Q.value=q;
  level.gain.setValueAtTime(gain,start);level.gain.exponentialRampToValueAtTime(.0001,start+length);
  source.connect(filter);filter.connect(level);level.connect(audio.destination);source.start(start,Math.random()*.3,length+.02);
  source.onended=()=>{source.disconnect();filter.disconnect();level.disconnect();};
}
export function playSound(cue:Cue){
  if(!context || context.state!=="running")return;
  const audio=context,now=audio.currentTime;
  if(cue==="roll"){let at=now;for(let hit=0;hit<13;hit++){burst(audio,at,{gain:.5-hit*.03,frequency:1800+Math.random()*1600,q:3,length:.05});at+=.05+hit*.012+Math.random()*.03;}return;}
  if(cue==="step"){burst(audio,now,{gain:.22,frequency:700,q:4,length:.06});return;}
  if(cue==="card"){burst(audio,now,{gain:.28,frequency:4200,q:.8,length:.14});return;}
  if(cue==="money"){for(let index=0;index<4;index++)burst(audio,now+index*.06,{gain:.18,frequency:5200+index*500,q:9,length:.09});return;}
  notes[cue].forEach((frequency,index)=>{if(!frequency)return;const start=now+index*.1,osc=audio.createOscillator(),gain=audio.createGain();osc.type=cue==="warn"?"square":"sine";osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(cue==="warn"?.04:.075,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+.18);osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(start+.2);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}