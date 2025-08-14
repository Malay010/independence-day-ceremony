;(() => {
  const TAU = Math.PI*2
  const cvs = document.getElementById('scene')
  const ctx = cvs.getContext('2d')
  const DPR = Math.max(1, Math.min(2, devicePixelRatio || 1))

  const C = {
    saffron:'#FF9933', white:'#FFFFFF', green:'#138808', navy:'#0b3c8c',
    sky1:'#9ad7ff', sky2:'#bfe7ff', sky3:'#eaf7ff', soil:'#5b3a1f', grass:'#2f8a3b',
    pole:'#7b5a3b', poleHi:'#a57b53', rope:'#d9cbb3',
    uniform:'#2a4d2b', uniformD:'#203c21', skin:'#f2c7a0', boot:'#141414'
  }

  let W=0, H=0, groundY=0
  function resize(){
    const {clientWidth:w, clientHeight:h} = cvs
    W = Math.round(w*DPR); H = Math.round(h*DPR)
    cvs.width = W; cvs.height = H
    groundY = Math.round(H*0.83)
  }
  new ResizeObserver(resize).observe(cvs); resize()

  const pole = { x:0.18, top:0.12 }
  const flag = {
    w:0.30, h:0.19,
    waveAmp: 10*DPR,
    waveLen: 220*DPR,
    waveSpeed: 1.15,
    hoistTime: 9000,
  }
  const sleeve = 10*DPR

  let tNow = performance.now()
  let tPrev = tNow
  let hoistStart = tNow
  let saluteStart = null
  let ropePhase = 0

  // Ceremony variables
  let ceremonyStage = "idle"; // idle, marching, hoisting, salute, celebrate
  let marchStart = null;
  const anthem = document.getElementById('anthem');
  const entrySong = document.getElementById('entrySong');

  const formation = []
  function buildFormation(){
    formation.length = 0
    const rows = 3, cols = 10
    const spacingX = (W*0.6) / (cols-1)
    
    const startX = W * 1.2; 
    const targetBaseX = W*0.30; 
    const baseY = groundY - 6*DPR
    const rowGap = 34*DPR
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        formation.push({
          x: startX + c*spacingX + (r%2? spacingX*0.05:0),
          targetX: targetBaseX + c*spacingX + (r%2? spacingX*0.05:0),
          y: baseY - r*rowGap,
          salute: 0,
          sway: Math.random()*TAU
        })
      }
    }
  }
  buildFormation()

  function easeOutCubic(x){ return 1 - Math.pow(1-x, 3) }
  function clamp(v,min,max){ return v<min?min:(v>max?max:v) }

  function hoistProgress(t){
    const e = clamp((t - hoistStart)/flag.hoistTime, 0, 1)
    return easeOutCubic(e)
  }

  const petals = [], settled=[]
  const PETAL_COLS = [C.saffron,C.white,C.green]
  function spawnPetal(x, y){
    const r = (4 + Math.random()*5)*DPR
    petals.push({
      x, y, r,
      vx:(-18 + Math.random()*36)*DPR,
      vy:(20 + Math.random()*30)*DPR,
      rot: Math.random()*TAU,
      vr: (-0.03 + Math.random()*0.06),
      col: PETAL_COLS[(Math.random()*3)|0],
      t: 0
    })
  }
  function burst(n){
    for(let i=0;i<n;i++){
      spawnPetal(W*(0.08+Math.random()*0.84), -20*DPR)
    }
  }
  let lastPetalSpawn = 0

  function drawBackground(time){
    const g = ctx.createLinearGradient(0,0,0,H)
    g.addColorStop(0,C.sky1); g.addColorStop(.6,C.sky2); g.addColorStop(1,C.sky3)
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H)
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff'
    const cy = H*0.18
    for(let i=0;i<8;i++){
      const cx = (i/8)*W + Math.sin(time/2600 + i*0.9)*W*0.03
      const r = (46 + i*5)*DPR
      ctx.beginPath(); ctx.ellipse(cx, cy + (i%2? 12:-8)*DPR, r, r*0.6, 0, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = C.soil; ctx.fillRect(0,groundY, W, H-groundY)
    ctx.fillStyle = C.grass
    for(let i=0;i<26;i++){
      const x = (i/26)*W
      ctx.fillRect(x, groundY-8*DPR, 3*DPR, 8*DPR)
    }
  }

  function drawPoleAndRope(p){
    const x = pole.x*W
    const top = pole.top*H
    ctx.lineCap = 'round'
    ctx.lineWidth = 8*DPR
    ctx.strokeStyle = C.pole
    ctx.beginPath(); ctx.moveTo(x, top - 18*DPR); ctx.lineTo(x, groundY); ctx.stroke()
    ctx.fillStyle = C.poleHi
    ctx.beginPath()
    ctx.moveTo(x, top - 28*DPR)
    ctx.lineTo(x + 8*DPR, top - 12*DPR)
    ctx.lineTo(x, top - 16*DPR)
    ctx.lineTo(x - 8*DPR, top - 12*DPR)
    ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.arc(x, top - 10*DPR, 5*DPR, 0, TAU); ctx.fill()
    const yFlagTop = top + (1-p)*(groundY - top - flag.h)
    ctx.strokeStyle = C.rope; ctx.lineWidth = 2*DPR
    const sway = Math.sin(tNow/700 + ropePhase)*3*DPR
    ctx.beginPath()
    ctx.moveTo(x + 5*DPR, top)
    const midY = (top + yFlagTop)*0.5
    ctx.bezierCurveTo(x + 16*DPR + sway, midY - 8*DPR, x + 10*DPR + sway, yFlagTop + 4*DPR, x + 6*DPR, yFlagTop)
    ctx.stroke()
  }

  function drawFlagCloth(p, time){
    const x0 = pole.x*W + 4*DPR
    const yTop = pole.top*H
    const fW = flag.w*W
    const fH = flag.h*H
    const yAttach = yTop + (1-p) * (groundY - yTop - fH)
    const cols = 22
    const stepX = fW / cols
    const t = time/1000 * flag.waveSpeed
    const wave = (i, phase=0) =>
      Math.sin((i/cols)*TAU + t + phase) * flag.waveAmp * (0.9 + 0.1*Math.sin(t*0.7))
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(x0 - sleeve, yAttach, sleeve, fH)
    const bands = [
      { col:C.saffron, y0:0 },
      { col:C.white,    y0:fH/3 },
      { col:C.green,    y0:(2*fH)/3 }
    ]
    bands.forEach(b=>{
      ctx.fillStyle = b.col
      ctx.beginPath()
      for(let i=0;i<=cols;i++){
        const x = x0 + i*stepX
        const y = yAttach + b.y0 + wave(i, 0)
        if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      for(let i=cols;i>=0;i--){
        const x = x0 + i*stepX
        const y = yAttach + b.y0 + fH/3 + wave(i, .55)
        ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fill()
    })
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1*DPR
    ctx.beginPath()
    for(let i=0;i<=cols;i++){
      const x = x0 + fW
      const y = yAttach + wave(i,.35)
      if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y + fH)
    }
    ctx.stroke()
    const cx = x0 + fW*0.36
    const iAtCx = clamp(Math.round((cx - x0)/stepX), 0, cols)
    const localYOffset = (wave(iAtCx, 0) + wave(iAtCx,.55))*0.5
    const cy = yAttach + fH/2 + localYOffset*0.85
    const rOuter = Math.min(fH/3.2, fW/6)
    ctx.save()
    const d = (wave(iAtCx+1)-wave(iAtCx-1))/(2*stepX)
    ctx.translate(cx, cy)
    ctx.transform(1, 0, d*0.6, 1, 0, 0)
    ctx.lineWidth = 2*DPR
    ctx.strokeStyle = C.navy
    ctx.beginPath(); ctx.arc(0, 0, rOuter, 0, TAU); ctx.stroke()
    for(let i=0;i<24;i++){
      const a = (i/24)*TAU + t*0.05
      ctx.beginPath()
      ctx.moveTo(0,0)
      ctx.lineTo(Math.cos(a)*rOuter, Math.sin(a)*rOuter)
      ctx.stroke()
    }
    ctx.fillStyle = C.navy
    ctx.beginPath(); ctx.arc(0,0,rOuter*0.12,0,TAU); ctx.fill()
    ctx.restore()
    ctx.fillStyle = C.rope
    ctx.beginPath(); ctx.arc(x0 - 2*DPR, yAttach + 2*DPR, 3*DPR, 0, TAU); ctx.fill()
  }

  function drawSoldier(s, salutePhase, time){
    const scale = 0.7*DPR
    const bodyH = 40*scale, bodyW = 16*scale
    const headR = 6.5*scale
    const y = s.y
    const x = s.x + Math.sin(s.sway + tNow/1400)*1.0*DPR

    let marchOffset = 0;
    let legBendOffset = 0;
    if (ceremonyStage === 'marching') {
      marchOffset = Math.sin((time * 0.007) + s.x) * 4 * scale;
      legBendOffset = Math.abs(marchOffset) * 0.4;
    }
    
    ctx.fillStyle = C.boot
    ctx.fillRect(x - 5*scale - marchOffset*0.6, y - bodyH - headR*2 + 48*scale + legBendOffset, 6*scale, 4*scale)
    ctx.fillRect(x + 1*scale + marchOffset*0.6, y - bodyH - headR*2 + 48*scale - legBendOffset, 6*scale, 4*scale)

    ctx.fillStyle = C.uniformD
    ctx.fillRect(x - 3.5*scale - marchOffset, y - bodyH - headR*2 + 24*scale + legBendOffset, 3*scale, 24*scale)
    ctx.fillRect(x + 0.5*scale + marchOffset, y - bodyH - headR*2 + 24*scale - legBendOffset, 3*scale, 24*scale)

    const torsoY = y - bodyH - headR*2 + 20*scale
    const torsoH = 24*scale
    ctx.fillStyle = C.uniform
    ctx.fillRect(x - bodyW/2, torsoY, bodyW, torsoH)

    ctx.fillStyle = '#111'
    ctx.fillRect(x - bodyW/2, torsoY + torsoH - 6*scale, bodyW, 2*scale)

    ctx.save()
    ctx.translate(x - bodyW/2, torsoY + 6*scale)
    ctx.fillStyle = C.uniform
    ctx.fillRect(-3*scale, 0, 3*scale, 16*scale)
    ctx.restore()
    
    ctx.save();
    const a = salutePhase;
    const shoulderX = x + bodyW / 2;
    const shoulderY = torsoY + 6 * scale;
    ctx.translate(shoulderX, shoulderY);

    const raise = -Math.PI / 2 * a;
    ctx.rotate(raise);
    ctx.fillStyle = C.uniform;
    ctx.fillRect(0, 0, 3 * scale, 16 * scale);

    ctx.translate(0, 16 * scale);
    ctx.rotate(-Math.PI / 1.6 * a);
    ctx.fillRect(-1 * scale, 0, 3 * scale, 12 * scale);

    ctx.fillStyle = C.skin;
    ctx.fillRect(-2 * scale, 10 * scale, 4 * scale, 3 * scale);
    ctx.restore();

    const headY = y - bodyH - headR*2 + 10*scale
    ctx.fillStyle = C.skin
    ctx.fillRect(x - 2*scale, headY + headR*2 - 2*scale, 4*scale, 3*scale)

    ctx.fillStyle = C.skin
    ctx.beginPath(); ctx.arc(x, headY + headR, headR, 0, TAU); ctx.fill()

    ctx.fillStyle = C.uniformD
    ctx.beginPath(); ctx.ellipse(x, headY + headR*0.9, headR*1.15, headR*0.9, 0, 0, TAU); ctx.fill()
    ctx.fillRect(x - headR*1.1, headY + headR*0.9, headR*2.2, 2*scale)
    ctx.fillStyle = '#0e2211'
    ctx.fillRect(x - headR*1.1, headY + headR*0.9, headR*2.2, 1*scale)
  }

  function drawFormation(p){
    const salute = (ceremonyStage === 'salute' || ceremonyStage === 'celebrate')
    if(salute && !saluteStart) saluteStart = tNow
    let salutePhase = 0
    if(saluteStart){
      salutePhase = clamp((tNow - saluteStart)/900, 0, 1)
    }
    for(const s of formation){
      drawSoldier(s, salutePhase, tNow)
    }
  }

  function drawPetals(dt){
    const g = 480
    for(let i=petals.length-1;i>=0;i--){
      const p = petals [i]
      p.t += dt
      p.vy += g*(dt/1000)
      const breeze = Math.sin((tNow+p.x)*0.0015)*10*DPR
      p.vx += breeze*(dt/1000)
      p.x += p.vx*(dt/1000)
      p.y += p.vy*(dt/1000)
      p.rot += p.vr

      if(p.y >= groundY - 2*DPR){
        p.y = groundY - 2*DPR
        settled.push(p); petals.splice(i,1)
      }
    }

    for(const p of petals){
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      petalShape(p.r, p.col)
      ctx.restore()
    }
    ctx.save(); ctx.globalAlpha = .95
    for(const p of settled){
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot*0.2)
      petalShape(p.r*0.92, p.col)
      ctx.restore()
    }
    ctx.restore()
  }

  function petalShape(r, col){
    ctx.fillStyle = col
    for(let k=0;k<5;k++){
      const a = k*(TAU/5)
      ctx.beginPath()
      ctx.ellipse(Math.cos(a)*r*0.55, Math.sin(a)*r*0.55, r*0.75, r*0.42, a, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(0,0,0,.08)'
    ctx.beginPath(); ctx.arc(0,0,r*0.25,0,TAU); ctx.fill()
  }

  function updateMarching(dt){
    let arrived = true;
    for (const s of formation) {
      if (s.x > s.targetX + 0.5) {
        s.x -= (60 * DPR) * (dt/1500);
        arrived = false;
      }
    }
    if (arrived && ceremonyStage === "marching") {
      ceremonyStage = "hoisting";
      hoistStart = performance.now();
      entrySong.pause();
      entrySong.currentTime = 0;
      try { anthem.currentTime = 0 } catch(e){}
      anthem.play().catch(()=>{})
    }
  }

  anthem.addEventListener("ended", () => {
    ceremonyStage = "celebrate";
    burst(220)
  })

  function frame(now){
    tPrev = tNow; tNow = now
    const dt = Math.min(32, tNow - tPrev)

    if (ceremonyStage === 'marching') {
      updateMarching(dt)
    } else if (ceremonyStage === 'hoisting') {
      const p = hoistProgress(tNow)
      if (p > 0.95 && ceremonyStage === 'hoisting') {
        ceremonyStage = 'salute'
        saluteStart = tNow
      }
    }

    drawBackground(tNow)
    const p = hoistProgress(tNow)
    drawPoleAndRope(p)
    drawFlagCloth(p, tNow)
    drawFormation(p)

    if(tNow - lastPetalSpawn > 160 && (hoistStart && tNow > hoistStart)){
      spawnPetal(W*Math.random(), -20*DPR)
      if(Math.random()<0.35) spawnPetal(W*Math.random(), -20*DPR)
      lastPetalSpawn = tNow
    }
    drawPetals(dt)

    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  document.getElementById('rehoist').addEventListener('click', ()=> {
    hoistStart = performance.now()
    saluteStart = null
    ropePhase += Math.random()*2
    setTimeout(()=> burst(140), flag.hoistTime + 200)
  })
  document.getElementById('burst').addEventListener('click', ()=> burst(120))
  document.getElementById('clear').addEventListener('click', ()=>{ petals.length=0; settled.length=0 })

  document.getElementById('startCeremony').addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none'
    buildFormation()
    ceremonyStage = 'marching'
    marchStart = performance.now()
    try { entrySong.currentTime = 0 } catch(e){}
    entrySong.play().catch(()=>{})
  })

  window.addEventListener('resize', () => {
    setTimeout(()=> {
      buildFormation()
    }, 40)
  })

  cvs.addEventListener('click', () => {
    if (ceremonyStage === 'idle') {
      const btn = document.getElementById('startCeremony')
      btn.style.display = 'block'
    }
  })

  setTimeout(()=> burst(160), flag.hoistTime + 280)

})();