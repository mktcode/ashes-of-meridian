const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness}=require('../helpers/model-contract.cjs');

test('six specialized civic hulls select saved upgrades, share factions and retain neutral fallbacks',()=>{
  const h=modelHarness();
  vm.runInContext('Math.random=seeded=()=>{throw Error("Model RNG");};',h.context);
  for(const [upgrade,types] of [['startingAlloy',['embercottage','terracecommons','hearthtower']],
    ['weaponTechnology',['fieldlab','researchhub','researchspire']]])for(const [index,type] of types.entries()){
    const entity={id:1,kind:'building',type,team:0,faction:0,x:0,z:0,hp:500,size:h.BUILDINGS[type].size,progress:1};
    const neutral=h.draw(entity),selected={...entity,upgrade,upgradeLevel:index+1},special=h.draw(selected);
    assert.ok(special.some(c=>c[0].includes(upgrade)));assert.notDeepEqual(special,neutral);
    assert.ok(special.some(c=>c[0].endsWith('CrateCinderMark')&&c[7]===0xf1ae45));
    if(upgrade==='weaponTechnology')assert.ok(special.some(c=>c[0].endsWith('CrateEchoMark')&&c[7]===0x65e5e9));
    assert.ok(!special.some(c=>c[0]==='supplyCrateHull'),'cargo is baked into model meshes, not assembled per frame');
    assert.deepEqual(h.draw({...selected,id:90210},{},123),special,'cargo arrangement is independent of entity ID and time');
    assert.deepEqual(h.draw(JSON.parse(JSON.stringify(selected))),special,'save/load restores the same appearance');
    assert.deepEqual(h.draw({...entity,upgrade:upgrade==='startingAlloy'?'weaponTechnology':'startingAlloy'}),neutral);
    assert.deepEqual(h.draw({...entity,upgrade:'fieldMedicine'}),neutral,'unimplemented styles remain neutral');
    for(const faction of [1,2])assert.deepEqual(h.draw({...selected,faction}),special);
    const support=c=>c[0]==='box'&&(c[4]===.55||c[4]===.23);
    assert.deepEqual(special.filter(support),neutral.filter(support),'unchanged feet and terrain supports');
    const ghost=h.draw(selected,{ghost:true});assert.equal(ghost.length,special.length);
    assert.ok(ghost.every(c=>c[7]===0x68717d));
  }
});
