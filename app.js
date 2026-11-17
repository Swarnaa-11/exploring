
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const DEFAULT = { lat: 51.5074, lng: -0.1278 };
  const state = {
    map: null, user: null, marker: null, watchId: null, gps: false, demo: false,
    intent: 'Surprise me', duration: 20, mode: 'playful', started: false,
    lastPromptAt: null, lastPosition: null, distance: 0, trail: [], revealed: [],
    memories: [], choices: [], poiCache: [], currentSuggestion: null,
    sessionStart: null, selectedPhoto: null, audioRecorder: null, audioChunks: [],
    fogCanvas: null, fogCtx: null, toastTimer: null, demoStep: 0
  };
  const screens = ['welcome-screen','intent-screen','choice-screen','mystery-screen','memory-screen','journal-screen','finish-screen'];
  const prompts = [
    {icon:'◌',title:'Follow something colourful',desc:'Let a colour catch your eye. See where it appears again.',kind:'colour'},
    {icon:'♫',title:'Follow the noise',desc:'Pause for a moment. Is there a sound coming from somewhere nearby?',kind:'sound'},
    {icon:'☾',title:'Find a quieter corner',desc:'Notice a side street, a doorway or a pocket of calm.',kind:'quiet'},
    {icon:'⌃',title:'Look a little higher',desc:'Notice the rooftops, signs and details above your usual eyeline.',kind:'look'},
    {icon:'✿',title:'Look for something growing',desc:'Find a small patch of green where you least expect it.',kind:'nature'},
    {icon:'↝',title:'Take the less familiar turn',desc:'At the next choice, notice the street you would usually pass by.',kind:'unexpected'}
  ];
  const mysteryThoughts = [
    'You have been following what feels familiar. What might happen if you change your rhythm?',
    'Look for a detail that does not fit. Let it interrupt your usual way of seeing.',
    'You do not need to know what is around the corner. Curiosity is enough.',
    'Try noticing the edges of the street instead of its centre.',
    'What is the quietest-looking opening nearby? Give it a second look.',
    'Choose the direction you would normally dismiss. You can always change your mind.'
  ];
  const modeLabels = {playful:'PLAYFUL MOOD',quiet:'QUIET MOOD',nature:'NATURE MOOD',open:'OPEN EXPLORATION'};

  function showScreen(id) { screens.forEach(s => $('#'+s).classList.toggle('active', s===id)); }
  function showMap() { screens.forEach(s => $('#'+s).classList.remove('active')); }
  function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function hint(message) { const el=$('#map-hint'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),4200); }
  function haversine(a,b) { const R=6371000,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad; const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(x)); }
  function bearing(a,b) { const r=Math.PI/180,y=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r),x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r); return (Math.atan2(y,x)*180/Math.PI+360)%360; }
  function formatDistance(m) { return m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m'; }

  function initMap() {
    if (state.map) return;
    state.map = L.map('map',{zoomControl:false,attributionControl:true,preferCanvas:true,zoomSnap:.5}).setView([DEFAULT.lat,DEFAULT.lng],16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'}).addTo(state.map);
    state.fogCanvas=$('#fog-canvas'); state.fogCtx=state.fogCanvas.getContext('2d');
    state.map.on('move zoom moveend zoomend resize',drawFog);
    window.addEventListener('resize',resizeFog);
    resizeFog();
  }
  function resizeFog(){ if(!state.map||!state.fogCanvas)return; const r=$('#map-shell').getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2); state.fogCanvas.width=Math.round(r.width*d);state.fogCanvas.height=Math.round(r.height*d);state.fogCanvas.style.width=r.width+'px';state.fogCanvas.style.height=r.height+'px';drawFog(); }
  function drawFog(){
    if(!state.map||!state.fogCtx)return;
    const c=state.fogCanvas,ctx=state.fogCtx,d=Math.min(window.devicePixelRatio||1,2),w=c.width,h=c.height;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(5,12,18,0.88)';ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='destination-out';
    const all=[...state.revealed,...state.trail];
    for(const p of all){const pt=state.map.latLngToContainerPoint([p.lat,p.lng]);const x=pt.x*d,y=pt.y*d;const mpp=156543.03392*Math.cos(p.lat*Math.PI/180)/Math.pow(2,state.map.getZoom());const radius=Math.max(26,Math.min(125,(p.radius||48)/mpp))*d;const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.58,'rgba(0,0,0,.98)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();}
    ctx.globalCompositeOperation='source-over';
  }
  function addReveal(pos,radius=55){
    if(!pos)return;
    const last=state.revealed[state.revealed.length-1];
    if(!last||haversine(last,pos)>18){state.revealed.push({lat:pos.lat,lng:pos.lng,radius});if(state.revealed.length>900)state.revealed.shift();}
    drawFog();$('#stat-revealed').textContent=state.revealed.length;
  }
  function avatarIcon(moving=false){return L.divIcon({className:'',html:`<div class="user-marker ${moving?'moving':''}"><span class="head"></span><span class="body"></span><span class="shadow"></span></div>`,iconSize:[38,48],iconAnchor:[19,44]});}
  function updateMarker(pos,moving=false){if(!state.map)return;if(!state.marker){state.marker=L.marker([pos.lat,pos.lng],{icon:avatarIcon(moving),zIndexOffset:1000,interactive:false}).addTo(state.map);}else{state.marker.setLatLng([pos.lat,pos.lng]);state.marker.setIcon(avatarIcon(moving));}}
  function updateStatus(){ $('#distance-label').textContent=state.distance?formatDistance(state.distance)+' explored':state.demo?'Demo walk active':'Your city is waiting'; $('#location-status').textContent=state.gps?'LIVE LOCATION':state.demo?'DEMO MODE':'MAP PREVIEW'; $('#avatar-state').textContent=state.gps?'Following your steps':state.demo?'Wandering together':'Ready to wander'; $('#stat-distance').textContent=formatDistance(state.distance); }
  function acceptPosition(pos,source='gps'){
    const next={lat:pos.lat,lng:pos.lng,accuracy:pos.accuracy||15,ts:Date.now()};
    if(state.lastPosition){const d=haversine(state.lastPosition,next);if(d>2&&d<120){state.distance+=d;state.trail.push(next);if(state.trail.length>500)state.trail.shift();}}
    state.lastPosition=next;state.user=next;updateMarker(next,source==='demo'||state.distance>0);addReveal(next,Math.max(45,Math.min(75,next.accuracy*1.7)));updateStatus();
    if(state.map&&source==='gps'&&!state.userCentered){state.map.setView([next.lat,next.lng],17);state.userCentered=true;}
    if(state.started&&state.distance>0&&state.distance%1<22&&(!state.lastPromptAt||Date.now()-state.lastPromptAt>90000))maybeOfferInvitation();
  }
  function startGPS(){
    if(!('geolocation'in navigator)){toast('Location is not available in this browser. Try demo mode.');return;}
    if(!window.isSecureContext){toast('GPS needs HTTPS or localhost. Use demo mode for now.');return;}
    $('#gps-permission').classList.add('visible');
  }
  function requestGPS(){
    $('#gps-permission').classList.remove('visible');
    navigator.geolocation.getCurrentPosition(p=>{state.gps=true;state.demo=false;state.userCentered=false;acceptPosition({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});if(state.watchId!==null)navigator.geolocation.clearWatch(state.watchId);state.watchId=navigator.geolocation.watchPosition(q=>acceptPosition({lat:q.coords.latitude,lng:q.coords.longitude,accuracy:q.coords.accuracy}),err=>{toast(gpsError(err));},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});$('#demo-controls').classList.remove('visible');toast('You are on the map. Take a step to reveal more.');},err=>{toast(gpsError(err));$('#gps-permission').classList.add('visible');},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  function gpsError(err){return err.code===1?'Location permission was denied. You can use demo mode.':err.code===2?'Your location could not be found. Try moving outdoors.':'Location timed out. Try again or use demo mode.';}
  function startDemo(){
    $('#gps-permission').classList.remove('visible');state.demo=true;state.gps=false;state.userCentered=true;const p=state.user||DEFAULT;state.user={lat:p.lat,lng:p.lng};state.lastPosition={...state.user};updateMarker(state.user);state.map.setView([state.user.lat,state.user.lng],16);$('#demo-controls').classList.add('visible');toast('Demo walk on. Use the arrows or your keyboard to explore.');updateStatus();
  }
  function moveDemo(dir){if(!state.demo||!state.user)return;const delta=.00016;const shifts={forward:[delta,0],back:[-delta,0],left:[0,-delta],right:[0,delta]};const [a,b]=shifts[dir];const next={lat:state.user.lat+a,lng:state.user.lng+b};acceptPosition({...next,accuracy:12},'demo');state.map.panTo([next.lat,next.lng],{animate:true,duration:.45});if(state.distance>0&&state.distance%100<20)maybeOfferInvitation();}
  function beginSession(){state.started=true;state.sessionStart=Date.now();state.lastPromptAt=Date.now();initMap();showMap();state.map.invalidateSize();$('#mode-pill').textContent=modeLabels[state.mode];if(!state.user){state.user={...DEFAULT};state.map.setView([DEFAULT.lat,DEFAULT.lng],15);updateMarker(state.user);addReveal(state.user,55);}if(!state.gps&&!state.demo)startGPS();else hint('Look up. Let the city lead for a moment.');}

  async function fetchNearby(){
    if(!state.user)return[];
    const q=`[out:json][timeout:12];(node(around:500,${state.user.lat},${state.user.lng})[amenity];node(around:500,${state.user.lat},${state.user.lng})[shop];node(around:500,${state.user.lat},${state.user.lng})[tourism];way(around:500,${state.user.lat},${state.user.lng})[leisure];);out center tags 30;`;
    try{const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});if(!r.ok)throw new Error('POI service unavailable');const data=await r.json();state.poiCache=data.elements.map(e=>{const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon,t=e.tags||{};if(!lat||!lng)return null;return{name:t.name||t.amenity||t.shop||t.tourism||'Interesting place',lat,lng,type:t.leisure?'nature':t.amenity==='cafe'||t.amenity==='restaurant'?'food':t.tourism?'culture':t.shop?'shopping':'other',tags:t};}).filter(Boolean);return state.poiCache;}catch(e){console.warn(e);return[];}
  }
  function bearingWord(b){return b<45||b>=315?'north':b<135?'east':b<225?'south':'west';}
  function openChoices(){
    const list=$('#invitation-list');list.innerHTML='';
    const mode=state.mode;const filtered=prompts.filter(p=>mode==='open'||mode==='playful'?true:mode==='nature'?['nature','unexpected','look'].includes(p.kind):mode==='quiet'?['quiet','unexpected','colour'].includes(p.kind):true);
    const icons={colour:'◌',sound:'♫',quiet:'☾',look:'⌃',nature:'✿',unexpected:'↝'};
    const descriptions={colour:'Let your eyes lead for a moment.',sound:'Pause and notice what you can hear.',quiet:'Look for a pocket of calm nearby.',look:'Notice the details above you.',nature:'Find something growing.',unexpected:'Choose what you might usually pass by.'};
    fetchNearby().then(places=>{state.poiCache=places;});
    filtered.slice(0,3).forEach(p=>{const nearby=state.poiCache.filter(x=>p.kind==='nature'?x.type==='nature':p.kind==='quiet'?x.type!=='shopping':p.kind==='sound'?['food','culture','shopping'].includes(x.type):true).sort((a,b)=>haversine(state.user,a)-haversine(state.user,b))[0];const card=document.createElement('button');card.className='invitation-card';card.innerHTML=`<span class="invitation-icon">${icons[p.kind]}</span><span><strong>${p.title}</strong><small>${descriptions[p.kind]}</small></span><span class="arrow">↗</span>`;card.addEventListener('click',()=>{state.choices.push({title:p.title,at:Date.now(),kind:p.kind});if(nearby){state.currentSuggestion=nearby;toast('A possibility is nearby. Look up and explore at your own pace.');}else toast('Invitation accepted. Let your surroundings guide the next step.');showMap();hint('Put your phone away for a moment. Notice what is around you.');});list.appendChild(card);});
  }
  function maybeOfferInvitation(){if(!state.started||Date.now()-state.lastPromptAt<90000)return;state.lastPromptAt=Date.now();toast('A new invitation is waiting when you want it.');}
  async function openMystery(){
    showScreen('mystery-screen');$('#mystery-message').textContent=mysteryThoughts[Math.floor(Math.random()*mysteryThoughts.length)];$('#mystery-place').textContent='';state.currentSuggestion=null;
    const places=await fetchNearby();if(places.length){const unexplored=places.filter(p=>!state.memories.some(m=>m.lat&&haversine(m,p)<60));const pool=unexplored.length?unexplored:places;const pick=pool[Math.floor(Math.random()*pool.length)];state.currentSuggestion=pick;$('#mystery-place').textContent='A nearby possibility is waiting somewhere '+bearingWord(bearing(state.user,pick))+'.';}
  }
  function acceptMystery(){if(state.currentSuggestion){const p=state.currentSuggestion;state.choices.push({title:'Mystery Box: unexpected possibility',place:p.name,at:Date.now()});toast('Keep an eye out for something unexpected nearby.');}else{state.choices.push({title:'Mystery Box: follow the unexpected',at:Date.now()});toast('Take a different turn when one feels right.');}showMap();hint('No route to follow. Let curiosity do the work.');}
  function openMemory(){if(!state.user){toast('Find your location first.');return;}$('#memory-note').value='';$('#memory-photo').value='';$('#photo-name').textContent='No photo added';$('#photo-preview').innerHTML='';state.selectedPhoto=null;showScreen('memory-screen');}
  function saveMemory(){const note=$('#memory-note').value.trim();if(!note&&!state.selectedPhoto){toast('Add a thought or a photo first.');return;}const item={id:Date.now(),note,lat:state.user.lat,lng:state.user.lng,created:new Date().toISOString(),photo:state.selectedPhoto};state.memories.unshift(item);saveLocal();addMemoryMarker(item);$('#stat-memories').textContent=state.memories.length;showMap();toast('Memory pinned to this place.');}
  function addMemoryMarker(item){if(!state.map||!item.lat)return;const marker=L.marker([item.lat,item.lng],{icon:L.divIcon({className:'',html:'<span class="memory-marker">✧</span>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(state.map);marker.bindPopup(`<strong>Your fragment</strong><br>${escapeHTML(item.note||'A moment you saved.')}`);}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function saveLocal(){try{const clean=state.memories;localStorage.setItem('unfold-memories',JSON.stringify(clean));localStorage.setItem('unfold-session',JSON.stringify({revealed:state.revealed,trail:state.trail,distance:state.distance,choices:state.choices,mode:state.mode}));}catch(e){console.warn('Could not save session',e);}}
  function loadLocal(){try{state.memories=JSON.parse(localStorage.getItem('unfold-memories')||'[]');const s=JSON.parse(localStorage.getItem('unfold-session')||'null');if(s){state.revealed=s.revealed||[];state.trail=s.trail||[];state.distance=s.distance||0;state.choices=s.choices||[];}}catch(e){console.warn(e);}}
  function openJournal(){renderJournal();showScreen('journal-screen');}
  function renderJournal(){
    $('#stat-distance').textContent=formatDistance(state.distance);$('#stat-revealed').textContent=state.revealed.length;$('#stat-memories').textContent=state.memories.length;const list=$('#memory-list');list.innerHTML='';
    if(!state.memories.length){list.innerHTML='<p class="empty-state">Your discoveries and memories will gather here as you explore. Use the + button to save a moment.</p>';return;}
    state.memories.forEach(m=>{const el=document.createElement('article');el.className='memory-item';const date=new Date(m.created).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});el.innerHTML=`<p>${escapeHTML(m.note||'A moment saved without words.')}</p><small>${date} · ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</small>${m.photo?`<img src="${m.photo}" alt="Saved memory"/>`:''}`;list.appendChild(el);});
  }
  function finishSession(){showScreen('finish-screen');const mins=state.sessionStart?Math.max(1,Math.round((Date.now()-state.sessionStart)/60000)):0;$('#finish-copy').textContent=state.choices.length?`You followed ${state.choices.length} small invitations and made room for the unexpected.`:'You made room for the unexpected, one step at a time.';$('#finish-summary').innerHTML=`<div><strong>YOUR INTENTION</strong> · ${escapeHTML(state.intent)}</div><div><strong>YOUR MOOD</strong> · ${escapeHTML(state.mode)}</div><div><strong>TIME OUTSIDE</strong> · ${mins} minutes</div><div><strong>DISTANCE WANDERED</strong> · ${formatDistance(state.distance)}</div><div><strong>MAP REVEALS</strong> · ${state.revealed.length}</div><div><strong>MEMORIES KEPT</strong> · ${state.memories.length}</div>`;}
  function resetSession(){state.started=false;state.distance=0;state.trail=[];state.revealed=[];state.choices=[];state.lastPosition=null;state.sessionStart=null;state.userCentered=false;state.poiCache=[];if(state.marker){state.map.removeLayer(state.marker);state.marker=null;}state.memories.forEach(()=>{});saveLocal();showScreen('intent-screen');}

  function bind(){
    $('#begin-button').addEventListener('click',()=>showScreen('intent-screen'));
    $$('[data-back]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.back)));
    $$('.intent-card').forEach(b=>b.addEventListener('click',()=>{$$('.intent-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.intent=b.dataset.intent;state.duration=Number(b.dataset.time);}));
    $$('.mood-chip').forEach(b=>b.addEventListener('click',()=>{$$('.mood-chip').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.mode=b.dataset.mode;}));
    $('#start-exploring').addEventListener('click',beginSession);
    $('#enable-gps').addEventListener('click',requestGPS);$('#use-demo').addEventListener('click',()=>{startDemo();});
    $('#journal-open').addEventListener('click',openJournal);$('#brand-home').addEventListener('click',()=>state.started?openJournal():showScreen('welcome-screen'));
    $('#mystery-button').addEventListener('click',openMystery);$('#memory-button').addEventListener('click',openMemory);$('#locate-button').addEventListener('click',()=>{if(state.user){state.map.setView([state.user.lat,state.user.lng],17);toast('Back to where you are.');}else startGPS();});
    $('#close-choice').addEventListener('click',showMap);$('#close-mystery').addEventListener('click',showMap);$('#close-memory').addEventListener('click',showMap);$('#close-journal').addEventListener('click',showMap);
    $('#mystery-accept').addEventListener('click',acceptMystery);$('#mystery-another').addEventListener('click',()=>{$('#mystery-message').textContent=mysteryThoughts[Math.floor(Math.random()*mysteryThoughts.length)];$('#mystery-place').textContent='';});
    $('#memory-photo').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);state.selectedPhoto=canvas.toDataURL('image/jpeg',0.72);$('#photo-name').textContent=f.name;$('#photo-preview').innerHTML=`<img src="${state.selectedPhoto}" alt="Photo preview"/>`;};img.src=reader.result;};reader.readAsDataURL(f);});
    $('#save-memory').addEventListener('click',saveMemory);$('#finish-session').addEventListener('click',finishSession);$('#resume-session').addEventListener('click',showMap);$('#new-session').addEventListener('click',resetSession);
    $$('#demo-controls button').forEach(b=>b.addEventListener('click',()=>moveDemo(b.dataset.step)));
    window.addEventListener('keydown',e=>{if(!state.demo||screens.some(s=>$('#'+s).classList.contains('active')))return;const k=e.key.toLowerCase();const dir={arrowup:'forward',w:'forward',arrowdown:'back',s:'back',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[k];if(dir){e.preventDefault();moveDemo(dir);}});
    let touchStart=null;$('#map-shell').addEventListener('touchstart',e=>{if(!state.demo||e.target.closest('button'))return;touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});$('#map-shell').addEventListener('touchend',e=>{if(!touchStart||!state.demo)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))>45)moveDemo(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy<0?'forward':'back'));touchStart=null;},{passive:true});
    $('#map').addEventListener('dblclick',()=>{if(state.started)openChoices();});
    $('#map-caption').addEventListener('click',()=>{if(state.started)openChoices();});
  }
  function restoreMarkers(){state.memories.forEach(addMemoryMarker);}
  function boot(){loadLocal();bind();initMap();state.map.setView([DEFAULT.lat,DEFAULT.lng],14);restoreMarkers();updateStatus();}
  boot();
})();
