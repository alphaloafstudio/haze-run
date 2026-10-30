(() => {
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);

// ---------- world constants ----------
const LANE_W = 1.5, ROAD = 2.4, PZ = 3.2, NEAR = 0.45, FAR = 110, SEG = 2, ZONE_LEN = 700;
let W = 0, H = 0, f = 1, camH = 2, horizon = 0, camX = 0;

function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const k = Math.min(0.45*W/ROAD, H*0.2);
  f = k*PZ; horizon = H*0.36; camH = (H*0.84 - horizon)/k;
}
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const rnd = (a,b)=>a+Math.random()*(b-a);
const pick = a=>a[(Math.random()*a.length)|0];
const lerpC = (a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const css = (c,a)=> a===undefined ? `rgb(${c[0]|0},${c[1]|0},${c[2]|0})` : `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const shade = (c,m)=>[c[0]*m,c[1]*m,c[2]*m];

function P(x,y,z){ return [W/2 + (x-camX)*f/z, horizon + (camH-y)*f/z]; }
function poly(pts, fill){ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); }
function faceQuad(xa,xb,ya,yb,z,fill){ if(z<NEAR) return; const a=P(Math.min(xa,xb),Math.max(ya,yb),z), b=P(Math.max(xa,xb),Math.min(ya,yb),z); ctx.fillStyle=fill; ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]); }
function floorQuad(xa,xb,za,zb,y,fill){ if(zb<NEAR) return; za=Math.max(za,NEAR); poly([P(xa,y,za),P(xb,y,za),P(xb,y,zb),P(xa,y,zb)],fill); }
function wallQuad(x,za,zb,ya,yb,col){
  if(zb<NEAR) return; za=Math.max(za,NEAR);
  const a=P(x,ya,za), b=P(x,yb,za), c=P(x,yb,zb), d=P(x,ya,zb);
  let fill;
  if(Math.abs(a[0]-d[0])>2){ fill=ctx.createLinearGradient(a[0],0,d[0],0); fill.addColorStop(0,fc(col,za)); fill.addColorStop(1,fc(col,zb)); }
  else fill=fc(col,za);
  poly([a,b,c,d],fill);
}
function sideWall(x,za,zb,ya,yb,col){ if(zb<=za) return; wallQuad(x,za,zb,ya,yb,col); }
function ell(x,y,rx,ry,fill){ ctx.beginPath(); ctx.ellipse(x,y,Math.max(rx,.1),Math.max(ry,.1),0,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); }
function label(txt,x,y,z,size,col,weight='800',fam='Figtree, sans-serif'){
  const fs=size*f/z; if(fs<6||z<NEAR) return;
  const p=P(x,y,z); ctx.fillStyle=css(col,1-fogAt(z)); ctx.font=`${weight} ${fs}px ${fam}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,p[0],p[1]); ctx.textBaseline='alphabetic';
}
function line3(x1,y1,x2,y2,z,col,w){ if(z<NEAR) return; const a=P(x1,y1,z), b=P(x2,y2,z); ctx.strokeStyle=fc(col,z); ctx.lineWidth=Math.max(1,w*f/z); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }

// ---------- haze ----------
let HAZE=[190,200,210], vis=100, psiNow=40, psiBase=40;
const HSTOPS=[[0,[176,204,224]],[100,[206,198,176]],[200,[216,166,110]],[300,[178,120,76]],[450,[118,80,58]]];
function hazeFor(p){
  for(let i=1;i<HSTOPS.length;i++){ if(p<=HSTOPS[i][0]){ const [a,ca]=HSTOPS[i-1],[b,cb]=HSTOPS[i]; return lerpC(ca,cb,(p-a)/(b-a)); } }
  return HSTOPS[HSTOPS.length-1][1];
}
function fogAt(z){ const t=clamp((z-2)/vis,0,1); return t*t*(3-2*t); }
function fc(c,z){ return css(lerpC(c,HAZE,fogAt(z))); }
function band(p){
  if(p<=50) return ['Good','--good'];
  if(p<=100) return ['Moderate','--mod'];
  if(p<=200) return ['Unhealthy','--unh'];
  if(p<=300) return ['Very unhealthy','--vunh'];
  return ['Hazardous','--haz'];
}

// ---------- zones ----------
const ZONES=[
  {name:'Toa Payoh', sub:'HDB heartland', kind:'hdb', road:[170,86,64], roadB:[158,78,58], walk:[198,192,178], gL:[92,126,80], gR:[92,126,80]},
  {name:'Chinatown', sub:'Shophouses & temples', kind:'shop', road:[94,94,98], roadB:[86,86,90], walk:[204,182,152], gL:[128,116,104], gR:[128,116,104]},
  {name:'Marina Bay', sub:'The bay front', kind:'cbd', road:[198,192,182], roadB:[186,180,170], walk:[184,178,168], gL:[150,150,146], gR:[56,104,130], water:true},
];
const zoneIdx = d => Math.floor(Math.max(0,d)/ZONE_LEN)%ZONES.length;
const zoneAt = d => ZONES[zoneIdx(d)];
const STREETS={hdb:['Lor 1 Toa Payoh','Lor 4 Toa Payoh','Lor 8 Toa Payoh','Toa Payoh Central','Toa Payoh North'],shop:['Pagoda St','Temple St','Smith St','Trengganu St','South Bridge Rd'],cbd:['Bayfront Ave','Raffles Ave','Marina Blvd','Esplanade Dr']};

// skyline backdrops, in fractions of the screen
const skylines = ZONES.map(z=>{
  const arr=[]; let x=-0.02;
  const fill=(to,fw,fh)=>{ while(x<to){ const w=rnd(...fw), h=rnd(...fh); arr.push({k:'rect',x,w,h}); x+=w+rnd(0,.02); } };
  if(z.kind==='hdb'){ fill(1.02,[.04,.08],[.06,.15]); }
  else if(z.kind==='shop'){
    fill(.1,[.03,.07],[.03,.08]);
    arr.push({k:'linked',x:.11,w:.16,h:.32}); x=.29;
    fill(1.02,[.03,.07],[.03,.1]);
    arr.push({k:'rect',x:.62,w:.05,h:.2},{k:'rect',x:.8,w:.04,h:.16});
  } else {
    fill(.36,[.025,.05],[.14,.34]);
    arr.push({k:'supertree',x:.37,w:.035,h:.14},{k:'supertree',x:.405,w:.04,h:.19},{k:'supertree',x:.45,w:.035,h:.12},{k:'supertree',x:.485,w:.03,h:.16});
    arr.push({k:'domes',x:.53,w:.12,h:.07});
    arr.push({k:'trio',x:.67,w:.15,h:.28});
    arr.push({k:'wheel',x:.86,w:.12,h:.3});
  }
  return arr;
});

// ---------- obstacle catalogue ----------
// cat: jump = clear it by jumping (h = height), slide = slide under, lane = must avoid
const OB={
  crate:{cat:'jump',h:0.72,dep:0.7},
  chope:{cat:'jump',h:0.82,dep:0.9},
  bikes:{cat:'jump',h:0.72,dep:0.7},
  trolley:{cat:'jump',h:0.88,dep:0.5},
  cat:{cat:'jump',h:0.4,dep:0.6},
  otters:{cat:'jump',h:0.45,dep:0.6},
  laundry:{cat:'slide',dep:0.2},
  nodurian:{cat:'slide',dep:0.2},
  kopi:{cat:'slide',dep:0.2},
  branch:{cat:'slide',dep:0.4},
  bus:{cat:'lane',dep:5.5},
  queue:{cat:'lane',dep:7.6},
  aunties:{cat:'lane',dep:2.6},
  scooter:{cat:'lane',dep:0.8},
  barrier:{cat:'jump',h:0.82,dep:0.3},
  lowlantern:{cat:'slide',dep:0.2},
  selfie:{cat:'slide',dep:0.2},
  bunting:{cat:'slide',dep:0.2},
  karung:{cat:'lane',dep:1.6},
  delivery:{cat:'lane',dep:1.2},
  liondance:{cat:'lane',dep:2.0},
  tourgroup:{cat:'lane',dep:2.9},
  wedding:{cat:'lane',dep:2.8},
  fogging:{cat:'hazard',dep:0.6},
};
// what turns up where
const SETS={
  hdb:{jump:['chope','cat','bikes','barrier'],slide:['laundry','laundry','kopi','branch'],lane:['bus'],special:['trolley','karung','fogging','aunties','aunties'],bonus:null},
  shop:{jump:['crate','crate','barrier','chope'],slide:['nodurian','lowlantern','kopi'],lane:['queue','liondance','tourgroup','bus'],special:['trolley','fogging'],bonus:'angbao'},
  cbd:{jump:['bikes','barrier','chope'],slide:['selfie','bunting'],lane:['wedding','tourgroup'],special:['otters','otters','scooter','delivery'],bonus:'icecream'},
};
const NAMES={mask:'N95 mask',chope:'chope tissue',toast:'kaya toast',angbao:'ang bao',icecream:'ice cream sandwich'};
const CAUSE={
  crate:'Tripped over a durian crate.',
  chope:'Crashed into a choped table. The tissue packet wins.',
  bikes:'Tangled in a pile of abandoned share bikes.',
  trolley:"Flattened by auntie's runaway trolley.",
  cat:'Tripped over a sleeping cat. It is still asleep.',
  otters:'Stopped by an otter family. They have right of way.',
  laundry:"Clotheslined by someone's laundry pole.",
  nodurian:'Smacked into the "No durians" sign. Ironic.',
  kopi:'Faceful of kopi peng. Siao liao.',
  branch:'Whacked by a rain tree branch.',
  bus:'Ran into the back of a bus.',
  queue:'Accidentally joined the bakery queue. Estimated wait: 2 hours.',
  aunties:'Absorbed into the void deck line dance.',
  scooter:'Hit by an uncle on an e-scooter. On the footpath somemore.',
  barrier:'Tripped over roadworks. Sorry for the inconvenience.',
  lowlantern:'Tangled in festive lanterns. Very auspicious, very painful.',
  selfie:'Photobombed by a selfie stick. You are now in 40 holiday photos.',
  bunting:'Wrapped up in NDP bunting. Very patriotic.',
  karung:'Ran into the karung guni uncle. He offered $2 for you.',
  delivery:'Crashed into a food delivery rider. Someone\'s laksa is now late.',
  liondance:'Swallowed by a lion dance. Huat ah?',
  tourgroup:'Swept up by a tour group. Now heading to the souvenir shop.',
  wedding:'Ran through a wedding photoshoot. You are in the album now.',
  breath:'Out of breath.'
};
const NEWS=[
  'Your family WhatsApp group has forwarded the NEA update 14 times.',
  'Auntie at the void deck insists the PSI is "just fog lah".',
  'N95 masks sold out at 23 pharmacies. Patience also sold out.',
  'Office aircon set to 18°C. For once, nobody is complaining.',
  'Students refresh the PSI page hourly, hoping for 301.',
  'Netizens debate whether this haze is worse than last year. Again.',
  'Bubble tea queue length unaffected by haze, experts confirm.',
  'Forecast: hazy, with a 90% chance of complaining.',
  'Man spotted jogging outdoors. Neighbours concerned.',
  'Uncle at kopitiam says he has seen worse. He says that about everything.',
  'Mall foot traffic up 300%. Nobody is buying anything.',
  'Otters seen wearing nothing. Unbothered as usual.',
  'Toa Payoh residents report laundry now comes out smoke-flavoured.',
  'Lion dance troupe claims the drums are clearing the haze. Science disagrees.',
  'Tourists at Marina Bay ask why the skyline is beige.',
  'Karung guni uncle now accepting used N95s. Please do not.',
  'NEA fogging resumes. Residents cannot tell the difference.',
  'Couple insists their hazy wedding photos look "dreamy".',
  'Hawker centre queue for chicken rice: 45 minutes. Haze is not a factor.',
  'NDP rehearsal goes ahead. Jets visible for 0.4 seconds.',
  'Uncle at void deck has been saying "today very hazy" since 1997.'
];

// ---------- game state ----------
let state='menu', dist=0, speed=12, air=100, bubbles=0, maskT=0, peakPsi=40, t=0, dieT=0, causeKey='';
let points=0, shield=false, boostT=0, invT=0, rainT=0, nextRainT=0, dodged=0, grpId=0, grpGot={}, lastShiok=-9;
let obs=[], pick_=[], scen=[], nextRow=40, nextScen=[0,0], nextErp=0, mallNext=0, mallSide=0;
let nextLink=0, nextSign=0, jetT=0, nextJet=0, lastBojio=-9, lowWarn=false, blastT=0, blastN=0;
const BLAST_AT=25, BLAST_TIME=5;
const player={lane:0,x:0,y:0,vy:0,slide:0,slideQ:false,phase:0};
let curZone=-1, best=0, tickT=0, tickI=0;
try{ best=+localStorage.getItem('hazerun-best-pts')||0; }catch(e){}

const HDBC=[[230,218,190],[206,224,214],[238,208,192],[216,216,234],[242,228,172],[226,232,236]];
const SHOPC=[[168,214,190],[238,172,170],[244,216,142],[162,202,228],[244,188,152],[214,190,232]];
const GLASS=[[118,148,168],[92,122,142],[168,178,186],[132,160,150]];
const SHIRTS=[[220,70,70],[70,120,200],[240,200,80],[90,170,120],[240,240,236],[150,90,170],[240,140,170],[60,60,70]];

function resetWorld(){
  dist=0; speed=13.5; air=100; bubbles=0; maskT=0; peakPsi=40; t=0;
  points=0; shield=false; boostT=0; invT=0; rainT=0; nextRainT=rnd(35,50); dodged=0; grpGot={}; lastShiok=-9;
  obs=[]; pick_=[]; scen=[]; nextRow=45; nextScen=[-6,-2]; nextErp=ZONE_LEN+60; mallNext=rnd(140,220); mallSide=Math.random()<.5?0:1;
  nextLink=-6; nextSign=rnd(20,40); jetT=0; nextJet=0; lastBojio=-9; lowWarn=false; blastT=0; blastN=0;
  Object.assign(player,{lane:0,x:0,y:0,vy:0,slide:0,slideQ:false});
  curZone=-1;
}

