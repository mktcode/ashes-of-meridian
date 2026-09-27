/* Original, procedural advertising for the isolated preview. No image fetches or shared textures. */
'use strict';
function createAurelionAdvertisingAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const c = canvas.getContext('2d');
  if (!c) throw Error('Advertising canvas is unavailable');
  const random = seeded(0x41445634);
  const palettes = [['#081e43','#248be0','#b9edff'],['#211342','#8662cf','#f1d8ff'],
    ['#092441','#1467a0','#c5efff'],['#352044','#c78261','#ffe0b0']];
  for (let panel = 0; panel < 4; panel++) {
    c.save(); c.translate(panel*512,0);
    const [dark,mid,light] = palettes[panel], bg = c.createLinearGradient(0,0,460,1024);
    bg.addColorStop(0,dark); bg.addColorStop(.58,mid); bg.addColorStop(1,dark);
    c.fillStyle = bg; c.fillRect(0,0,512,1024);
    const bloom = c.createRadialGradient(280,420,10,256,480,480);
    bloom.addColorStop(0,light+'99'); bloom.addColorStop(.45,mid+'44'); bloom.addColorStop(1,dark+'00');
    c.fillStyle = bloom; c.fillRect(0,0,512,1024);
    for (let i = 0; i < 190; i++) {
      c.fillStyle = light; c.globalAlpha = .12+random()*.6;
      c.fillRect(random()*512,random()*1024,1+random()*2,1+random()*3);
    }
    c.globalAlpha = 1;
    // Thin foil borders and registration marks keep the artwork readable at oblique angles.
    c.strokeStyle = light+'aa'; c.lineWidth = 2; c.strokeRect(17,17,478,990);
    for (const x of [25,487]) for (const y of [35,980]) {
      c.fillStyle = light; c.fillRect(x-2,y-12,4,24); c.fillRect(x-10,y-2,20,4);
    }
    c.textAlign = 'center'; c.fillStyle = light; c.font = '19px sans-serif';
    c.fillText('THE CROWN COLLECTION  /  07',256,66);
    c.font = 'bold 61px sans-serif';
    c.fillText(['AURELION','N O V A','AURELION','A S T R A'][panel],256,148,450);
    c.font = '21px sans-serif';
    c.fillText(['A HIGHER TOMORROW','LIVE ABOVE','THE CITY IS YOURS','PRIVATE TRANSIT'][panel],256,193,440);
    if (panel===0 || panel===2) {
      // A backlit planet, orbital crown and a city growing out of the lower atmosphere.
      const glow = c.createRadialGradient(256,458,115,256,458,198);
      glow.addColorStop(0,light+'00'); glow.addColorStop(.78,light+'88'); glow.addColorStop(1,mid+'00');
      c.fillStyle = glow; c.fillRect(44,240,424,424);
      const planet = c.createRadialGradient(207,373,8,300,485,170);
      planet.addColorStop(0,'#e0faff'); planet.addColorStop(.22,mid); planet.addColorStop(.78,dark); planet.addColorStop(1,'#041020');
      c.fillStyle = planet; c.beginPath(); c.arc(256,458,153,0,Math.PI*2); c.fill();
      c.save(); c.beginPath(); c.arc(256,458,151,0,Math.PI*2); c.clip();
      c.strokeStyle = light+'55'; c.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        c.beginPath(); c.ellipse(256,458,Math.max(8,150-Math.abs(i)*30),150,i*.17,0,Math.PI*2); c.stroke();
        c.beginPath(); c.ellipse(256,458+i*32,150,12+i*i*.8,-.2,0,Math.PI*2); c.stroke();
      }
      for (let i = 0; i < 140; i++) {
        const x = 120+random()*270, y = 340+random()*230;
        c.fillStyle = i%3?'#fff0b7':light; c.fillRect(x,y,2,2);
      }
      c.restore();
      c.strokeStyle = light; c.lineWidth = 4;
      c.beginPath(); c.ellipse(256,460,219,51,-.48,0,Math.PI*2); c.stroke();
      for (let i = 0; i < 22; i++) {
        const x = 20+i*23, h = 30+random()*150;
        c.fillStyle = dark; c.fillRect(x,750-h,20,h);
        c.fillRect(x+5,742-h,10,12);
        c.fillStyle = '#f1dba4';
        for (let j = 0; j < h/9; j++) if (random()>.3) c.fillRect(x+5,750-h+j*9,3,3);
      }
      c.font = 'bold 41px sans-serif'; c.fillStyle = '#f1f5ef';
      c.fillText(panel===0?'RISE ABOVE':'BELONG HERE',256,818);
    } else if (panel===1) {
      // A stylised chrome flight-suit portrait, drawn locally rather than borrowing unrelated game art.
      const suit = c.createLinearGradient(130,0,392,0);
      suit.addColorStop(0,dark); suit.addColorStop(.35,'#819bb6'); suit.addColorStop(.55,'#d6e7f2'); suit.addColorStop(1,mid);
      c.fillStyle = suit;
      c.beginPath(); c.moveTo(80,798); c.lineTo(124,574); c.quadraticCurveTo(156,540,211,525);
      c.lineTo(300,525); c.quadraticCurveTo(365,548,393,587); c.lineTo(438,798); c.closePath(); c.fill();
      c.fillStyle = '#172a49'; c.beginPath(); c.ellipse(256,415,91,126,0,0,Math.PI*2); c.fill();
      c.lineWidth = 11; c.strokeStyle = light; c.stroke();
      const visor = c.createLinearGradient(161,344,343,457);
      visor.addColorStop(0,'#08263d'); visor.addColorStop(.5,'#56c6e9'); visor.addColorStop(.64,'#e4fdff'); visor.addColorStop(1,'#234268');
      c.fillStyle = visor; c.beginPath(); c.ellipse(256,400,79,60,-.12,0,Math.PI*2); c.fill();
      c.strokeStyle = light; c.lineWidth = 3;
      for (const side of [-1,1]) {
        c.beginPath(); c.moveTo(256+side*57,554); c.lineTo(256+side*95,660); c.lineTo(256+side*72,790); c.stroke();
      }
      c.fillStyle = '#f0daab'; c.fillRect(227,617,58,8); c.fillRect(240,641,32,5);
      c.fillStyle = light; c.font = 'bold 40px sans-serif'; c.fillText('NO LIMITS',256,843);
    } else {
      // Luxury orbital liner, with a luminous engine wake and bright leading-edge foil.
      c.save(); c.translate(262,499); c.rotate(-.4);
      const body = c.createLinearGradient(0,-67,0,77);
      body.addColorStop(0,'#fff4d5'); body.addColorStop(.45,'#bcc9d6'); body.addColorStop(.51,'#556579'); body.addColorStop(1,'#111e37');
      c.fillStyle = body; c.beginPath(); c.moveTo(-207,12); c.bezierCurveTo(-122,-60,119,-60,213,7);
      c.bezierCurveTo(87,52,-109,50,-207,12); c.fill();
      c.fillStyle = '#11223b'; c.beginPath(); c.moveTo(0,-16); c.lineTo(123,-21); c.lineTo(159,0); c.lineTo(12,4); c.closePath(); c.fill();
      c.fillStyle = '#d7f4ff'; for (let i = 0; i < 12; i++) c.fillRect(-121+i*16,14,8,4);
      c.strokeStyle = '#adf8ff'; c.lineWidth = 7; c.beginPath(); c.moveTo(-154,20); c.lineTo(-250,29); c.stroke();
      c.restore();
      c.strokeStyle = light+'88'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {c.beginPath(); c.ellipse(256,548,220+i*9,112+i*25,-.4,0,Math.PI*2); c.stroke();}
      c.fillStyle = light; c.font = 'bold 43px sans-serif'; c.fillText('ARRIVE ABOVE',256,821);
    }
    c.fillStyle = light; c.font = '18px sans-serif'; c.fillText('YOUR NEXT HORIZON STARTS HERE',256,891,430);
    c.fillStyle = '#f4e3ba'; c.fillRect(71,922,370,2);
    c.font = '15px monospace'; c.fillText('CROWN DISTRICT  •  MERIDIAN',256,962);
    c.restore();
  }
  return canvas;
}
