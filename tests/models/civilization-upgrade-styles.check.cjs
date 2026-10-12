const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness}=require('../helpers/model-contract.cjs');

test('all 36 specialized civic hulls select saved upgrades, share factions and retain neutral fallbacks',()=>{
  const h=modelHarness();
  vm.runInContext('Math.random=seeded=()=>{throw Error("Model RNG");};',h.context);
  const families=vm.runInContext('CIVILIZATION_UPGRADE_FAMILIES',h.context);
  assert.equal(Object.keys(families).length,12);
  for(const [upgrade,family]of Object.entries(families))for(const [index,type]of
    (family==='residential'?['embercottage','terracecommons','hearthtower']:['fieldlab','researchhub','researchspire']).entries()){
    const entity={id:1,kind:'building',type,team:0,faction:0,x:0,z:0,hp:500,size:h.BUILDINGS[type].size,progress:1};
    const neutral=h.draw(entity),selected={...entity,upgrade,upgradeLevel:index+1},special=h.draw(selected);
    assert.ok(special.some(c=>c[0].includes(upgrade)));assert.notDeepEqual(special,neutral);
    if(upgrade==='startingAlloy'){
      assert.ok(special.some(c=>c[0].endsWith('CrateCinderMark')&&c[7]===0xf1ae45));
      assert.ok(!special.some(c=>c[0].includes('CrateEcho')));
    }else if(upgrade==='aetherAllocation'){
      assert.ok(special.some(c=>c[0].endsWith('CrateEchoMark')&&c[7]===0x65e5e9));
      assert.ok(!special.some(c=>c[0].includes('CrateCinder')));
    }else assert.ok(!special.some(c=>c[0].includes('Crate')),'weapon institute is not a resource depot');
    assert.ok(!special.some(c=>c[0]==='supplyCrateHull'),'cargo is baked into model meshes, not assembled per frame');
    assert.deepEqual(h.draw({...selected,id:90210},{},123),special,'cargo arrangement is independent of entity ID and time');
    assert.deepEqual(h.draw(JSON.parse(JSON.stringify(selected))),special,'save/load restores the same appearance');
    assert.deepEqual(h.draw({...entity,upgrade:family==='research'?'startingAlloy':'weaponTechnology'}),neutral);
    assert.deepEqual(h.draw({...entity,upgrade:'unknown-style'}),neutral,'unknown styles remain neutral');
    assert.deepEqual(h.draw({...entity,upgradeOffers:[upgrade]}),neutral,'offers without confirmed activation stay neutral');
    for(const faction of [1])assert.deepEqual(h.draw({...selected,faction}),special);
    const support=c=>c[0]==='box'&&(c[4]===.55||c[4]===.23);
    assert.deepEqual(special.filter(support),neutral.filter(support),'unchanged feet and terrain supports');
    const ghost=h.draw(selected,{ghost:true});assert.equal(ghost.length,special.length);
    assert.ok(ghost.every(c=>c[7]===0x68717d));
  }
});

test('resource depots author matching cargo while weapon institutes author a fixed tank demonstrator',()=>{
  const h=modelHarness(),styles=vm.runInContext('CivilianUpgradeStyles',h.context);
  const parts=()=>{
    const crates=[],boxes=[],caps=[],cylinders=[],roof=(_x,y,_z,_w,_d,floors=1)=>y+floors*1.55+.22;
    return {crates,boxes,caps,cylinders,p:{residential:roof,module:roof,entry(){},cylinder:(...args)=>cylinders.push(args),
      box:(...args)=>boxes.push(args),cap:(...args)=>caps.push(args),crate:(...args)=>crates.push(args)}};
  };
  for(const upgrade of ['startingAlloy','aetherAllocation'])for(const type of ['embercottage','terracecommons','hearthtower']){
    const a=parts();styles[upgrade](type,a.p);
    assert.ok(a.crates.length>=3);assert.ok(a.crates.every(c=>c[5]===(upgrade==='aetherAllocation')));
    assert.ok(a.crates.every(c=>c[3]<=.32),'cargo is substantially smaller than map pickups');
  }
  for(const type of ['fieldlab','researchhub','researchspire']){
    const a=parts();styles.weaponTechnology(type,a.p);
    assert.equal(a.crates.length,0);
    assert.ok(a.cylinders.some(c=>c[1]===.69&&c[3]===.23),'one fixed display turret');
    assert.ok(a.boxes.some(b=>b[1]===.72&&b[3]===.065&&b[5]===.52),'fixed miniature barrel on the forecourt');
  }
});