function genScenery(camD){
  for(const s of [0,1]){
    const side=s?1:-1;
    while(nextScen[s] < camD+FAR+12){
      const d=nextScen[s], z=zoneAt(d);
      if(z.kind==='cbd' && s===1 && mallSide===1) mallSide=0;   // no malls in the bay
      if(s===mallSide && d>=mallNext){
        scen.push({t:'mall',side,d,len:14,h:8.5,dep:8});
        nextScen[s]=d+14+rnd(4,6); mallNext=d+rnd(320,440); mallSide=Math.random()<.5?0:1;
        continue;
      }
      if(z.kind==='hdb'){
        const r=Math.random();
        let len;
        if(r<0.15){ len=16; scen.push({t:'hawker',side,d,len,h:4.6,dep:9,stalls:[...HAWKER].sort(()=>Math.random()-.5).slice(0,4)}); }
        else if(r<0.26){ len=12; scen.push({t:'carpark',side,d,len,h:7.6,dep:9}); }
        else { len=rnd(9,13); scen.push({t:'hdb',side,d,len,h:rnd(10,15),dep:5,col:pick(HDBC),num:100+((Math.random()*800)|0)}); }
        const gap=rnd(5,8);
        if(side>0) scen.push({t:'tree',side,d:d+len+gap/2});
        nextScen[s]=d+len+gap;
      } else if(z.kind==='shop'){
        const r=Math.random();
        if(r<0.07){ scen.push({t:'temple',side,d,len:11,h:4.2,dep:8}); nextScen[s]=d+11.5; }
        else if(r<0.12){ scen.push({t:'gopuram',side,d,len:7,h:13,dep:7}); nextScen[s]=d+7.5; }
        else {
          const len=4.5;
          scen.push({t:'shop',side,d,len,h:rnd(4.4,5.4),dep:6,col:pick(SHOPC),shut:pick([[70,122,92],[120,74,52],[60,92,128]])});
          if(Math.random()<.35) scen.push({t:'stall',side,d:d+1.2,len:1.6,goods:pick([[230,150,40],[200,60,50],[240,210,90],[120,170,90]])});
          nextScen[s]=d+len;
        }
      } else {
        if(side>0){
          scen.push({t:'lamp',side,d:d+3});
          if(Math.random()<.3) scen.push({t:'boat',side,d:d+rnd(2,8),x:rnd(7,13),col:pick([[200,60,50],[60,120,170],[230,180,60]]),ph:Math.random()*6});
          nextScen[s]=d+9; continue;
        }
        const len=rnd(8,12);
        scen.push({t:'tower',side,d,len,h:rnd(16,32),dep:8,col:pick(GLASS)});
        scen.push({t:'lamp',side,d:d+len+2}); nextScen[s]=d+len+rnd(4,7);
      }
    }
  }
  // covered linkways (Toa Payoh), lantern strings (Chinatown)
  while(nextLink < camD+FAR+12){
    const k=zoneAt(nextLink).kind;
    if(k==='hdb') scen.push({t:'link',side:-1,d:nextLink,len:6});
    else if(k==='shop' && Math.round(nextLink/6)%2===0) scen.push({t:'lanternline',d:nextLink});
    nextLink+=6;
  }
  // green street signs
  while(nextSign < camD+FAR+12){
    const k=zoneAt(nextSign).kind;
    scen.push({t:'sign',side:k==='cbd'?1:pick([-1,1]),d:nextSign,txt:pick(STREETS[k])});
    nextSign+=rnd(55,85);
  }
}
const HAWKER=[['CHICKEN RICE',[200,60,50]],['CHAR KWAY TEOW',[40,100,160]],['KOPI · TEH',[120,70,40]],['LAKSA',[220,120,40]],['CARROT CAKE',[60,130,80]],['NASI LEMAK',[150,60,120]],['FISHBALL NOODLE',[50,120,140]]];

function addOb(t,lane,d,extra={}){ const o={t,lane,x:lane*LANE_W,d,len:OB[t]?OB[t].dep:0.6,svc:pick(['8','23','51','139','145','851','961','2','32']),...extra}; obs.push(o); return o; }
function addPickups(free,d){
  if(!free.length) return;
  const l=pick(free), x=l*LANE_W, r=Math.random(), bonus=SETS[zoneAt(d).kind].bonus;
  if(dist>250 && maskT<=0 && r<0.06) pick_.push({t:'mask',x,d:d+4});
  else if(dist>150 && !shield && r<0.12) pick_.push({t:'chope',x,d:d+4});
  else if(dist>200 && boostT<=0 && r<0.17) pick_.push({t:'toast',x,d:d+4});
  else if(bonus && r<0.3) pick_.push({t:bonus,x,d:d+4});
  else { const g=++grpId; for(let i=0;i<4;i++) pick_.push({t:'bub',x,d:d+3+i*1.6,g,gn:4}); }
}
function makeRow(d){
  const prog=Math.min(1,dist/2500), set=SETS[zoneAt(d).kind], all=[-1,0,1];
  // special rows: moving things and hazards
  if(dist>150 && Math.random()<0.24){
    const sp=pick(set.special);
    if(sp==='trolley'||sp==='otters'){
      const side=Math.random()<.5?-1:1;
      addOb(sp,0,d,{x:side*(ROAD+1.3),vx:-side*(sp==='otters'?1.7:1.15),hw:sp==='otters'?0.85:0.4,trig:rnd(22,38)});
      return 6;
    }
    const l=pick(all), others=all.filter(v=>v!==l);
    if(sp==='scooter'){ addOb('scooter',l,d+10); addPickups(others,d); return 14; }
    if(sp==='karung'||sp==='delivery'){ addOb(sp,l,d,{spd:sp==='karung'?2.5:4}); addPickups(others,d); return 14; }
    if(sp==='fogging'){ addOb('fogging',l,d); addPickups(others,d); return 4; }
    addOb('aunties',l,d,{ph:Math.random()*6});
    if(l!==0) addPickups([-l],d);
    return 4;
  }
  const lanes=[-1,0,1].sort(()=>Math.random()-.5);
  let n=Math.random()<.36+prog*.4?2:1;
  if(dist>150 && Math.random()<.13+prog*.14) n=3;
  const blocked=lanes.slice(0,n), free=lanes.slice(n);
  const allCat = n===3 ? pick(['jump','slide']) : null;
  for(const l of blocked){
    let cat = allCat || (Math.random()<.3?'lane':(Math.random()<.5?'jump':'slide'));
    let ty = pick(set[cat]);
    if((ty==='branch'||ty==='selfie') && l===0){ const alt=set.slide.filter(v=>v!=='branch'&&v!=='selfie'); ty=pick(alt.length?alt:['laundry']); }
    addOb(ty,l,d);
  }
  if(free.length && Math.random()<.72) addPickups(free,d);
  else if(!free.length && Math.random()<.5){ const l=pick(blocked); const g=++grpId; for(let i=0;i<3;i++) pick_.push({t:'bub',x:l*LANE_W,d:d+4+i*1.6,g,gn:3}); }
  return 0;
}

// ---------- input ----------
function act(a){
  if(state!=='play') return;
  if(a==='L') player.lane=Math.max(-1,player.lane-1);
  if(a==='R') player.lane=Math.min(1,player.lane+1);
  if(a==='U'){ if(player.y<=0.001){ player.vy=8.6; player.slide=0; } }
  if(a==='D'){ if(player.y>0.001){ player.vy=-16; player.slideQ=true; } else player.slide=0.75; }
}
addEventListener('keydown',e=>{
  const k=e.key;
  if(['ArrowLeft','a','A'].includes(k)) act('L');
  else if(['ArrowRight','d','D'].includes(k)) act('R');
  else if(['ArrowUp','w','W',' '].includes(k)) act('U');
  else if(['ArrowDown','s','S'].includes(k)) act('D');
  else if(k==='p'||k==='P'||k==='Escape'){ if(state==='play') pause(); else if(state==='paused') resume(); }
  else if(k==='Enter'){ if(state==='menu'||state==='over') start(); }
  if(k.startsWith('Arrow')||k===' ') e.preventDefault();
});
let sw=null;
const gameEl=$('game');
gameEl.addEventListener('pointerdown',e=>{ if(e.target.closest('button')) return; sw={x:e.clientX,y:e.clientY,done:false}; });
gameEl.addEventListener('pointermove',e=>{
  if(!sw||sw.done) return;
  const dx=e.clientX-sw.x, dy=e.clientY-sw.y;
  if(Math.hypot(dx,dy)>26){ sw.done=true; act(Math.abs(dx)>Math.abs(dy)?(dx<0?'L':'R'):(dy<0?'U':'D')); }
});
addEventListener('pointerup',()=>sw=null); addEventListener('pointercancel',()=>sw=null);

// ---------- pop-ups ----------
let popTimer=0;
const tipsSeen={};
function firstTime(k){ try{ if(localStorage.getItem('hazerun-tip-'+k)) return false; localStorage.setItem('hazerun-tip-'+k,'1'); return true; }catch(e){ if(tipsSeen[k]) return false; tipsSeen[k]=1; return true; } }
// Narrow portrait phones: pop-ups sit just below the HUD stack, and are skipped while the area-name banner is showing
const narrowMQ=matchMedia('(max-width:480px)');
function placePop(){ const el=$('pop'); if(narrowMQ.matches) el.style.top=($('hud').getBoundingClientRect().bottom+8)+'px'; else el.style.top=''; }
function say(main,sub='',ms=1250){
  if(narrowMQ.matches && $('banner').classList.contains('show')) return;
  const el=$('pop'); placePop(); $('popMain').textContent=main; $('popSub').textContent=sub;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(popTimer); popTimer=setTimeout(()=>el.classList.remove('show'),ms);
}
function nextNews(){
  const box=$('tickBox'); box.style.opacity=0;
  setTimeout(()=>{ $('tickTxt').textContent=NEWS[tickI%NEWS.length]; tickI++; box.style.opacity=1; },350);
}

// ---------- flow ----------
function show(id,on){ $(id).hidden=!on; }
function start(){
  resetWorld(); state='play'; Ads.gameplayStart();
  show('menu',false); show('over',false); show('paused',false); show('hud',true); show('ticker',true);
  tickI=(Math.random()*NEWS.length)|0; tickT=8; nextNews();
}
function pause(){ if(state==='play') Ads.gameplayStop(); state='paused'; show('paused',true); }
function resume(){ state='play'; Ads.gameplayStart(); show('paused',false); last=performance.now(); }
function crash(key){ if(state!=='play') return; causeKey=key; state='dying'; dieT=0; say('Alamak!'); }
function quip(p){
  if(p<=100) return 'PSI never left Moderate. Basically a normal Tuesday.';
  if(p<=200) return 'Unhealthy range. Your mum has already sent three WhatsApp reminders to wear a mask.';
  if(p<=300) return 'Very unhealthy. Schools are closed and every pharmacy is out of N95s.';
  return "Hazardous. You can't see the other side of Marina Bay any more.";
}
function gameOver(){
  state='over'; Ads.gameplayStop();
  const pts=Math.floor(points);
  let isBest=false;
  if(pts>best){ best=pts; isBest=true; try{ localStorage.setItem('hazerun-best-pts',String(best)); }catch(e){} }
  $('oCause').textContent=CAUSE[causeKey];
  $('oQuip').textContent=quip(peakPsi);
  $('oDist').textContent=Math.floor(dist).toLocaleString();
  $('oPsi').textContent=Math.round(peakPsi);
  $('oPts').textContent=pts.toLocaleString();
  $('oBest').textContent=isBest?'New personal best!':`Personal best: ${best.toLocaleString()} pts`;
  show('hud',false); show('ticker',false); show('over',true);
  setTimeout(()=>$('againBtn').focus({preventScroll:true}),50);
}
$('startBtn').onclick=start; $('againBtn').onclick=()=>{ Ads.showBreak().then(start); };
$('pauseBtn').onclick=pause; $('resumeBtn').onclick=resume;
$('quitBtn').onclick=()=>{ Ads.gameplayStop(); state='menu'; resetWorld(); show('paused',false); show('hud',false); show('ticker',false); show('menu',true); updateMenuBest(); };
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&state==='play') pause(); });
function updateMenuBest(){ $('menuBest').textContent = best?`Personal best: ${best.toLocaleString()} pts`:''; }
updateMenuBest();

let bannerTimer=0;
function zoneBanner(z){ if(narrowMQ.matches){ $('pop').classList.remove('show'); clearTimeout(popTimer); } $('bName').textContent=z.name; $('bSub').textContent=z.sub; $('banner').classList.add('show'); clearTimeout(bannerTimer); bannerTimer=setTimeout(()=>$('banner').classList.remove('show'),2200); }

