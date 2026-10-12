/* Coordinate-owned economic geometry. No terrain, party or simulation RNG.
 * All consumers use the same resolved anchors, with purpose-specific margins. */
'use strict';
function battlefieldSiteSeed(site: Position): number {
  return Math.imul(Math.round(site.x * 1000), 73856093) ^ Math.imul(Math.round(site.z * 1000), 19349663) ^ 0x45434f4e;
}
function battlefieldSitePosition(site: Position, x: number, z: number): Position {
  const angle = seeded(battlefieldSiteSeed(site))() * Math.PI * 2, cs = Math.cos(angle), sn = Math.sin(angle);
  return { x: site.x + x * cs + z * sn, z: site.z + z * cs - x * sn };
}
function battlefieldGasPosition(site: Position): Position {
  const random = seeded(battlefieldSiteSeed(site) ^ 0x56454e54), angle = .35 + random() * .65, radius = 12 + random() * 2;
  return battlefieldSitePosition(site, Math.sin(angle) * radius, Math.cos(angle) * radius);
}
function battlefieldCrystalPosition(site: Position, _index: number, deposit: number): Position {
  const a = Math.PI / 2 + deposit * Math.PI / 4;
  return battlefieldSitePosition(site, Math.sin(a) * 5.5, Math.cos(a) * 5.5);
}
function battlefieldEconomyRegion(site: Position): BattlefieldEconomyRegion {
  const center = Object.freeze({ ...site }), vent = Object.freeze(battlefieldGasPosition(site)),
    hq = Object.freeze(battlefieldSitePosition(site, -13, -6)),
    deployment = Object.freeze(battlefieldSitePosition(site, -6, 6)),
    crystals = Object.freeze(Array.from({ length: 5 }, (_, j) => Object.freeze(battlefieldCrystalPosition(site, 0, j)))),
    rampProtection = Object.freeze([{ ...center, radius: 10 }, { ...vent, radius: 12 }, { ...hq, radius: 13 }].map(p => Object.freeze(p)));
  return Object.freeze({ center, crystals, vent, hq, deployment, rampProtection });
}
function battlefieldEconomyRegions(sites: readonly Position[]): readonly BattlefieldEconomyRegion[] {
  return Object.freeze(sites.map(battlefieldEconomyRegion));
}
