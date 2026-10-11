/* Approved prototype recipes. All positions remain authored model-local geometry. */
'use strict';
type CivilianUpgradeDesign = {
  id:CivilizationUpgradeType;name:string;family:'home'|'lab';motif:string;
  stages:string[];description:string;build(m:CivilianUpgradeArchitecture,rank:number):void;
};
const CivilianUpgradeDesigns = (() => {
  function blocks(m:CivilianUpgradeArchitecture,r:number,walls:CivilianStyleMaterial='steel') {
    if(r===1){const roof=m.house(0,.35,0,4.4,3.3,1,walls);return {roof,back:roof,front:roof,podium:roof};}
    if(r===2){
      const back=m.house(-.8,m.family==='home'?1.45:1.8,-1.1,4.65,2.6,2,walls),
        front=m.house(.75,.35,1.7,5.3,2.55,1,walls);
      return {roof:back,back,front,podium:front};
    }
    const podium=m.house(0,.35,-.4,m.family==='home'?4.25:4.7,m.family==='home'?3.6:3.95,2,walls),
      roof=m.house(0,podium-.1,-.5,3.45,2.95,4,walls);
    return {podium,roof,back:roof,front:podium};
  }
  function cassette(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w:number,d:number,h=.60) {
    m.oct(x,y,z,w,h,d,.18,'steel');
    m.box(x,y-h/2+.035,z,w+.10,.07,d+.10,'dark');
    m.box(x,y+h/2,z,w+.12,.09,d+.12,'edge');
    for(const side of [-1,1]) {
      m.box(x+side*(w/2-.12),y,z+d/2+.04,.09,h*.86,.09,'dark');
      m.box(x+side*(w/2-.12),y+.03,z+d/2+.10,.10,.14,.035,'orange');
    }
    m.box(x,y,z+d/2+.04,w*.55,h*.45,.035,'dark');
    m.box(x,y+.04,z+d/2+.07,w*.30,.05,.025,'edge');
  }
  function bay(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w=1.7) {
    m.box(x,y+.66,z,w,1.15,.14,'dark');
    m.box(x,y+.70,z+.075,w-.18,.87,.025,'steel');
    for(let i=0;i<4;i++)m.box(x,y+.40+i*.20,z+.10,w-.26,.045,.035,'edge');
    m.box(x,y+1.22,z+.10,w+.15,.12,.22,'edge');
  }
  function armor(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w:number,h:number,d:number) {
    m.oct(x,y,z,w,h,d,.12,'dark');
    m.box(x,y+h/2,z,w+.05,.12,d+.05,'edge');
    m.box(x,y-h/2+.08,z,w+.035,.10,d+.035,'steel');
    for(const end of [-1,1])m.box(x,y,z+end*(d/2+.02),w*.62,h*.80,.045,'steel');
  }
  function sector(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w:number,d:number,angle=0) {
    m.box(x,y+.16,z,w,.32,d,'dark',angle);
    m.box(x,y+.34,z,w+.10,.08,d+.10,'edge',angle);
    m.box(x,y+.40,z,w*.56,.045,d*.55,'cyan',angle);
  }
  function cooling(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w=2.2,d=1.8,h=.8) {
    m.box(x,y+.10,z,w+.16,.20,d+.12,'dark');
    m.box(x,y+.30,z,w*.85,.50,d*.64,'steel');
    for(let i=-1;i<=1;i++) {
      m.box(x+i*w*.29,y+h/2+.12,z,.16,h,d,'dark');
      m.box(x+i*w*.29,y+h+.16,z,.20,.08,d+.05,'edge');
    }
    m.box(x,y+.27,z+d*.33+.025,w*.26,.07,.035,'cyan');
  }
  function radial(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,r=.6,h=1.05,n=6) {
    m.oct(x,y+.35,z,.70,.70,.70,.13,'dark');
    m.oct(x,y+.73,z,.62,.13,.62,.13,'steel');
    for(let i=0;i<n;i++) {
      const a=i*Math.PI*2/n;
      m.box(x+Math.sin(a)*r,y+h/2,z+Math.cos(a)*r,.15,h,.92,'dark',a);
      m.box(x+Math.sin(a)*r,y+h+.045,z+Math.cos(a)*r,.19,.09,.98,'edge',a);
    }
  }
  function beacon(m:CivilianUpgradeArchitecture,x:number,y:number,z:number,w=.55,h=1.1) {
    m.oct(x,y+.08,z,w+.55,.16,.95,.16,'edge');
    for(const side of [-1,1]) {
      m.box(x+side*w*.30,y+h/2+.15,z,w*.34,h,.43,'dark');
      for(const front of [-1,1])m.box(x+side*w*.30,y+h*.55+.15,z+front*.23,w*.12,h*.65,.035,'cyan');
      m.box(x+side*w*.30,y+h+.19,z,w*.40,.12,.51,'steel');
    }
  }
  return [
    {
      id:'startingWorkers',name:'Worker-Quartier',family:'home',motif:'Loggien, Laubengänge und Dachgärten',
      stages:['Ankunftshaus','Quartiersgemeinschaft','Gemeinschaftshochhaus'],
      description:'Wohn- und Ausbildungsquartier. Warme Zimmer, geschützte Gemeinschaftsbereiche und feste Pflanzinseln statt Fabriktechnik.',
      build(m,r) {
        if(r===1) {
          const roof=m.house(-1.08,.35,0,2.02,3.05),other=m.house(1.08,.35,0,2.02,3.05);
          m.box(0,1.20,-.10,.30,1.70,2.75,'dark');
          m.box(0,roof+.06,0,4.25,.12,2.70,'edge');
          m.rail(0,roof+.12,-1.25,3.90);
          m.planter(-1.25,roof+.13,-.80,1.20);m.planter(1.30,other+.13,-.80,1.10);
          m.bench(.1,roof+.13,.28,1.1);
          m.frame(.1,roof+.13,.20,1.55,.65,1.20,'steel');
          m.box(.1,roof+.85,.20,1.78,.10,1.38,'edge');
        }else if(r===2) {
          const b=blocks(m,r);
          m.balcony(-.8,3.03,.50,4.28);
          for(const x of [-2.5,-.8,.9])m.box(x,2.57,.50,.10,.95,.10,'steel');
          m.planter(-1.10,b.front,1.70,1.20);m.planter(2.45,b.front,1.70,1.15);
          m.bench(.80,b.front,1.70,1.25);
          m.frame(.80,b.front,1.70,1.70,.7,1.15,'steel');
          m.box(.80,b.front+.77,1.70,1.96,.12,1.35,'edge');
          m.rail(-.8,b.back,-2.20,4.10);
        }else {
          const podium=m.house(0,.35,-.4,4.25,3.6,2),base=podium-.1,
            roof=m.house(.05,base,-.5,3.38,2.82,4);
          for(let f=0;f<4;f++) {
            const Y=base+f*1.55+.12;
            m.balcony(.05,Y,1.03,3.05);
            if(f%2===0)m.planter(-.98,Y+.14,1.04,.60,.29);
          }
          m.planter(-.95,roof,-.75,.90);m.planter(1.05,roof,-.75,.85);
          m.bench(.05,roof,.20,1.2);m.rail(.05,roof,.88,2.85);
          m.frame(.05,roof,-.45,2.85,.72,2.12,'steel');
          m.box(.05,roof+.80,-.45,3.16,.12,2.4,'edge');
        }
      }
    },
    {
      id:'constructionProtocols',name:'Bauplanungswerk',family:'home',motif:'Exoskelett und rechteckige Montagebrücke',
      stages:['Montagebüro','Baukoordinationszentrum','Konstruktionshochhaus'],
      description:'Vorgefertigte Baugruppen, kräftige Tragwerke und starre Dachtraversen. Der Hebeblock bleibt geparkt; kein beweglicher Kran.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          m.frame(0,.35,0,4.50,2.68,2.64);
          m.box(0,2.78,0,.70,.35,.70,'dark');
          m.box(0,2.59,0,.22,.08,.44,'orange');
          m.box(-1.10,b.roof+.17,-.55,1.05,.30,.78,'steel');
          m.box(-1.10,b.roof+.35,-.55,1.15,.065,.88,'edge');
        }else if(r===2) {
          m.frame(-.8,1.45,-1.1,4.82,3.92,2.56);
          m.frame(.75,.35,1.7,5.45,2.72,2.40);
          for(const side of [-1,1])m.beam([-.8+side*2.41,1.62,-2.27],[-.8+side*2.41,4.93,.07],.11,'steel');
          m.box(-.8,5.08,-1.1,.82,.4,.66,'dark');
          m.box(.75,b.front+.30,1.70,1.65,.60,1.00,'steel');
          for(const x of [.25,1.25])m.box(x,b.front+.31,2.22,.11,.48,.045,'orange');
        }else {
          m.frame(0,.35,-.5,4.35,11.0,2.65);
          for(const side of [-1,1])for(let f=0;f<3;f++) {
            const Y=.7+f*3.2;
            m.beam([side*2.175,Y,-1.75],[side*2.175,Y+2.75,.75],.12,'steel');
          }
          m.box(0,11.00,-.5,1.05,.45,.85,'dark');
          m.box(0,10.72,-.5,.24,.10,.55,'orange');
          for(let f=0;f<4;f++)m.box(0,b.podium+f*1.55+.1,1.03,3.3,.09,.10,'edge');
        }
      }
    },
    {
      id:'logisticsFrame',name:'Logistikhaus',family:'home',motif:'Versorgungskassetten in offenen Regalrahmen',
      stages:['Verteilungsstation','Logistikzentrum','Versorgungsstapel'],
      description:'Geordnete, neutral markierte Versorgungskassetten und ein warmer Leitstand. Kein weiteres Cinder- oder Echo-Ressourcenlager.',
      build(m,r) {
        if(r===1) {
          m.house(-1.35,.35,0,1.7,3.3);
          cassette(m,.68,.70,0,2.80,3.3,.60);cassette(m,.68,1.70,0,2.80,3.3,.60);
          m.frame(.68,.35,0,2.95,2.00,3.35);
          m.box(.68,1.13,1.64,2.45,.09,.15,'edge');
        }else if(r===2) {
          const rear=m.house(-.8,1.45,-1.1,4.65,2.6,2);
          cassette(m,.75,.70,1.7,5.15,2.50,.60);cassette(m,.75,1.50,1.7,5.15,2.50,.60);
          m.frame(.75,.35,1.7,5.35,1.90,2.60);
          cassette(m,-.8,rear+.42,-1.1,3.8,1.85,.65);
          m.frame(-.8,rear,-1.1,4.05,1.0,2.06);
          m.box(-.8,rear+1.04,-1.1,4.25,.12,2.20,'edge');
        }else {
          const floor=m.house(0,.35,-.4,4.25,3.6);
          m.house(-1.40,floor,-.5,.88,2.82,5);
          for(let i=0;i<7;i++) {
            const Y=floor+.4+i*1.10;
            cassette(m,.48,Y,-.5,2.35,2.82,.64);
            m.box(.48,Y-.35,-.5,2.55,.12,3.05,'edge');
          }
          m.frame(0,floor,-.5,3.95,8.18,3.0);
          m.box(-1.40,floor+7.97,-.5,1.12,.17,3.0,'steel');
        }
      }
    },
    {
      id:'repairLogistics',name:'Reparaturhaus',family:'home',motif:'C-förmige Serviceklammer und Wartungsbuchten',
      stages:['Servicewerkstatt','Wartungszentrum','Servicehochhaus'],
      description:'Zivile Wartung: geschlossene Servicebuchten, Werkzeugschienen und eine seitlich offene Klammer. Keine Reparaturdrohnen oder Heilstrahlen.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          bay(m,-.92,.35,1.73,1.65);
          m.cframe(.15,b.roof+.12,-.25,2.85,.95,1.60);
          m.box(-1.75,b.roof+.25,-.30,.65,.50,1.4,'steel');
          for(let i=0;i<4;i++)m.box(-1.75,b.roof+.53,-.80+i*.31,.60,.035,.055,'edge');
          m.grille(1.45,1.18,1.73,.90);
        }else if(r===2) {
          bay(m,-.77,.35,3.03,1.45);bay(m,2.35,.35,3.03,1.50);
          m.cframe(-.8,b.back+.10,-1.10,3.70,1.15,1.85);
          m.box(.75,b.front+.15,1.70,3.7,.16,.25,'dark');
          m.box(1.7,b.front+.38,1.70,.70,.45,.62,'steel');
          m.cframe(.75,b.front+.10,1.70,2.8,.60,.85);
        }else {
          m.box(1.62,5.08,-.55,.50,8.92,2.15,'dark');
          for(let f=0;f<4;f++) {
            const y=b.podium-.1+f*1.55+.30;
            m.box(-.45,y+.45,1.035,1.35,.82,.15,'dark');
            m.cframe(-.45,y+.10,1.12,1.28,.65,.18);
          }
          m.cframe(0,b.roof+.10,-.5,3.12,1.35,2.10);
          m.box(.60,b.roof+.45,-.5,.64,.50,1.1,'steel');
        }
      }
    },
    {
      id:'protectionSystems',name:'Schutztechnikzentrum',family:'lab',motif:'Segmentierte Panzerhüllen um einen Forschungskern',
      stages:['Schutzlabor','Schutzkomplex','Schutzspitze'],
      description:'Der Schutz wird durch dicke, gestaffelte Schalen vermittelt — nicht durch eine Schildblase oder zusätzliche Spieleffekte.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          for(const side of [-1,1]) {
            armor(m,side*2.18,1.45,-.12,.48,2.14,2.88);
            m.wedge(side*1.04,b.roof,-.10,2.06,.62,3.12,'steel');
          }
          m.box(0,b.roof+.1,-.1,.17,.2,2.80,'dark');
        }else if(r===2) {
          for(const side of [-1,1]) {
            armor(m,-.8+side*2.24,3.45,-1.10,.54,3.36,2.50);
            armor(m,.75+side*2.62,1.52,1.72,.46,2.28,2.33);
            m.wedge(-.8+side*1.07,b.back,-1.1,2.12,.7,2.55,'steel');
          }
          m.box(.75,b.front+.10,1.72,4.45,.24,2.15,'dark');
          m.box(.75,b.front+.24,1.72,3.90,.10,1.90,'steel');
        }else {
          for(const side of [-1,1])for(let i=0;i<5;i++)armor(m,side*(1.85-i*.035),1.55+i*1.88,-.5,.47,1.72,2.84-i*.08);
          for(const side of [-1,1])m.wedge(side*.90,b.roof,-.5,1.74,.94,2.91,'steel');
          m.box(0,b.roof+.20,-.5,.20,.40,2.80,'dark');
          for(let i=0;i<4;i++)m.box(0,b.podium+i*1.55+.85,1.05,.70,.075,.045,'cyan');
        }
      }
    },
    {
      id:'fieldMedicine',name:'Feldmedizinzentrum',family:'lab',motif:'Helle Stationsflügel und ruhige Diagnosekappen',
      stages:['Medizinlabor','Versorgungsinstitut','Medizinisches Hochhaus'],
      description:'Weich gefaste, helle Stationen mit Oberlichtern, Aufenthaltsnischen und abstrahierten Diagnosemarken. Keine roten Kreuzsymbole oder Ambulanzfahrzeuge.',
      build(m,r) {
        if(r===1) {
          const roof=m.house(0,.35,0,3.70,3.1,1,'light',.7);
          for(const side of [-1,1])m.house(side*1.84,.35,-.15,.78,2.58,1,'light',.2);
          m.skylight(0,roof,-.20,2.25,1.28);m.pulse(-.72,1.52,1.76,.8);
          m.bench(-1.02,.31,2.22,.72);
        }else if(r===2) {
          const rear=m.house(-.8,1.8,-1.1,4.65,2.6,2,'light',.75);
          for(const x of [-.77,2.27]) {
            const roof=m.house(x,.35,1.7,2.15,2.55,1,'light',.42);
            m.skylight(x,roof,1.60,1.50,1.30);
          }
          m.house(.75,.35,1.7,.80,2.55,1,'light',.14);
          m.skylight(-.8,rear,-1.1,2.45,1.30);m.pulse(.75,1.55,3.01,.8);
          m.box(.75,2.04,1.7,5.10,.10,2.43,'light');
        }else {
          const p=m.house(0,.35,-.4,4.7,3.95,2,'light',.82),
            middle=m.house(0,p-.1,-.55,3.65,3.15,3,'light',.75),
            roof=m.house(.08,middle-.10,-.58,3.08,2.65,1,'light',.65);
          m.oct(.08,roof+.16,-.58,3.48,.32,3.03,.68,'light');
          m.skylight(.08,roof+.32,-.58,2.38,1.45);
          m.balcony(0,middle+.04,.95,3.4);
          m.pulse(0,p+2.90,1.095,1.2);
          m.planter(-1.18,middle+.13,.95,.62,.30);
        }
      }
    },
    {
      id:'commandTraining',name:'Command-Akademie',family:'lab',motif:'Vier gleichwertige Kontrollsektoren',
      stages:['Koordinationsschule','Command-Campus','Koordinationsturm'],
      description:'Vier ausgerüstete Fähigkeiten werden gemeinsam koordiniert. Vier feste Dachsektoren um eine Leitwarte, unabhängig vom konkreten Loadout.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          m.oct(0,b.roof+.23,0,.85,.46,.85,.18,'dark');
          for(const sx of [-1,1])for(const sz of [-1,1]) {
            sector(m,sx*1.15,b.roof,sz*.84,1.05,.90,sx*sz*.22);
            m.beam([0,b.roof+.15,0],[sx*.92,b.roof+.15,sz*.65],.14,'steel');
          }
        }else if(r===2) {
          m.oct(-.8,b.back+.32,-1.1,1.40,.64,1.10,.25,'dark');
          for(const side of [-1,1]) {
            sector(m,-.8+side*1.40,b.back,-1.1,1.22,1.58,side*.1);
            sector(m,.75+side*1.60,b.front,1.7,1.34,1.60,-side*.1);
            m.beam([-.8+side*.6,b.back+.12,.02],[.75+side*1.15,b.front+.20,.97],.21,'dark');
          }
        }else {
          for(const sx of [-1,1])for(const sz of [-1,1]) {
            m.box(sx*1.50,b.podium+3.08,-.5+sz*1.18,.26,6.16,.26,'dark');
            sector(m,sx*.98,b.roof,-.5+sz*.72,1.30,1.02,sx*sz*.12);
          }
          m.oct(0,b.roof+.32,-.5,.82,.64,.82,.18,'dark');
          m.oct(0,b.roof+.67,-.5,.72,.09,.72,.17,'edge');
        }
      }
    },
    {
      id:'commandCapacitor',name:'Energieversorgungsinstitut',family:'lab',motif:'Kühlflossen und radiale Kondensatorkrone',
      stages:['Kondensatorlabor','Energiestation','Kondensatorturm'],
      description:'Dunkle Kondensatorpakete und deutlich getrennte Kühlplatten statt runder Echo-Lagertanks. Kleine Statusanzeigen, keine elektrischen Blitze.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          cooling(m,.25,b.roof,-.30,2.50,2.20,.87);
          m.box(-1.64,b.roof+.25,.25,.68,.50,1.44,'dark');
          for(const z of [-.22,.22,.66])m.box(-1.64,b.roof+.52,z,.76,.07,.10,'edge');
        }else if(r===2) {
          radial(m,-.8,b.back,-1.1,.57,1.25,6);
          cooling(m,.75,b.front,1.7,3.65,1.72,.65);
          for(const x of [-2.50,.95])m.box(x,3.30,.19,.18,2.80,.13,'dark');
        }else {
          for(const side of [-1,1])for(const z of [-1.50,-.50,.50]) {
            m.box(side*1.79,b.podium+3.05,z,.44,5.88,.24,'dark');
            m.box(side*2.02,b.podium+3.05,z,.065,5.88,.28,'edge');
          }
          radial(m,0,b.roof,-.5,.66,1.42,8);
          m.box(0,b.podium+3.2,1.04,.50,.12,.04,'cyan');
        }
      }
    },
    {
      id:'commanderMandate',name:'Kommandantenkolleg',family:'lab',motif:'Zentraler Führungsbeacon zwischen zwei Schultern',
      stages:['Führungskolleg','Führungszentrum','Führungshochhaus'],
      description:'Repräsentative Ausbildungsarchitektur mit zwei starken Schulterpylonen und einem geteilten Beacon. Keine neue Commander-Einheit und keine Aura.',
      build(m,r) {
        const b=blocks(m,r);
        if(r===1) {
          for(const side of [-1,1]) {
            m.oct(side*1.50,b.roof+.33,-.15,1.15,.66,2.45,.22,'dark');
            m.box(side*1.50,b.roof+.72,-.15,1.25,.13,2.58,'edge');
          }
          beacon(m,0,b.roof+.06,-.15,.58,1.1);
          m.box(.55,1.66,1.85,1.65,.18,.32,'steel');
        }else if(r===2) {
          for(const side of [-1,1]) {
            armor(m,-.8+side*1.82,3.52,-1.1,.64,4.45,2.17);
            m.box(-.8+side*1.82,5.82,-1.1,.72,.17,2.32,'edge');
          }
          beacon(m,-.8,b.back+.18,-1.1,.75,1.65);
          m.box(.30,1.64,3.12,1.85,.19,.38,'steel');
          m.rail(.30,.40,3.67,3.10,1.6);
        }else {
          for(const side of [-1,1]) {
            armor(m,side*1.80,5.25,-.5,.65,9.84,2.68);
            m.box(side*1.8,10.26,-.5,.76,.20,2.86,'edge');
          }
          beacon(m,0,b.roof+.1,-.5,.95,1.85);
          m.oct(0,.81,1.03,2.6,.94,.55,.12,'dark');
          m.box(.20,1.75,1.75,2.20,.20,.50,'edge');
        }
      }
    }
  ] satisfies CivilianUpgradeDesign[];
})();
for(const design of CivilianUpgradeDesigns)CivilianUpgradeStyles[design.id]=(type,parts)=>{
  const architecture=new CivilianUpgradeArchitecture(parts,type);
  design.build(architecture,architecture.rank);
  architecture.finish();
};