// ---------- collisions ----------
const auntX=(o,i)=>o.x+Math.sin(t*2.2+o.ph+i*0.6)*1.0;
function hitOb(o){
  if(boostT>0||invT>0){ o.hit=true; return; }
  if(shield){ shield=false; invT=1.0; o.hit=true; { const q=pick([['Your tissue packet saved your life!','Nobody messes with a choped seat. Or its owner.'],['Chope tissue: 1, danger: 0','Singapore-grade protection, activated'],['Tissue packet to the rescue!','Never underestimate a packet of tissue paper'],['Choped! Still alive.','Your reserved seat in life has been honoured']]); say(q[0],q[1],2400); } return; }
  crash(o.t);
}
function checkCollisions(){
  for(const o of obs){
    const def=OB[o.t]; if(!def||o.hit) continue;
    if(o.t==='aunties'){
      for(let i=0;i<3;i++){ const rz=o.d+i*1.2-dist; if(Math.abs(player.x-auntX(o,i))<0.72 && rz<0.3 && rz>-0.45){ hitOb(o); break; } }
      continue;
    }
    if(Math.abs(player.x-o.x)>(o.hw||0.5)+0.35) continue;
    const rz=o.d-dist;
    if(def.cat==='hazard'){
      if(rz<0.6 && rz>-1.0){
        o.hit=true;
        if(maskT>0||boostT>0) say('N95 to the rescue','Fogging blocked');
        else { air=Math.max(0,air-18); say('Fogging!','As if we needed more smoke · −18 air'); }
      }
      continue;
    }
    if(!(rz<0.3 && rz>-(o.len+0.2))) continue;
    if(def.cat==='jump'){
      if(player.y<def.h-0.02) hitOb(o);
      else if(o.t==='cat' && !o.bonus){ o.bonus=true; points+=50; say("Didn't wake the cat",'+50'); }
    }
    else if(def.cat==='slide'){ if(!(player.slide>0)) hitOb(o); }
    else hitOb(o);
    if(state!=='play') return;
  }
}

// ---------- update ----------
function update(dt){
  t+=dt;
  if(state==='play'){
    speed=Math.min(32,13.5+dist*0.0095);
    const eff=speed*(blastT>0?1.3:boostT>0?1.45:1);
    dist+=eff*dt;
    points+=eff*dt*(blastT>0||boostT>0?2:1);
    psiBase=40+dist*0.11+Math.sin(dist*0.008)*6;
    peakPsi=Math.max(peakPsi,psiBase);

    // monsoon
    if(rainT<=0 && t>nextRainT && dist>400){ rainT=7; nextRainT=t+7+rnd(40,65); say('Monsoon surprise!','Haze clears · road gets slippery'); }
    if(rainT>0) rainT=Math.max(0,rainT-dt);
    const rainF=rainT>0?clamp(Math.min((7-rainT)/1,rainT/1.5),0,1):0;
    psiNow=Math.max(25,psiBase-140*rainF);

    // player
    const grip=rainT>0?9:22, minV=rainT>0?3.2:7;
    { const dx=player.lane*LANE_W-player.x, step=Math.max(Math.abs(dx)*grip,minV)*dt; player.x = Math.abs(dx)<=step ? player.lane*LANE_W : player.x+Math.sign(dx)*step; }
    if(player.y>0||player.vy>0){ player.vy-=24*dt; player.y+=player.vy*dt; if(player.y<=0){ player.y=0; player.vy=0; if(player.slideQ){ player.slide=0.7; player.slideQ=false; } } }
    if(player.slide>0) player.slide-=dt;
    player.phase+=dt*eff*0.75;
    if(boostT>0) boostT=Math.max(0,boostT-dt);
    if(blastT>0) blastT=Math.max(0,blastT-dt);
    if(invT>0) invT=Math.max(0,invT-dt);

    // air
    if(maskT>0) maskT=Math.max(0,maskT-dt);
    else air-=(1.5+psiNow/40)*dt;
    if(air<=0){ air=0; crash('breath'); }

    // spawn rows + ERP gantries
    while(nextRow<dist+FAR){ const extra=makeRow(nextRow); nextRow+=0.74*speed+rnd(1,6)+extra; }
    while(nextErp<dist+FAR){ const k=zoneAt(nextErp).kind; if(k!=='hdb') addOb('erp',0,nextErp,{len:0.6}); nextErp+=rnd(260,380); }

    // moving obstacles
    for(const o of obs){
      const rz=o.d-dist;
      if((o.t==='trolley'||o.t==='otters') && rz<o.trig) o.x+=o.vx*dt;
      if(o.t==='scooter' && rz<28) o.d-=5*dt;
      if((o.t==='karung'||o.t==='delivery') && rz<25) o.d+=o.spd*dt;
    }

    // NDP jets over the bay
    if(jetT>0) jetT=Math.max(0,jetT-dt);
    else if(zoneAt(dist).kind==='cbd' && t>nextJet){ jetT=5; nextJet=t+rnd(28,45); say('NDP rehearsal!','Everyone stops to film it'); }

    // low air nag
    if(air<20 && !lowWarn){ lowWarn=true; say('Can or not ah?','Air running low'); }
    if(air>40) lowWarn=false;

    // bo jio: missed a power-up
    for(const p of pick_){
      if(p.t!=='bub' && !p.taken && !p.missed && p.d<dist-1){ p.missed=true; if(t-lastBojio>3){ lastBojio=t; say('Bo jio!','You missed the '+NAMES[p.t]); } }
    }

    if(state==='play') checkCollisions();

    // dodged streak, ERP charges
    for(const o of obs){
      if(o.t==='erp'){ if(!o.paid && dist>o.d){ o.paid=true; points=Math.max(0,points-20); say('ERP −$2.00','Gantry charge deducted'); } continue; }
      if(!o.counted && dist>o.d+o.len+0.3){ o.counted=true; if(!o.hit){ dodged++; if(dodged%20===0) say('Steady lah!',dodged+' dodged'); } }
    }

    // pickups
    for(const p of pick_){
      if(p.taken) continue;
      if(Math.abs(p.d-dist)<0.9 && Math.abs(player.x-p.x)<0.8 && player.y<1.4){
        p.taken=true; p.pop=0;
        if(p.t==='bub'){
          air=Math.min(100,air+3.5); bubbles++; points+=10;
          if(blastT<=0 && ++blastN>=BLAST_AT){ blastN=0; blastT=BLAST_TIME; air=100; say('FRESH AIR BLAST!','Faster for 5 s · air refilled · still dodge!'); }
          grpGot[p.g]=(grpGot[p.g]||0)+1;
          if(grpGot[p.g]===p.gn && blastT<=0 && t-lastShiok>2){ lastShiok=t; say('Shiok!','Full line of fresh air'); }
        }
        else if(p.t==='mask'){ maskT=8; air=Math.min(100,air+15); say('N95 on','8 s of clean air'); }
        else if(p.t==='chope'){ shield=true; if(firstTime('chope')) say('Choped!','Like reserving a hawker seat with a tissue packet. It absorbs your next hit.',3600); else say('Choped!','Your next hit is on the tissue'); }
        else if(p.t==='toast'){ boostT=3.5; say('Kaya toast!',"Sugar rush · you can't be hit"); }
        else if(p.t==='angbao'){ points+=88; say('Huat ah!','Ang bao · +88'); }
        else if(p.t==='icecream'){ air=Math.min(100,air+20); say('Ice cream uncle!','Shiok · +20 air'); }
      }
    }

    // mall aircon
    for(const s of scen){
      if(s.t!=='mall'||s.used) continue;
      if(dist>s.d+s.len/2){ s.used=true; const gap=Math.abs(player.lane-s.side); const gain=[45,28,14][gap]; air=Math.min(100,air+gain); say('Aircon blast!',gap===0?'Shiok · +'+gain+' air':'+'+gain+' air · run closer to the doors'); }
    }

    // ticker
    tickT-=dt; if(tickT<=0){ tickT=8; nextNews(); }

    const zi=zoneIdx(dist);
    if(zi!==curZone){ if(curZone!==-1) zoneBanner(ZONES[zi]); curZone=zi; }
    updateHud();
  } else if(state==='menu'){
    dist+=7*dt; psiNow=130; player.phase+=dt*5;
    player.x+=(0-player.x)*Math.min(1,dt*6);
  } else if(state==='dying'){
    dieT+=dt; if(dieT>0.9) gameOver();
  }

  const camD=dist-PZ;
  camX+=(player.x-camX)*Math.min(1,dt*16);
  genScenery(camD);
  obs=obs.filter(o=>o.d+o.len-camD>0.2);
  pick_=pick_.filter(p=>p.d-camD>0.2 && !(p.taken&&p.pop>0.35));
  for(const p of pick_) if(p.taken) p.pop+=dt;
  scen=scen.filter(s=>(s.d+(s.len||0))-camD>0.2);

  HAZE=hazeFor(psiNow);
  vis=Math.max(18,120-psiNow*0.32)+(maskT>0?45:0);
}

let lastHud={};
function setTxt(id,v){ if(lastHud[id]!==v){ lastHud[id]=v; $(id).textContent=v; } }
function chip(id,on,txt){ const el=$(id); if(el.hidden===on) el.hidden=!on; if(on&&txt) setTxt(id,txt); }
function updateHud(){
  $('hDist').firstChild.nodeValue=Math.floor(dist).toLocaleString();
  setTxt('hZone',ZONES[zoneIdx(dist)].name);
  setTxt('hPts',Math.floor(points).toLocaleString()+' pts');
  const p=Math.round(psiNow); setTxt('hPsi',String(p));
  const [bn,bv]=band(p);
  if(lastHud.band!==bn){ lastHud.band=bn; const b=$('hBand'); b.textContent=bn; b.style.background=`var(${bv})`; b.style.color = bv==='--haz'||bv==='--vunh' ? '#fff':'#17201f'; }
  setTxt('hBub',blastT>0?'BLAST!':blastN+'/'+BLAST_AT+' ◯');
  $('hBlast').style.width=(blastT>0?blastT/BLAST_TIME*100:blastN/BLAST_AT*100).toFixed(1)+'%';
  $('hBlastWrap').classList.toggle('full',blastT>0);
  chip('hBlastChip',blastT>0,'BLAST '+Math.ceil(blastT)+'s');
  const bar=$('hBar'); bar.style.width=air.toFixed(1)+'%';
  bar.style.background = air>50?'var(--good)':air>25?'var(--mod)':'var(--vunh)';
  $('hBarWrap').classList.toggle('low',air<=25);
  chip('hMask',maskT>0,'N95 '+Math.ceil(maskT)+'s');
  chip('hChope',shield,'CHOPED · saves you once');
  chip('hBoost',boostT>0,'KAYA '+Math.ceil(boostT)+'s');
  chip('hRain',rainT>0,'RAIN · SLIPPERY');
}

// ---------- scenery drawing ----------
const specks=Array.from({length:70},()=>({x:Math.random(),y:Math.random(),s:rnd(.6,2.2),v:rnd(.01,.04)}));
const drops=Array.from({length:140},()=>({x:Math.random(),y:Math.random(),l:rnd(.02,.05)}));

function drawSky(){
  const top=lerpC(HAZE,[46,40,38],0.3+clamp(psiNow/600,0,.3));
  const g=ctx.createLinearGradient(0,0,0,horizon);
  g.addColorStop(0,css(top)); g.addColorStop(1,css(HAZE));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,horizon+1);
  const hz=clamp((psiNow-40)/260,0,1);
  const sc=lerpC([255,246,214],[236,96,52],hz);
  const sx=W*0.7, sy=horizon*0.42, r=Math.min(W,H)*0.045;
  const glow=ctx.createRadialGradient(sx,sy,r*0.5,sx,sy,r*(4-hz*2.4));
  glow.addColorStop(0,css(sc,0.5-hz*0.3)); glow.addColorStop(1,css(sc,0));
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,horizon);
  ell(sx,sy,r,r,css(sc,1-hz*0.35));
}
function drawSkyline(){
  const zi=zoneIdx(dist+40);
  const col=css(lerpC([70,78,86],HAZE,Math.min(.9,.5+psiNow/700)));
  ctx.fillStyle=col; ctx.strokeStyle=col;
  for(const b of skylines[zi]){
    const x=b.x*W, w=b.w*W, h=b.h*horizon, hz=horizon;
    if(b.k==='rect') ctx.fillRect(x,hz-h,w,h+1);
    else if(b.k==='linked'){ // seven slim towers joined by sky bridges
      const tw=w/9;
      for(let i=0;i<7;i++){ const tx=x+i*tw*1.33; ctx.fillRect(tx,hz-h*(i%2?0.96:1),tw,h+1); }
      ctx.fillRect(x,hz-h*0.52,w*1.03,h*0.025); ctx.fillRect(x,hz-h*0.97,w*1.03,h*0.025);
    } else if(b.k==='supertree'){
      const cx=x+w/2;
      ctx.beginPath(); ctx.moveTo(cx-w*0.12,hz); ctx.lineTo(cx-w*0.08,hz-h*0.7); ctx.lineTo(cx-w*0.5,hz-h); ctx.lineTo(cx+w*0.5,hz-h); ctx.lineTo(cx+w*0.08,hz-h*0.7); ctx.lineTo(cx+w*0.12,hz); ctx.fill();
    } else if(b.k==='domes'){ // two spiky domes
      for(const [dx,s] of [[0.28,1],[0.74,0.85]]){
        const cx=x+w*dx, rx=w*0.26*s, ry=h*s;
        ctx.beginPath(); ctx.ellipse(cx,hz,rx,ry,0,Math.PI,0); ctx.fill();
        ctx.save(); ctx.strokeStyle=css(lerpC([70,78,86],HAZE,Math.min(.95,.62+psiNow/700))); ctx.lineWidth=1;
        for(let a=0.15;a<Math.PI;a+=0.28){ ctx.beginPath(); ctx.moveTo(cx-Math.cos(a)*rx*0.9,hz-Math.sin(a)*ry*0.9); ctx.lineTo(cx-Math.cos(a)*rx*1.08,hz-Math.sin(a)*ry*1.08); ctx.stroke(); }
        ctx.restore();
      }
    } else if(b.k==='trio'){ // three towers with a deck across the top
      const tw=w*0.2;
      for(let i=0;i<3;i++) ctx.fillRect(x+w*0.05+i*w*0.33,hz-h,tw,h+1);
      ctx.beginPath(); ctx.moveTo(x-w*0.06,hz-h-hz*.004); ctx.lineTo(x+w*1.04,hz-h-hz*.016); ctx.lineTo(x+w*1.04,hz-h+hz*.008); ctx.lineTo(x-w*0.06,hz-h+hz*.014); ctx.fill();
    } else if(b.k==='wheel'){
      const r=Math.min(w*0.45,h*0.45), cx=x+w/2, cy=hz-h+r;
      ctx.lineWidth=Math.max(1.5,r*0.06);
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=1;
      for(let a=0;a<Math.PI*2;a+=Math.PI/8){ ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-r*0.5,hz); ctx.lineTo(cx+r*0.5,hz); ctx.closePath(); ctx.fill();
    }
  }
}
function drawJets(){
  if(jetT<=0) return;
  const p=1-jetT/5, a=clamp(Math.min(p*6,jetT),0,1);
  const lead=-0.15*W+p*1.35*W, y0=horizon*0.62;
  const form=[[0,0],[-1,1],[-1,-1],[-2,2],[-2,-2]];
  form.forEach(([fx,fy],i)=>{
    const x=lead+fx*W*0.045, y=y0+fy*horizon*0.035;
    const g=ctx.createLinearGradient(x-W*0.6,0,x,0);
    const tc=i%2?[255,255,255]:[230,50,60];
    g.addColorStop(0,css(tc,0)); g.addColorStop(1,css(tc,0.75*a));
    ctx.strokeStyle=g; ctx.lineWidth=Math.max(2,H*0.006); ctx.beginPath(); ctx.moveTo(x-W*0.6,y); ctx.lineTo(x,y); ctx.stroke();
    ctx.fillStyle=`rgba(50,56,64,${a})`; ctx.beginPath(); ctx.moveTo(x+W*0.022,y); ctx.lineTo(x-W*0.008,y-W*0.009); ctx.lineTo(x-W*0.008,y+W*0.009); ctx.fill();
  });
}
function drawGround(){
  const z=zoneAt(dist);
  const g=ctx.createLinearGradient(0,horizon,0,H);
  g.addColorStop(0,css(HAZE)); g.addColorStop(1,css(lerpC(z.gL,HAZE,.25)));
  ctx.fillStyle=g; ctx.fillRect(0,horizon,W,H-horizon);
}
function drawRoad(){
  const camD=dist-PZ;
  const s0=Math.floor(camD/SEG)*SEG;
  for(let d=s0+Math.ceil(FAR/SEG)*SEG; d>=s0; d-=SEG){
    const z1=d-camD, z2=z1+SEG; if(z2<NEAR) continue;
    const zn=zoneAt(d), idx=Math.round(d/SEG), fz=Math.max(z1,NEAR);
    floorQuad(-ROAD-40,-ROAD-1.6,z1,z2,0,fc(zn.gL,fz));
    const gR = zn.water ? (idx%2?zn.gR:shade(zn.gR,1.1)) : zn.gR;
    floorQuad(ROAD+1.6,ROAD+40,z1,z2,0,fc(gR,fz));
    const wk=fc(idx%2?zn.walk:shade(zn.walk,.95),fz);
    floorQuad(-ROAD-1.6,-ROAD,z1,z2,0,wk); floorQuad(ROAD,ROAD+1.6,z1,z2,0,wk);
    floorQuad(-ROAD,ROAD,z1,z2,0,fc(idx%2?zn.road:zn.roadB,fz));
    const kerb=fc([232,228,214],fz);
    floorQuad(-ROAD-0.12,-ROAD,z1,z2,0.01,kerb); floorQuad(ROAD,ROAD+0.12,z1,z2,0.01,kerb);
    if(idx%2===0){ const ln=fc([246,240,226],fz); floorQuad(-LANE_W/2-0.05,-LANE_W/2+0.05,z1,z2-0.9,0.01,ln); floorQuad(LANE_W/2-0.05,LANE_W/2+0.05,z1,z2-0.9,0.01,ln); }
    if(zn.water){ // promenade railing along the bay
      const rail=[205,208,210], rx=ROAD+1.55;
      if(z1>NEAR) faceQuad(rx-0.04,rx+0.04,0,1.05,z1,fc(rail,z1));
      poly([P(rx,1.0,fz),P(rx,1.08,fz),P(rx,1.08,z2),P(rx,1.0,z2)],fc(rail,fz));
      poly([P(rx,0.55,fz),P(rx,0.6,fz),P(rx,0.6,z2),P(rx,0.55,z2)],fc(rail,fz));
    }
  }
}

function drawBuilding(b,z1){
  const z2=z1+b.len, side=b.side;
  if(b.t==='hdb'){
    const xw=side*(ROAD+2.4);
    wallQuad(xw,z1,z2,0,b.h,b.col);
    wallQuad(xw,z1,z2,0,1.7,shade(b.col,.42));
    for(let pz=0.2;pz<b.len;pz+=2.3) wallQuad(xw,z1+pz,z1+pz+0.35,0,1.7,shade(b.col,.92));
    for(let y=2.4;y<b.h-0.4;y+=1.05) wallQuad(xw,z1,z2,y,y+0.16,shade(b.col,.72));
    wallQuad(xw,z1,z2,b.h-0.35,b.h,shade(b.col,.85));
    if(z1>NEAR){
      faceQuad(xw,xw+side*b.dep,0,b.h,z1,fc(shade(b.col,.86),z1));
      faceQuad(xw,xw+side*b.dep,0,1.7,z1,fc(shade(b.col,.4),z1));
      label('BLK '+b.num,xw+side*b.dep/2,b.h-1.2,z1,0.62,shade(b.col,.45),'700');
    }
  } else if(b.t==='shop'){
    const xw=side*(ROAD+1.9);
    wallQuad(xw,z1,z2,0,b.h,b.col);
    wallQuad(xw,z1+0.25,z2-0.25,0,2.4,shade(b.col,.45));
    wallQuad(xw,z1+0.7,z1+1.8,2.9,4.0,b.shut);
    wallQuad(xw,z1+2.7,z1+3.8,2.9,4.0,b.shut);
    wallQuad(xw,z1,z2,b.h-0.4,b.h,[172,84,58]);
    if(z1>NEAR) faceQuad(xw,xw+side*b.dep,0,b.h,z1,fc(shade(b.col,.85),z1));
    const zm=z1+b.len/2;
    if(zm>NEAR){ const p=P(xw-side*0.35,2.45,zm), r=0.2*f/zm; ell(p[0],p[1],r,r*1.15,fc([214,40,36],zm)); ell(p[0],p[1]-r*1.1,r*.45,r*.18,fc([230,180,60],zm)); }
  } else if(b.t==='tower'){
    const xw=side*(ROAD+3.4);
    wallQuad(xw,z1,z2,0,b.h,b.col);
    const ln=shade(b.col,.78);
    for(let y=1.4;y<b.h;y+=1.4) wallQuad(xw,z1,z2,y,y+0.1,ln);
    for(let pz=1.5;pz<b.len;pz+=1.5) wallQuad(xw,z1+pz,z1+pz+0.1,0,b.h,ln);
    if(z1>NEAR) faceQuad(xw,xw+side*b.dep,0,b.h,z1,fc(shade(b.col,.8),z1));
  } else if(b.t==='hawker'){
    const xw=side*(ROAD+2.2), roof=[176,184,188];
    wallQuad(xw,z1,z2,0,3.4,[46,44,42]);
    // stall signboards inside
    b.stalls.forEach(([name,col],i)=>{
      const za=z1+0.8+i*3.6, zb=za+3.0;
      wallQuad(xw,za,zb,2.4,3.0,col);
      wallQuad(xw,za,zb,0,1.0,[150,150,146]);
      label(name,xw-side*0.05,2.7,za+1.5,0.2,[255,255,255]);
    });
    for(let pz=0;pz<=b.len;pz+=4) wallQuad(xw,z1+pz-0.15,z1+pz+0.15,0,3.4,[210,206,196]);
    wallQuad(xw,z1,z2,3.4,b.h,roof);
    if(z1>NEAR){
      const a=P(xw,0,z1), bb=P(xw,3.4,z1), c=P(xw+side*b.dep/2,b.h+1.3,z1), d=P(xw+side*b.dep,3.4,z1), e=P(xw+side*b.dep,0,z1);
      poly([a,bb,c,d,e],fc([214,208,196],z1));
      poly([bb,c,d,P(xw+side*b.dep,3.0,z1),P(xw,3.0,z1)],fc(roof,z1));
      label('HAWKER CENTRE',xw+side*b.dep/2,2.2,z1,0.42,[120,60,40]);
    }
  } else if(b.t==='carpark'){
    const xw=side*(ROAD+2.4), grey=[196,196,190];
    wallQuad(xw,z1,z2,0,b.h,grey);
    for(let y=1.0;y<b.h-0.6;y+=1.6) wallQuad(xw,z1+0.4,z2-0.4,y,y+0.9,[70,72,76]);
    if(z1>NEAR){
      faceQuad(xw,xw+side*b.dep,0,b.h,z1,fc(shade(grey,.88),z1));
      const cx=xw+side*1.4;
      faceQuad(cx-0.55,cx+0.55,b.h-2.0,b.h-0.9,z1,fc([30,90,170],z1));
      label('P',cx,b.h-1.45,z1,0.8,[255,255,255],'800','Bungee, Impact, sans-serif');
      label('SEASON PARKING ONLY',xw+side*b.dep/2+side*0.6,1.6,z1,0.3,[60,60,60]);
    }
  } else if(b.t==='temple'){
    const xw=side*(ROAD+2.0), red=[176,40,36], gold=[226,176,60], tile=[50,120,80];
    wallQuad(xw,z1,z2,0,3.6,red);
    for(const dz of [2.2,5.5,8.8]) wallQuad(xw,z1+dz-0.6,z1+dz+0.6,0,2.4,[110,24,22]);
    wallQuad(xw,z1,z2,3.6,3.8,gold);
    wallQuad(xw,z1-0.3,z2+0.3,3.8,4.4,tile);
    wallQuad(xw,z1+1.5,z2-1.5,4.4,5.1,red);
    wallQuad(xw,z1+1.2,z2-1.2,5.1,5.7,tile);
    if(z1>NEAR){
      faceQuad(xw,xw+side*b.dep,0,3.8,z1,fc(shade(red,.9),z1));
      const x0=xw-side*0.4, x1=xw+side*(b.dep+0.4);
      poly([P(x0,4.7,z1),P(x0+side*0.6,3.8,z1),P(x1-side*0.6,3.8,z1),P(x1,4.7,z1),P(x1-side*1.2,4.4,z1),P(x0+side*1.2,4.4,z1)],fc(tile,z1));
      poly([P(xw+side*0.9,5.9,z1),P(xw+side*1.5,5.1,z1),P(xw+side*(b.dep-1.5),5.1,z1),P(xw+side*(b.dep-0.9),5.9,z1),P(xw+side*(b.dep-1.9),5.6,z1),P(xw+side*1.9,5.6,z1)],fc(tile,z1));
      faceQuad(xw+side*(b.dep/2-0.8),xw+side*(b.dep/2+0.8),0.0,2.4,z1,fc([110,24,22],z1));
      const lp=P(xw+side*(b.dep/2),3.0,z1), r=0.28*f/z1; ell(lp[0],lp[1],r,r*1.2,fc([240,60,40],z1));
    }
    // incense smoke, adding to the haze
    const zm=z1+b.len/2;
    if(zm>NEAR && zm<60){ for(let i=0;i<3;i++){ const ph=(t*0.3+i/3)%1; const p=P(xw-side*0.5,1.4+ph*2.5,zm+i*0.6); const k=f/zm; ell(p[0],p[1],(0.15+ph*0.4)*k,(0.12+ph*0.2)*k,`rgba(230,230,230,${0.35*(1-ph)*(1-fogAt(zm))})`); } }
  } else if(b.t==='gopuram'){
    const xw=side*(ROAD+2.0);
    const tiers=[[236,120,150],[110,170,220],[246,206,90],[130,196,120],[236,150,90],[180,120,200],[110,170,220]];
    wallQuad(xw,z1,z2,0,3.2,[236,222,196]);
    wallQuad(xw,z1+2.6,z2-2.6,0,2.6,[90,60,40]);
    tiers.forEach((c,i)=>{
      const za=z1+0.32*(i+1), zb=z2-0.32*(i+1), y0=3.2+i*1.3;
      wallQuad(xw,za,zb,y0,y0+1.3,c);
      wallQuad(xw,za,zb,y0,y0+0.15,shade(c,.7));
      for(let pz=za+0.4;pz<zb-0.2;pz+=0.7) wallQuad(xw,pz,pz+0.18,y0+0.35,y0+1.0,shade(c,.8));
      if(z1+0.32*(i+1)>NEAR) faceQuad(xw+side*0.32*i,xw+side*(b.dep-0.32*i),y0,y0+1.3,za,fc(shade(c,.9),za));
    });
    const top=3.2+tiers.length*1.3, zt=z1+0.32*8;
    wallQuad(xw,zt,z2-0.32*8,top,top+0.5,[226,176,60]);
    if(z1>NEAR) faceQuad(xw,xw+side*b.dep,0,3.2,z1,fc([226,212,186],z1));
  } else if(b.t==='mall'){
    const xw=side*(ROAD+2.2), zm=z1+b.len/2;
    wallQuad(xw,z1,z2,0,b.h,[222,226,230]);
    for(let y=3.7;y<b.h-1.2;y+=1.6) wallQuad(xw,z1+0.5,z2-0.5,y,y+1.0,[120,170,196]);
    wallQuad(xw,z1,z2,b.h-0.9,b.h,[206,56,66]);
    wallQuad(xw,zm-2.4,zm+2.4,3.0,3.35,[60,70,80]);
    wallQuad(xw,zm-2.2,zm+2.2,0,3.0,[168,222,240]);
    wallQuad(xw,zm-0.05,zm+0.05,0,3.0,[90,110,120]);
    if(z1>NEAR){
      faceQuad(xw,xw+side*b.dep,0,b.h,z1,fc([200,206,212],z1));
      faceQuad(xw,xw+side*b.dep,b.h-0.9,b.h,z1,fc([180,46,56],z1));
      label('SALE',xw+side*b.dep/2,b.h-0.45,z1,0.55,[255,240,220]);
      label('MALL',xw+side*b.dep/2,b.h-2.2,z1,0.9,[60,80,96],'800','Bungee, Impact, sans-serif');
    }
    if(zm>NEAR && zm<70){
      const k=f/zm, a=1-fogAt(zm);
      for(let i=0;i<5;i++){
        const ph=(t*0.55+i/5)%1;
        const p=P(side*(ROAD+1.5-ph*2.6),0.5+(i%3)*0.35,zm+(i-2)*0.8);
        ell(p[0],p[1],(0.5+ph*0.5)*k,0.16*k,`rgba(205,240,255,${0.4*(1-ph)*a})`);
      }
      if(state==='play' && !b.used) label('AIRCON →'.replace('→',side<0?'←':'→'),side*(ROAD+0.9),2.3,zm,0.3,[40,110,150]);
    }
  }
}
function drawTree(s,z){
  const x=s.side*(ROAD+1.05);
  faceQuad(x-0.14,x+0.14,0,2.6,z,fc([96,70,52],z));
  const c=P(x,3.1,z), k=f/z;
  ell(c[0],c[1]+0.15*k,1.8*k,0.6*k,fc([52,92,56],z));
  ell(c[0],c[1],1.6*k,0.75*k,fc([72,122,70],z));
}
function drawLamp(s,z){
  const x=s.side*(ROAD+0.5);
  faceQuad(x-0.05,x+0.05,0,4.6,z,fc([70,74,80],z));
  faceQuad(x-0.05,x-s.side*0.7,4.5,4.62,z,fc([70,74,80],z));
  const p=P(x-s.side*0.7,4.45,z); ell(p[0],p[1],0.14*f/z,0.06*f/z,fc([255,226,160],z));
}

function drawLink(s,z1){ // HDB covered linkway along the left footpath
  const z2=z1+s.len, x0=-(ROAD+1.5), x1=-(ROAD+0.15), roofC=[96,128,150];
  for(let pz=0;pz<s.len;pz+=3){ const z=z1+pz; if(z>NEAR){ faceQuad(x1-0.06,x1+0.06,0,2.6,z,fc([190,190,184],z)); faceQuad(x0-0.06,x0+0.06,0,2.6,z,fc([190,190,184],z)); } }
  floorQuad(x0-0.15,x1+0.15,z1,z2,2.65,fc(roofC,Math.max(z1,NEAR)));
  if(z1>NEAR) faceQuad(x0-0.15,x1+0.15,2.55,2.75,z1,fc(shade(roofC,.8),z1));
}
function drawLanternLine(s,z){
  if(z<4) return;
  const xa=-(ROAD+1.9), xb=ROAD+1.9, n=9;
  const pts=[]; for(let i=0;i<=n;i++){ const x=xa+(xb-xa)*i/n; pts.push(P(x,5.6-Math.sin(Math.PI*i/n)*0.5,z)); }
  ctx.strokeStyle=fc([60,40,30],z); ctx.lineWidth=Math.max(1,0.02*f/z); ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke();
  for(let i=1;i<n;i++){ const p=pts[i], r=0.2*f/z; ell(p[0],p[1]+r*1.3,r,r*1.15,fc([214,36,34],z)); ell(p[0],p[1]+r*2.6,r*0.3,r*0.25,fc([236,186,60],z)); }
}
function drawSign(s,z){
  if(z<NEAR) return;
  const x=s.side*(ROAD+0.35);
  faceQuad(x-0.04,x+0.04,0,2.75,z,fc([120,124,128],z));
  faceQuad(x-0.85,x+0.85,2.3,2.75,z,fc([24,110,72],z));
  faceQuad(x-0.8,x+0.8,2.33,2.72,z,fc([36,124,84],z));
  label(s.txt,x,2.525,z,0.2,[255,255,255],'700');
}
function drawStall(s,z1){
  const x0=s.side*(ROAD+0.25), x1=s.side*(ROAD+1.45), z2=z1+s.len;
  if(z1>NEAR){ faceQuad(x0,x0+s.side*0.05,0,2.2,z1,fc([90,90,90],z1)); faceQuad(x1,x1-s.side*0.05,0,2.2,z1,fc([90,90,90],z1)); }
  floorQuad(Math.min(x0,x1),Math.max(x0,x1),z1,z2,2.3,fc([200,50,46],Math.max(z1,NEAR)));
  if(z1>NEAR){
    faceQuad(x0,x1,2.0,2.3,z1,fc([220,70,60],z1));
    faceQuad(x0+s.side*0.1,x1-s.side*0.1,0,0.85,z1+0.3,fc([150,104,62],z1));
    for(let i=0;i<4;i++){ const gx=x0+s.side*(0.25+i*0.25); faceQuad(gx-0.09,gx+0.09,0.85,1.0,z1+0.35,fc(i%2?s.goods:shade(s.goods,.8),z1)); }
  }
}
function drawBoat(s,z){
  if(z<NEAR) return;
  const x=s.x+Math.sin(t*0.4+s.ph)*0.6, bob=Math.sin(t*1.6+s.ph)*0.05;
  faceQuad(x-1.4,x+1.4,-0.1+bob,0.45+bob,z,fc(s.col,z));
  faceQuad(x-1.4,x+1.4,0.38+bob,0.45+bob,z,fc([240,236,226],z));
  faceQuad(x-0.9,x+0.9,1.25+bob,1.4+bob,z,fc([120,40,30],z));
  faceQuad(x-0.85,x-0.75,0.45+bob,1.25+bob,z,fc([90,60,40],z)); faceQuad(x+0.75,x+0.85,0.45+bob,1.25+bob,z,fc([90,60,40],z));
}

// ---------- new obstacles ----------
function drawBarrier(o,z){
  const x=o.x;
  line3(x-0.55,0,x-0.5,0.8,z,[60,60,60],0.04); line3(x+0.55,0,x+0.5,0.8,z,[60,60,60],0.04);
  for(let i=0;i<6;i++){ const xa=x-0.62+i*0.207; faceQuad(xa,xa+0.207,0.42,0.8,z,fc(i%2?[245,245,240]:[226,70,40],z)); }
  faceQuad(x-0.36,x+0.36,0.44,0.78,z,fc([255,255,255],z));
  label('SORRY FOR THE',x,0.67,z,0.085,[40,40,40]);
  label('INCONVENIENCE',x,0.54,z,0.085,[40,40,40]);
  const p=P(x+0.56,0.88,z); ell(p[0],p[1],0.05*f/z,0.05*f/z,Math.sin(t*8)>0?'rgba(255,170,40,.95)':'rgba(140,80,20,.7)');
}
function drawLowLantern(o,z){
  const x=o.x;
  faceQuad(x-0.78,x-0.72,0,1.7,z,fc([120,60,40],z)); faceQuad(x+0.72,x+0.78,0,1.7,z,fc([120,60,40],z));
  line3(x-0.75,1.6,x,1.5,z,[60,40,30],0.015); line3(x,1.5,x+0.75,1.6,z,[60,40,30],0.015);
  for(const lx of [-0.5,-0.17,0.17,0.5]){ const sw=Math.sin(t*2+lx*4)*0.02; const p=P(x+lx+sw,1.3,z), r=0.15*f/z; ell(p[0],p[1],r,r*1.15,fc([214,36,34],z)); ell(p[0],p[1]-r*1.05,r*0.5,r*0.15,fc([236,186,60],z)); faceQuad(x+lx+sw-0.015,x+lx+sw+0.015,1.0,1.15,z,fc([236,186,60],z)); }
}
function drawSelfie(o,z){
  if(z<NEAR) return;
  const side=Math.sign(o.x)||1, tx=side*(ROAD+0.35);
  drawPerson(tx,z,0,[250,250,246],[90,130,180],[30,24,20],{hat:[236,220,180]});
  line3(tx-side*0.3,1.25,o.x-side*0.85,1.38,z,[40,40,44],0.035);
  faceQuad(o.x-side*0.85-0.08,o.x-side*0.85+0.08,1.3,1.5,z,fc([20,20,24],z));
  label('SAY CHEESE!',o.x,1.8,z,0.17,[255,255,255]);
}
function drawBunting(o,z){
  const x=o.x;
  faceQuad(x-0.78,x-0.72,0,1.75,z,fc([200,200,200],z)); faceQuad(x+0.72,x+0.78,0,1.75,z,fc([200,200,200],z));
  line3(x-0.75,1.62,x,1.52,z,[80,80,80],0.012); line3(x,1.52,x+0.75,1.62,z,[80,80,80],0.012);
  for(let i=0;i<7;i++){ const xa=x-0.7+i*0.2, top=1.6-Math.sin(Math.PI*(i+0.5)/7)*0.1; poly([P(xa,top,z),P(xa+0.18,top,z),P(xa+0.09,1.12,z)],fc(i%2?[255,255,255]:[214,40,48],z)); }
}
function drawKarung(o,z){
  const x=o.x;
  if(z+1>NEAR) drawPerson(x,z+1,0.3,[220,200,150],[60,70,80],[220,220,220],{back:true,h:1.5});
  if(z<NEAR) return;
  for(const wx of [-0.45,0.45]){ const p=P(x+wx,0.2,z); ell(p[0],p[1],0.2*f/z,0.2*f/z,fc([30,30,30],z)); }
  faceQuad(x-0.55,x+0.55,0.35,1.05,z,fc([70,110,150],z));
  const papers=[[214,208,190],[176,140,98],[220,214,198],[160,126,86],[210,204,186]];
  papers.forEach((c,i)=>faceQuad(x-0.5+(i%2)*0.04,x+0.48,1.05+i*0.12,1.17+i*0.12,z,fc(c,z)));
  if(z<35) label('KARUNG GUNI!',x,2.35,z,0.2,[255,255,255]);
}
function drawDelivery(o,z){
  if(z<NEAR) return;
  const x=o.x;
  const p=P(x,0.28,z+0.3); ell(p[0],p[1],0.06*f/z,0.28*f/z,fc([30,30,30],z));
  drawPerson(x,z+0.25,0.35,[70,70,80],[40,40,50],[30,30,30],{back:true,h:1.5});
  const hp=P(x,1.78,z+0.25); ell(hp[0],hp[1],0.17*f/(z+0.25),0.15*f/(z+0.25),fc([240,240,236],z));
  faceQuad(x-0.33,x+0.33,1.0,1.72,z,fc([246,196,40],z));
  faceQuad(x-0.33,x+0.33,1.6,1.65,z,fc([200,150,20],z));
  faceQuad(x-0.06,x+0.06,0.55,0.62,z,fc([230,40,40],z));
  if(z<35) label('ORDER ARRIVING',x,2.2,z,0.17,[255,255,255]);
}
function drawFogging(o,z){
  if(z<NEAR) return;
  const x=o.x, a=1-fogAt(z);
  drawPerson(x,z+0.4,0,[236,236,232],[236,236,232],[40,40,40],{h:1.65});
  faceQuad(x-0.1,x+0.1,1.42,1.5,z+0.4,fc([255,255,255],z));
  line3(x+0.28,1.0,x+0.7,1.3,z+0.4,[60,60,60],0.03);
  const k=f/z;
  for(let i=0;i<9;i++){ const p=P(x+Math.sin(i*1.7+t*0.8)*0.75,0.35+(i%4)*0.38,z+(i%3)*0.35); ell(p[0],p[1],(0.45+(i%3)*0.15)*k,(0.3+(i%2)*0.1)*k,`rgba(245,245,245,${(o.hit?0.35:0.55)*a})`); }
  if(z<40) label('FOGGING IN PROGRESS',x,2.3,z,0.16,[255,255,255]);
}
function drawLionDanceBody(o,z){
  const x=o.x, b=Math.abs(Math.sin(t*6))*0.15, red=[210,36,30], gold=[236,186,60];
  sideWall(x-0.45,z+0.3,z+1.9,0.55+b*0.5,1.4+b*0.5,red);
  sideWall(x+0.45,z+0.3,z+1.9,0.55+b*0.5,1.4+b*0.5,red);
  sideWall(x-0.45,z+0.3,z+1.9,0.5+b*0.5,0.62+b*0.5,gold);
  sideWall(x+0.45,z+0.3,z+1.9,0.5+b*0.5,0.62+b*0.5,gold);
  if(z+1.85>NEAR){ faceQuad(x-0.3,x-0.12,0,0.6,z+1.85,fc(gold,z+1.85)); faceQuad(x+0.12,x+0.3,0,0.6,z+1.85,fc(gold,z+1.85)); }
  if(z<NEAR) return;
  faceQuad(x-0.3,x-0.12,0,0.75,z+0.2,fc(gold,z)); faceQuad(x+0.12,x+0.3,0,0.75,z+0.2,fc(gold,z));
  faceQuad(x-0.5,x+0.5,0.75+b,1.8+b,z,fc(red,z));
  faceQuad(x-0.5,x+0.5,1.65+b,1.8+b,z,fc(gold,z));
  faceQuad(x-0.32,x+0.32,0.85+b,1.05+b,z,fc([40,20,20],z));
  const k=f/z;
  for(const ex of [-0.2,0.2]){ const p=P(x+ex,1.42+b,z); ell(p[0],p[1],0.13*k,0.12*k,fc([255,255,255],z)); ell(p[0]+Math.sin(t*3)*0.03*k,p[1],0.06*k,0.06*k,fc([20,20,20],z)); }
  const hn=P(x,1.92+b,z); ell(hn[0],hn[1],0.1*k,0.08*k,fc(gold,z));
  const bd=P(x,0.78+b,z); ell(bd[0],bd[1],0.42*k,0.08*k,fc([250,250,250],z));
  if(z<30) label('HUAT AH!',x,2.35,z,0.22,[255,230,120]);
}
function drawTourGroup(o,z){
  const x=o.x, zg=z+2.6;
  if(zg>NEAR){
    drawPerson(x-0.1,zg,0,[240,200,60],[60,60,70],[30,24,20],{back:true});
    line3(x+0.22,1.0,x+0.22,2.6,zg,[80,80,80],0.025);
    poly([P(x+0.22,2.6,zg),P(x+0.7,2.48,zg),P(x+0.22,2.34,zg)],fc([246,206,40],zg));
    if(zg<40) label('THIS WAY PLEASE',x,2.95,zg,0.17,[255,255,255]);
  }
  const spots=[[0.25,1.9],[-0.25,1.6],[0.2,1.0],[-0.28,0.7],[0.05,0.15]];
  spots.forEach(([dx,dz],i)=>{ const pz=z+dz; if(pz>NEAR) drawPerson(x+dx,pz,0,SHIRTS[(i*3+1)%SHIRTS.length],[90,90,100],[40,32,28],{back:true,hat:i%2?[250,250,246]:[236,220,180]}); });
}
function drawWedding(o,z){
  const x=o.x, zc=z+2.4;
  if(zc>NEAR){
    floorQuad(x+0.0,x+0.55,z+0.7,zc,0.01,fc([252,252,250],Math.max(z+0.7,NEAR)));
    drawPerson(x-0.28,zc,0,[30,30,36],[30,30,36],[30,24,20],{h:1.7,sleeve:[30,30,36]});
    faceQuad(x-0.33,x-0.23,1.05,1.38,zc,fc([250,250,250],zc));
    const bx=x+0.28;
    poly([P(bx-0.45,0,zc),P(bx+0.45,0,zc),P(bx+0.14,1.0,zc),P(bx-0.14,1.0,zc)],fc([252,252,250],zc));
    faceQuad(bx-0.14,bx+0.14,1.0,1.36,zc,fc([252,252,250],zc));
    const k=f/zc, hp=P(bx,1.5,zc);
    ell(hp[0],hp[1]+0.05*k,0.24*k,0.3*k,`rgba(255,255,255,${0.45*(1-fogAt(zc))})`);
    ell(hp[0],hp[1],0.13*k,0.14*k,fc([206,160,120],zc));
    ell(hp[0],hp[1]-0.08*k,0.14*k,0.08*k,fc([40,30,24],zc));
    if(zc<40) label('ONE MORE SHOT!',x,2.25,zc,0.18,[255,255,255]);
  }
  if(z<NEAR) return;
  drawPerson(x,z,0,[40,40,44],[40,40,44],[30,30,30],{back:true,h:1.2});
  faceQuad(x-0.12,x+0.12,0.88,1.04,z,fc([20,20,22],z));
  if(Math.sin(t*2.5)>0.93){ const p=P(x,0.96,z); ell(p[0],p[1],0.5*f/z,0.5*f/z,'rgba(255,255,255,.55)'); }
}

// ---------- obstacle drawing ----------
function drawPerson(x,z,yo,shirt,pants,hair,o={}){
  if(z<NEAR) return;
  const h=o.h||1.62, skin=o.skin||[196,146,104];
  faceQuad(x-0.17,x-0.03,yo,yo+0.78,z,fc(pants,z)); faceQuad(x+0.03,x+0.17,yo,yo+0.78,z,fc(pants,z));
  faceQuad(x-0.3,x-0.22,yo+0.85,yo+h-0.36,z,fc(o.sleeve||skin,z));
  faceQuad(x+0.22,x+0.3,yo+0.85,yo+h-0.36,z,fc(o.sleeve||skin,z));
  faceQuad(x-0.24,x+0.24,yo+0.74,yo+h-0.3,z,fc(shirt,z));
  if(o.dots){ for(let i=0;i<4;i++) faceQuad(x-0.16+i*0.1,x-0.12+i*0.1,yo+0.95+(i%2)*0.2,yo+0.99+(i%2)*0.2,z,fc(o.dots,z)); }
  const k=f/z, hp=P(x,yo+h-0.15,z);
  ell(hp[0],hp[1],0.14*k,0.15*k,fc(o.back?hair:skin,z));
  if(o.perm) ell(hp[0],hp[1]-0.07*k,0.2*k,0.13*k,fc(hair,z));
  else if(!o.back) ell(hp[0],hp[1]-0.08*k,0.145*k,0.08*k,fc(hair,z));
  if(o.hat){ ell(hp[0],hp[1]-0.1*k,0.3*k,0.07*k,fc(o.hat,z)); ell(hp[0],hp[1]-0.14*k,0.15*k,0.09*k,fc(o.hat,z)); }
  if(o.shades) faceQuad(x-0.11,x+0.11,yo+h-0.16,yo+h-0.11,z,fc([20,20,20],z));
}
function durianAt(x,y,z,r,col){
  const p=P(x,y,z), R=r*f/z;
  ell(p[0],p[1],R,R*0.92,fc(col||[108,124,44],z));
  ctx.fillStyle=fc(shade(col||[108,124,44],.75),z);
  for(let a=0;a<8;a++){ const ang=a/8*Math.PI*2; ctx.beginPath(); ctx.moveTo(p[0]+Math.cos(ang)*R*0.8,p[1]+Math.sin(ang)*R*0.75); ctx.lineTo(p[0]+Math.cos(ang)*R*1.25,p[1]+Math.sin(ang)*R*1.15); ctx.lineTo(p[0]+Math.cos(ang+.3)*R*0.8,p[1]+Math.sin(ang+.3)*R*0.75); ctx.fill(); }
}
function drawCrate(o,z){
  const x=o.x, w=0.62, h=0.72, wood=[150,104,62];
  floorQuad(x-w,x+w,z,z+0.7,h,fc(shade(wood,1.15),z));
  faceQuad(x-w,x+w,0,h,z,fc(wood,z));
  for(let i=1;i<3;i++) faceQuad(x-w,x+w,i*h/3-0.03,i*h/3+0.03,z,fc(shade(wood,.75),z));
  for(const dx of [-0.32,0,0.32]) durianAt(x+dx,h+0.2,z+0.3,0.22);
  label('DURIAN',x,h*0.42,z,0.2,[196,40,30]);
}
function drawChope(o,z){
  const x=o.x, top=[236,232,224];
  // stools in front
  for(const dx of [-0.38,0.38]){ faceQuad(x+dx-0.04,x+dx+0.04,0,0.42,z,fc([90,90,96],z)); const p=P(x+dx,0.44,z); ell(p[0],p[1],0.17*f/z,0.05*f/z,fc([230,116,48],z)); }
  const zt=z+0.25;
  faceQuad(x-0.06,x+0.06,0,0.74,zt+0.45,fc([110,110,116],zt));
  floorQuad(x-0.58,x+0.58,zt,zt+0.9,0.78,fc(top,zt));
  faceQuad(x-0.58,x+0.58,0.72,0.78,zt,fc(shade(top,.8),zt));
  // tissue packet
  const tz=zt+0.35;
  faceQuad(x+0.02,x+0.3,0.78,0.88,tz,fc([252,252,250],tz));
  faceQuad(x+0.06,x+0.26,0.82,0.85,tz,fc([240,120,160],tz));
  label('CHOPED',x,1.12,tz,0.15,[255,255,255],'800');
}
function drawBikes(o,z){
  const cols=[[240,200,40],[240,120,40]];
  [[0.4,0.22,cols[1]],[0,0,cols[0]]].forEach(([dz,dy,c])=>{
    const zz=z+dz, x=o.x+(dz?0.12:0), k=f/zz;
    if(zz<NEAR) return;
    ctx.lineWidth=Math.max(1,0.05*k); ctx.strokeStyle=fc([30,30,30],zz);
    for(const wx of [-0.42,0.42]){ const p=P(x+wx,0.32+dy,zz); ctx.beginPath(); ctx.arc(p[0],p[1],0.3*k,0,Math.PI*2); ctx.stroke(); }
    line3(x-0.42,0.32+dy,x,0.3+dy,zz,c,0.06); line3(x,0.3+dy,x+0.42,0.32+dy,zz,c,0.06);
    line3(x-0.42,0.32+dy,x-0.15,0.68+dy,zz,c,0.06); line3(x-0.15,0.68+dy,x+0.3,0.66+dy,zz,c,0.06);
    line3(x+0.3,0.66+dy,x+0.42,0.32+dy,zz,c,0.06); line3(x,0.3+dy,x-0.15,0.68+dy,zz,c,0.06);
    line3(x+0.3,0.66+dy,x+0.34,0.82+dy,zz,[40,40,40],0.04);
  });
}
function drawTrolley(o,z){
  const x=o.x, red=[200,46,52];
  const sp=t*o.vx*3;
  for(const wx of [-0.2,0.2]){ const p=P(x+wx,0.1,z); ell(p[0],p[1],0.1*f/z,0.1*f/z,fc([30,30,30],z)); }
  faceQuad(x-0.03,x+0.03,0.8,1.1,z+0.15,fc([120,120,126],z));
  faceQuad(x-0.18,x+0.18,1.06,1.1,z+0.15,fc([120,120,126],z));
  faceQuad(x-0.28,x+0.28,0.18,0.86,z,fc(red,z));
  for(const yy of [0.35,0.6]) faceQuad(x-0.28,x+0.28,yy,yy+0.05,z,fc([40,110,70],z));
  for(const xx of [-0.12,0.12]) faceQuad(x+xx-0.025,x+xx+0.025,0.18,0.86,z,fc([40,110,70],z));
  faceQuad(x-0.28,x+0.28,0.47,0.49,z,fc([240,210,90],z));
  if(Math.abs(sp)>0) label('wheee',x,1.35,z,0.16,[255,255,255],'800');
}
function drawCat(o,z){
  const x=o.x, k=f/z, ginger=[226,142,60];
  const b=P(x,0.16,z); ell(b[0],b[1],0.34*k,0.15*k,fc(ginger,z));
  for(const sx of [-0.14,0.02,0.18]) faceQuad(x+sx-0.03,x+sx+0.03,0.05,0.28,z,fc(shade(ginger,.75),z));
  const hp=P(x+0.3,0.22,z); ell(hp[0],hp[1],0.13*k,0.12*k,fc(ginger,z));
  ctx.fillStyle=fc(ginger,z);
  ctx.beginPath(); ctx.moveTo(hp[0]+0.02*k,hp[1]-0.08*k); ctx.lineTo(hp[0]+0.1*k,hp[1]-0.2*k); ctx.lineTo(hp[0]+0.13*k,hp[1]-0.05*k); ctx.fill();
  // ear-tipped left ear (community cat)
  ctx.beginPath(); ctx.moveTo(hp[0]-0.12*k,hp[1]-0.05*k); ctx.lineTo(hp[0]-0.1*k,hp[1]-0.15*k); ctx.lineTo(hp[0]-0.03*k,hp[1]-0.15*k); ctx.lineTo(hp[0]-0.01*k,hp[1]-0.08*k); ctx.fill();
  ctx.strokeStyle=fc([60,40,30],z); ctx.lineWidth=Math.max(1,0.015*k);
  ctx.beginPath(); ctx.moveTo(hp[0]-0.06*k,hp[1]); ctx.lineTo(hp[0]-0.01*k,hp[1]); ctx.moveTo(hp[0]+0.03*k,hp[1]); ctx.lineTo(hp[0]+0.08*k,hp[1]); ctx.stroke();
  const tp=P(x-0.36,0.12,z); ell(tp[0],tp[1],0.16*k,0.05*k,fc(shade(ginger,.9),z));
  const zz=(t*1.2)%1;
  label('z',x+0.42,0.5+zz*0.3,z,0.14+zz*0.06,[255,255,255]);
  label('z',x+0.56,0.75+zz*0.3,z,0.1+zz*0.05,[255,255,255]);
}
function drawOtters(o,z){
  const dir=Math.sign(o.vx)||1, k=f/z, brown=[104,72,48];
  for(let i=0;i<5;i++){
    const ox=o.x+(i-2)*0.38*-dir, oz=z+((i%2)*0.25), s=i===0?1.15:(i===4?0.75:0.9);
    const bob=Math.abs(Math.sin(t*9+i))*0.04;
    const kk=f/oz, b=P(ox,0.15+bob,oz);
    ell(b[0],b[1],0.2*s*kk,0.1*s*kk,fc(brown,oz));
    const hp=P(ox+dir*0.2*s,0.24+bob,oz); ell(hp[0],hp[1],0.09*s*kk,0.08*s*kk,fc(brown,oz));
    ell(hp[0]+dir*0.04*s*kk,hp[1]+0.02*s*kk,0.04*s*kk,0.03*s*kk,fc([170,150,130],oz));
    line3(ox-dir*0.18*s,0.14+bob,ox-dir*0.36*s,0.06,oz,brown,0.05*s);
  }
}
function drawLaundry(o,z){
  const x=o.x;
  faceQuad(x-0.76,x-0.7,0,1.95,z,fc([110,110,110],z));
  faceQuad(x+0.7,x+0.76,0,1.95,z,fc([110,110,110],z));
  faceQuad(x-0.95,x+0.95,1.76,1.84,z,fc([150,130,80],z));
  faceQuad(x-0.6,x-0.2,1.02,1.72,z,fc([230,90,80],z));
  faceQuad(x-0.72,x-0.08,1.52,1.72,z,fc([230,90,80],z));
  faceQuad(x-0.12,x+0.24,0.98,1.76,z,fc([90,170,210],z));
  faceQuad(x-0.12,x+0.24,1.1,1.15,z,fc([240,240,240],z));
  faceQuad(x+0.3,x+0.66,1.3,1.74,z,fc([250,210,90],z));
  faceQuad(x+0.3,x+0.44,1.06,1.3,z,fc([250,210,90],z));
  faceQuad(x+0.52,x+0.66,1.06,1.3,z,fc([250,210,90],z));
}
function drawNoDurian(o,z){
  const x=o.x, k=f/z;
  faceQuad(x-0.78,x-0.72,0,1.95,z,fc([120,124,130],z));
  faceQuad(x+0.72,x+0.78,0,1.95,z,fc([120,124,130],z));
  faceQuad(x-0.72,x+0.72,1.02,1.9,z,fc([250,250,248],z));
  const c=P(x,1.52,z), r=0.3*k;
  durianAt(x,1.52,z,0.15);
  ctx.strokeStyle=fc([214,36,40],z); ctx.lineWidth=Math.max(1.5,0.06*k);
  ctx.beginPath(); ctx.arc(c[0],c[1],r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c[0]-r*0.7,c[1]-r*0.7); ctx.lineTo(c[0]+r*0.7,c[1]+r*0.7); ctx.stroke();
  label('NO DURIANS',x,1.12,z,0.11,[30,30,30]);
}
function drawKopi(o,z){
  const x=o.x, k=f/z;
  faceQuad(x-0.76,x-0.7,0,1.95,z,fc([110,110,110],z));
  faceQuad(x+0.7,x+0.76,0,1.95,z,fc([110,110,110],z));
  faceQuad(x-0.95,x+0.95,1.84,1.9,z,fc([150,130,80],z));
  const a=1-fogAt(z);
  for(const bx of [-0.42,0,0.42]){
    const sw=Math.sin(t*3+bx*5)*0.03, cx=x+bx+sw;
    line3(x+bx-0.06,1.86,cx-0.05,1.58,z,[240,240,240],0.015); line3(x+bx+0.06,1.86,cx+0.05,1.58,z,[240,240,240],0.015);
    const tl=P(cx-0.15,1.58,z), br=P(cx+0.15,1.02,z);
    ctx.fillStyle=`rgba(225,235,240,${0.55*a})`; ctx.beginPath(); ctx.roundRect(tl[0],tl[1],br[0]-tl[0],br[1]-tl[1],0.08*k); ctx.fill();
    const lq=P(cx-0.14,1.32,z);
    ctx.fillStyle=css(lerpC([126,78,40],HAZE,fogAt(z)),0.95); ctx.beginPath(); ctx.roundRect(lq[0],lq[1],br[0]-lq[0]-0.01*k,br[1]-lq[1],0.07*k); ctx.fill();
    for(let i=0;i<3;i++){ const ic=P(cx-0.08+i*0.07,1.25-(i%2)*0.08,z); ctx.fillStyle=`rgba(255,255,255,${0.7*a})`; ctx.fillRect(ic[0],ic[1],0.05*k,0.05*k); }
  }
  label('KOPI PENG',x,1.98,z,0.11,[255,255,255]);
}
function drawBranch(o,z){
  const side=Math.sign(o.x)||1, tx=side*(ROAD+0.9), k=f/z;
  faceQuad(tx-0.18,tx+0.18,0,3.4,z,fc([96,70,52],z));
  const c=P(tx,3.6,z); ell(c[0],c[1],1.7*k,0.8*k,fc([62,108,62],z));
  const tip=o.x-side*0.95;
  poly([P(tx,1.62,z),P(tx,1.38,z),P(tip,1.28,z),P(tip,1.36,z)],fc([110,80,58],z));
  for(let i=0;i<5;i++){ const lx=tx+(tip-tx)*(0.25+i*0.18); const p=P(lx,1.16+(i%2)*0.06,z); ell(p[0],p[1],0.24*k,0.16*k,fc(i%2?[72,128,70]:[86,142,80],z)); }
}
function fadeNear(fn){ return (o,z)=>{ const a=clamp((z-(PZ+0.5))/3.5,0,1); if(a<=0) return; ctx.save(); ctx.globalAlpha=a; fn(o,z); ctx.restore(); }; }
function drawBusBody(o,z){
  const x=o.x, hw=0.7, h=3.9, z2=z+o.len;
  if(z2<=NEAR) return;
  const green=[132,186,58], white=[236,238,232], glass=[44,56,64];
  const sx = x>camX ? x-hw : x+hw;
  sideWall(sx,z,z2,0.25,h,white);
  sideWall(sx,z,z2,0.25,1.2,green);
  if(camH>h+0.05){ // roof: seen from above on tall (portrait) screens
    const zm=z+o.len*0.5, roof=[222,225,218];
    floorQuad(x-hw,x+hw,z,z2,h,fc(roof,zm));
    floorQuad(x-hw+0.12,x+hw-0.12,z+0.15,z2-0.15,h,fc(shade(roof,0.93),zm));
    floorQuad(x-0.45,x+0.45,z+0.6,z+1.9,h+0.001,fc([150,156,160],z+1.2));
    floorQuad(x-0.45,x+0.45,z+2.4,z+3.7,h+0.001,fc([150,156,160],z+3));
  }
  sideWall(sx,z+0.3,z2-0.3,2.5,3.5,glass);
  sideWall(sx,z+1.2,z2-0.5,1.5,2.2,glass);
  sideWall(sx,z+0.4,z+1.3,0,0.3,[30,30,30]);
  sideWall(sx,z2-1.3,z2-0.4,0,0.3,[30,30,30]);
  if(z<NEAR) return;
  faceQuad(x-hw,x+hw,0.25,h,z,fc(white,z));
  faceQuad(x-hw,x+hw,0.25,1.25,z,fc(green,z));
  faceQuad(x-hw+0.12,x+hw-0.12,2.45,3.45,z,fc(glass,z));
  faceQuad(x-hw+0.1,x-hw+0.3,0.75,1.1,z,fc([220,40,36],z));
  faceQuad(x+hw-0.3,x+hw-0.1,0.75,1.1,z,fc([220,40,36],z));
  faceQuad(x-0.36,x+0.36,3.55,3.82,z,fc([24,24,24],z));
  label(o.svc,x,3.685,z,0.22,[255,160,40],'700','JetBrains Mono, monospace');
  faceQuad(x-hw+0.05,x-hw+0.35,0,0.3,z,fc([30,30,30],z));
  faceQuad(x+hw-0.35,x+hw-0.05,0,0.3,z,fc([30,30,30],z));
}
function drawQueue(o,z){
  const x=o.x, zEnd=z+o.len;
  // the bakery at the front of the queue
  if(zEnd>NEAR){
    faceQuad(x-0.72,x-0.66,0,2.8,zEnd,fc([90,90,96],zEnd));
    faceQuad(x+0.66,x+0.72,0,2.8,zEnd,fc([90,90,96],zEnd));
    faceQuad(x-0.8,x+0.8,2.0,2.8,zEnd,fc([255,214,226],zEnd));
    label('NEW! VIRAL',x,2.55,zEnd,0.2,[200,40,90]);
    label('BAKERY ★4.9',x,2.24,zEnd,0.2,[60,40,40]);
    faceQuad(x-0.7,x+0.7,0,1.0,zEnd,fc([200,160,120],zEnd));
  }
  for(let i=6;i>=0;i--){
    const pz=z+0.3+i*1.05, jx=Math.sin(i*2.3)*0.12;
    drawPerson(x+jx,pz,0,SHIRTS[(i+o.svc.length)%SHIRTS.length],i%2?[50,60,90]:[90,80,70],[30,24,20],{back:true,h:1.55+(i%3)*0.08});
    if(i%3===1 && pz>NEAR){ const p=P(x+jx+0.25,1.25,pz); ctx.fillStyle=fc([30,30,40],pz); ctx.fillRect(p[0],p[1],0.08*f/pz,0.14*f/pz); }
  }
}
function drawAunties(o,z){
  const blouses=[[[236,90,120],[255,220,120]],[[90,150,210],[255,255,255]],[[150,200,90],[250,120,90]]];
  for(let i=2;i>=0;i--){
    const az=z+i*1.2, ax=auntX(o,i);
    const [sh,dot]=blouses[(i+Math.floor(o.ph))%3];
    drawPerson(ax,az,0,sh,[60,50,70],i===1?[200,200,205]:[40,32,28],{perm:true,h:1.5,dots:dot,sleeve:sh});
    if(az>NEAR){ const arm=Math.sin(t*4.4+o.ph+i)*0.25; line3(ax+0.28,1.15,ax+0.5,1.45+arm,az,[196,146,104],0.06); line3(ax-0.28,1.15,ax-0.5,1.45-arm,az,[196,146,104],0.06); }
  }
  if(z>NEAR) label('♪',o.x+Math.sin(t*2)*0.4,2.0,z,0.3,[255,255,255]);
}
function drawScooter(o,z){
  if(z<NEAR) return;
  const x=o.x, k=f/z;
  faceQuad(x-0.14,x+0.14,0.08,0.18,z,fc([40,40,44],z));
  floorQuad(x-0.14,x+0.14,z,z+0.8,0.18,fc([60,60,66],z));
  faceQuad(x-0.03,x+0.03,0.18,1.25,z,fc([70,70,76],z));
  faceQuad(x-0.32,x+0.32,1.2,1.26,z,fc([40,40,44],z));
  const hl=P(x,1.05,z); ell(hl[0],hl[1],0.07*k,0.06*k,'rgba(255,240,180,.95)');
  const g=ctx.createRadialGradient(hl[0],hl[1],0,hl[0],hl[1],0.6*k); g.addColorStop(0,'rgba(255,240,180,.4)'); g.addColorStop(1,'rgba(255,240,180,0)'); ctx.fillStyle=g; ctx.fillRect(hl[0]-0.6*k,hl[1]-0.6*k,1.2*k,1.2*k);
  drawPerson(x,z+0.25,0.18,[244,244,240],[70,100,150],[200,200,205],{h:1.62,shades:true});
  if(z<30) label('EH TUMPANG!',x,2.15,z+0.25,0.18,[255,255,255]);
}
function drawErp(o,z){
  if(z<NEAR) return;
  const pw=ROAD+0.35, grey=[120,124,130];
  faceQuad(-pw-0.12,-pw+0.12,0,5.8,z,fc(grey,z));
  faceQuad(pw-0.12,pw+0.12,0,5.8,z,fc(grey,z));
  faceQuad(-pw,pw,5.0,5.75,z,fc([70,76,82],z));
  for(const l of [-1,0,1]){
    faceQuad(l*LANE_W-0.42,l*LANE_W+0.42,5.08,5.62,z,fc([16,16,18],z));
    label(o.paid?'$2.00':'$2.00',l*LANE_W,5.35,z,0.24,[255,170,40],'700','JetBrains Mono, monospace');
  }
  const blink=Math.sin(t*10)>0; const p=P(pw-0.3,5.85,z); ell(p[0],p[1],0.08*f/z,0.08*f/z,blink?'rgba(255,60,60,.95)':'rgba(120,30,30,.6)');
  label('ERP',-pw+0.6,5.85,z,0.2,[255,255,255]);
}
function drawPickup(p,z){
  const k=f/z, a=1-fogAt(z);
  const pop = p.taken ? p.pop/0.35 : 0;
  const bob=Math.sin(t*4+p.d)*0.08;
  ctx.globalAlpha=a*(1-pop);
  if(p.t==='bub'){
    const c=P(p.x,0.95+bob+pop*0.6,z), r=0.27*k*(1+pop*0.8);
    ell(c[0],c[1],r*1.5,r*1.5,'rgba(170,236,255,.18)');
    ell(c[0],c[1],r,r,'rgba(170,236,255,.45)');
    ctx.lineWidth=Math.max(1,0.03*k); ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(c[0],c[1],r,0,Math.PI*2); ctx.stroke();
    ell(c[0]-r*.35,c[1]-r*.35,r*.22,r*.14,'rgba(255,255,255,.95)');
  } else if(p.t==='mask'){
    const c=P(p.x,1.0+bob,z), r=0.38*k;
    ell(c[0],c[1],r*1.6,r*1.6,'rgba(140,230,255,.28)');
    ctx.strokeStyle='#e8f7ff'; ctx.lineWidth=Math.max(1,0.04*k);
    ctx.beginPath(); ctx.moveTo(c[0]-r*0.95,c[1]); ctx.lineTo(c[0]-r*1.4,c[1]-r*0.5); ctx.moveTo(c[0]+r*0.95,c[1]); ctx.lineTo(c[0]+r*1.4,c[1]-r*0.5); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(c[0],c[1],r,r*0.7,0,0,Math.PI*2); ctx.fillStyle='#f6fbff'; ctx.fill();
    const fs=0.2*k; if(fs>6){ ctx.fillStyle='#17201f'; ctx.font=`800 ${fs}px Figtree, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('N95',c[0],c[1]+r*0.1); ctx.textBaseline='alphabetic'; }
  } else if(p.t==='chope'){
    const c=P(p.x,1.0+bob,z), w=0.5*k, h=0.3*k;
    ell(c[0],c[1],w*1.3,w*1.3,'rgba(255,170,200,.28)');
    ctx.fillStyle='#fdfdfb'; ctx.beginPath(); ctx.roundRect(c[0]-w/2,c[1]-h/2,w,h,0.05*k); ctx.fill();
    ctx.fillStyle='#f07aa2'; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(c[0]-w*0.3+i*w*0.3,c[1]+h*0.12,0.04*k,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#d0cfc8'; ctx.fillRect(c[0]-w*0.3,c[1]-h*0.32,w*0.6,h*0.12);
    const fs=0.14*k; if(fs>6){ ctx.fillStyle='#fff'; ctx.font=`800 ${fs}px Figtree, sans-serif`; ctx.textAlign='center'; ctx.fillText('CHOPE',c[0],c[1]-h*0.9); }
  } else if(p.t==='angbao'){
    const c=P(p.x,1.0+bob,z), w=0.3*k, h=0.42*k;
    ell(c[0],c[1],w*1.6,w*1.6,'rgba(255,90,80,.25)');
    ctx.fillStyle='#d8262c'; ctx.beginPath(); ctx.roundRect(c[0]-w/2,c[1]-h/2,w,h,0.03*k); ctx.fill();
    ctx.strokeStyle='#f2c14e'; ctx.lineWidth=Math.max(1,0.02*k); ctx.strokeRect(c[0]-w/2+0.03*k,c[1]-h/2+0.03*k,w-0.06*k,h-0.06*k);
    ctx.fillStyle='#f2c14e'; ctx.beginPath(); ctx.arc(c[0],c[1]-h*0.05,w*0.22,0,Math.PI*2); ctx.fill();
    const fs=0.13*k; if(fs>6){ ctx.fillStyle='#fff'; ctx.font=`800 ${fs}px Figtree, sans-serif`; ctx.textAlign='center'; ctx.fillText('+88',c[0],c[1]-h*0.75); }
  } else if(p.t==='icecream'){
    const c=P(p.x,1.0+bob,z), s=0.42*k;
    ell(c[0],c[1],s*1.4,s*1.4,'rgba(255,200,230,.28)');
    const layers=['#f39ac0','#f6dd6a','#8fd18b'];
    layers.forEach((col,i)=>{ ctx.fillStyle=col; ctx.fillRect(c[0]-s*0.5,c[1]-s*0.45+i*s*0.1,s,s*0.1); ctx.fillRect(c[0]-s*0.5,c[1]+s*0.15+i*s*0.1,s,s*0.1); });
    ctx.fillStyle='#fbf3e4'; ctx.fillRect(c[0]-s*0.42,c[1]-s*0.15,s*0.84,s*0.3);
    ctx.fillStyle='#8a5a3a'; ctx.fillRect(c[0]-s*0.42,c[1]-s*0.02,s*0.84,s*0.05);
  } else if(p.t==='toast'){
    const c=P(p.x,1.0+bob,z), s=0.42*k;
    ell(c[0],c[1],s*1.5,s*1.5,'rgba(255,210,120,.3)');
    for(const [dy,col] of [[0.12,'#d9a764'],[-0.1,'#e7b977']]){
      ctx.fillStyle='#9a6234'; ctx.beginPath(); ctx.roundRect(c[0]-s/2,c[1]-s*0.35+dy*s,s,s*0.32,0.05*k); ctx.fill();
      ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(c[0]-s/2+0.03*k,c[1]-s*0.33+dy*s,s-0.06*k,s*0.24,0.04*k); ctx.fill();
    }
    ctx.fillStyle='#6fa64a'; ctx.fillRect(c[0]-s*0.45,c[1]-s*0.1,s*0.9,s*0.07);
    ctx.fillStyle='#f6e27a'; ctx.fillRect(c[0]-s*0.1,c[1]-s*0.32,s*0.2,s*0.1);
  }
  ctx.globalAlpha=1;
}

function drawPlayer(){
  const z=PZ, k=f/z;
  const g=P(player.x,0,z), s=P(player.x,player.y,z);
  ell(g[0],g[1],0.42*k*(1-Math.min(.5,player.y*.25)),0.11*k,'rgba(0,0,0,.28)');
  if(invT>0 && Math.floor(t*14)%2===0) return;
  const skin='#c98f63', shirt='#f07a3a', shorts='#24375a', hair='#1d1814', shoe='#f4f1ea';
  const ph=player.phase, air_=player.y>0.01;
  ctx.lineCap='round';
  if(maskT>0){ ctx.strokeStyle=`rgba(150,232,255,${0.35+0.2*Math.sin(t*8)})`; ctx.lineWidth=0.06*k; ctx.beginPath(); ctx.ellipse(s[0],s[1]-0.85*k,0.62*k,0.98*k,0,0,Math.PI*2); ctx.stroke(); }
  if(blastT>0){ for(let i=1;i<=3;i++){ ctx.fillStyle=`rgba(150,232,255,${0.22/i})`; ctx.beginPath(); ctx.ellipse(s[0],s[1]-0.85*k+i*0.25*k,0.45*k,0.9*k,0,0,Math.PI*2); ctx.fill(); } }
  if(boostT>0){ ctx.strokeStyle=`rgba(255,206,110,${0.45+0.25*Math.sin(t*12)})`; ctx.lineWidth=0.08*k; ctx.beginPath(); ctx.ellipse(s[0],s[1]-0.85*k,0.7*k,1.05*k,0,0,Math.PI*2); ctx.stroke(); }
  if(shield){ ctx.fillStyle='rgba(255,170,200,.9)'; ctx.beginPath(); ctx.arc(s[0]+0.42*k,s[1]-1.7*k,0.08*k,0,Math.PI*2); ctx.fill(); }
  if(player.slide>0 && !air_){
    ell(s[0],s[1]-0.12*k,0.3*k,0.12*k,shoe);
    ell(s[0],s[1]-0.28*k,0.3*k,0.18*k,shorts);
    ell(s[0],s[1]-0.52*k,0.32*k,0.26*k,shirt);
    ell(s[0],s[1]-0.86*k,0.16*k,0.16*k,hair);
    return;
  }
  const hipY=s[1]-0.86*k;
  const lA= air_?0.22*k:Math.max(0,Math.sin(ph))*0.3*k;
  const lB= air_?0.12*k:Math.max(0,Math.sin(ph+Math.PI))*0.3*k;
  ctx.strokeStyle=skin; ctx.lineWidth=0.15*k;
  ctx.beginPath(); ctx.moveTo(s[0]-0.12*k,hipY); ctx.lineTo(s[0]-0.13*k,s[1]-0.08*k-lA); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s[0]+0.12*k,hipY); ctx.lineTo(s[0]+0.13*k,s[1]-0.08*k-lB); ctx.stroke();
  ell(s[0]-0.13*k,s[1]-0.05*k-lA,0.1*k,0.07*k,shoe);
  ell(s[0]+0.13*k,s[1]-0.05*k-lB,0.1*k,0.07*k,shoe);
  ctx.fillStyle=shorts; ctx.beginPath(); ctx.roundRect(s[0]-0.25*k,hipY-0.12*k,0.5*k,0.36*k,0.06*k); ctx.fill();
  const aSw=Math.sin(ph)*0.18*k;
  ctx.strokeStyle=skin; ctx.lineWidth=0.11*k;
  ctx.beginPath(); ctx.moveTo(s[0]-0.27*k,s[1]-1.36*k); ctx.lineTo(s[0]-0.36*k,s[1]-0.98*k+aSw); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s[0]+0.27*k,s[1]-1.36*k); ctx.lineTo(s[0]+0.36*k,s[1]-0.98*k-aSw); ctx.stroke();
  ctx.fillStyle=shirt; ctx.beginPath(); ctx.roundRect(s[0]-0.29*k,s[1]-1.46*k,0.58*k,0.62*k,0.12*k); ctx.fill();
  ell(s[0],s[1]-1.5*k,0.08*k,0.06*k,skin);
  ell(s[0],s[1]-1.64*k,0.17*k,0.18*k,hair);
  ell(s[0]-0.17*k,s[1]-1.62*k,0.04*k,0.06*k,skin); ell(s[0]+0.17*k,s[1]-1.62*k,0.04*k,0.06*k,skin);
  if(maskT>0){ ctx.strokeStyle='#f6fbff'; ctx.lineWidth=0.025*k; ctx.beginPath(); ctx.moveTo(s[0]-0.17*k,s[1]-1.66*k); ctx.quadraticCurveTo(s[0],s[1]-1.72*k,s[0]+0.17*k,s[1]-1.66*k); ctx.moveTo(s[0]-0.17*k,s[1]-1.58*k); ctx.quadraticCurveTo(s[0],s[1]-1.52*k,s[0]+0.17*k,s[1]-1.58*k); ctx.stroke(); }
}

const drawBus=drawBusBody, drawLionDance=drawLionDanceBody;
const DRAW={barrier:drawBarrier,lowlantern:drawLowLantern,selfie:drawSelfie,bunting:drawBunting,karung:drawKarung,delivery:drawDelivery,fogging:drawFogging,liondance:drawLionDance,tourgroup:drawTourGroup,wedding:drawWedding,crate:drawCrate,chope:drawChope,bikes:drawBikes,trolley:drawTrolley,cat:drawCat,otters:drawOtters,laundry:drawLaundry,nodurian:drawNoDurian,kopi:drawKopi,branch:drawBranch,bus:drawBus,queue:drawQueue,aunties:drawAunties,scooter:drawScooter,erp:drawErp};
const LONG={bus:1,queue:1,aunties:1,liondance:1,tourgroup:1,wedding:1,karung:1};
const SCEN={tree:drawTree,lamp:drawLamp,link:drawLink,lanternline:drawLanternLine,sign:drawSign,stall:drawStall,boat:drawBoat};
const SCEN_LONG={link:1,stall:1};

function render(){
  let shake=0;
  if(state==='dying') shake=(1-dieT/0.9)*10;
  ctx.save();
  if(shake) ctx.translate(rnd(-shake,shake),rnd(-shake,shake));
  drawSky(); drawSkyline(); drawJets(); drawGround(); drawRoad();

  const camD=dist-PZ, items=[];
  for(const s of scen){ const z1=s.d-camD; const key=s.len?z1+s.len:z1; if(z1<FAR+15) items.push({k:key,z:z1,s}); }
  for(const o of obs){ const z=o.d-camD; if(z<FAR) items.push({k:(o.t==='bus'||o.t==='liondance')?Math.max(z,PZ+0.01):z,z,o}); }
  for(const p of pick_){ const z=p.d-camD; if(z<FAR&&z>NEAR) items.push({k:z,z,p}); }
  items.push({k:PZ,player:1});
  // long obstacles that sit side by side: the one further out sideways is drawn first,
  // so the one nearer your lane correctly hides it
  items.sort((a,b)=>{
    if(a.o && b.o && LONG[a.o.t] && LONG[b.o.t] && a.z<b.z+b.o.len && b.z<a.z+a.o.len && Math.abs(a.o.x-b.o.x)>0.5)
      return Math.abs(b.o.x-camX)-Math.abs(a.o.x-camX);
    return b.k-a.k;
  });
  for(const it of items){
    if(it.player){ drawPlayer(); continue; }
    if(it.s){ const s=it.s, fn=SCEN[s.t]; if(fn){ if(it.z>NEAR||SCEN_LONG[s.t]) fn(s,it.z); } else drawBuilding(s,it.z); }
    else if(it.o){ if(it.z>NEAR || LONG[it.o.t]) DRAW[it.o.t](it.o,it.z); }
    else if(it.p) drawPickup(it.p,it.z);
  }

  const wash=clamp((psiNow-70)/650,0,.34)*(maskT>0?.45:1);
  if(wash>0){ ctx.fillStyle=css(HAZE,wash); ctx.fillRect(-20,-20,W+40,H+40); }
  const pa=clamp((psiNow-40)/300,0.08,0.6)*(maskT>0?.4:1);
  ctx.fillStyle=css(lerpC(HAZE,[255,255,255],.3),pa);
  const moving=state!=='paused';
  for(const sp of specks){
    if(moving){ sp.x-=sp.v*0.016*(1+speed/20); sp.y+=sp.v*0.006; if(sp.x<0) sp.x+=1; if(sp.y>1) sp.y-=1; }
    ctx.fillRect(sp.x*W,sp.y*H,sp.s,sp.s);
  }
  // monsoon rain
  if(rainT>0){
    const rf=clamp(Math.min((7-rainT)/1,rainT/1.5),0,1);
    ctx.fillStyle=`rgba(60,80,110,${0.14*rf})`; ctx.fillRect(-20,-20,W+40,H+40);
    ctx.strokeStyle=`rgba(220,235,255,${0.5*rf})`; ctx.lineWidth=1.2; ctx.beginPath();
    for(const d of drops){
      if(moving){ d.y+=0.03; d.x-=0.004; if(d.y>1){ d.y-=1; d.x=Math.random()*1.1; } }
      const x=d.x*W, y=d.y*H; ctx.moveTo(x,y); ctx.lineTo(x-d.l*H*0.25,y+d.l*H);
    }
    ctx.stroke();
  }
  // kaya toast speed lines
  if(blastT>0){
    const g=ctx.createRadialGradient(W/2,H*0.55,Math.min(W,H)*.35,W/2,H*0.55,Math.max(W,H)*.75); g.addColorStop(0,'rgba(140,230,255,0)'); g.addColorStop(1,`rgba(140,230,255,${0.14*Math.min(1,blastT)})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  if(boostT>0){
    ctx.strokeStyle='rgba(255,236,190,.4)'; ctx.lineWidth=2; ctx.beginPath();
    for(let i=0;i<16;i++){ const a=Math.random()*Math.PI*2, r0=Math.max(W,H)*rnd(.35,.5), r1=r0+Math.max(W,H)*.15; ctx.moveTo(W/2+Math.cos(a)*r0,horizon+Math.sin(a)*r0); ctx.lineTo(W/2+Math.cos(a)*r1,horizon+Math.sin(a)*r1); }
    ctx.stroke();
  }
  if(state==='play' && air<30){ const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.75); v.addColorStop(0,'rgba(120,30,20,0)'); v.addColorStop(1,`rgba(120,30,20,${(30-air)/30*0.55})`); ctx.fillStyle=v; ctx.fillRect(0,0,W,H); }
  if(state==='dying'){ ctx.fillStyle=`rgba(255,255,255,${Math.max(0,.6-dieT*2)})`; ctx.fillRect(-20,-20,W+40,H+40); }
  ctx.restore();
}

// ---------- loop ----------
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  try{ if(state!=='paused') update(dt); }catch(e){ console.error(e); }
  try{ render(); }catch(e){ console.error(e); ctx.restore(); }
  if(narrowMQ.matches && $('pop').classList.contains('show')) placePop();
}
resetWorld(); psiNow=130; HAZE=hazeFor(130); vis=80;
genScenery(dist-PZ);
requestAnimationFrame(frame);
Ads.loadingFinished();
})();
