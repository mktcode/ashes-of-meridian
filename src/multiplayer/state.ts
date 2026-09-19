/* Shared read-model projection. Never send RunState or restore a simulation from this view. */
'use strict';
const MULTIPLAYER_VERSION = 4;
interface MultiplayerStart {
  type: 'start'; version: number; code: string; team: PlayerTeam;
  map: BattlefieldId; seed: number; factions: FactionId[]; token: string; graceMs: number;
}
interface MultiplayerFrame {
  type: 'frame'; tick: number; time: number; party: PartyState;
  entities: Entity[]; fog: number[]; scans: Scan[]; fields: Field[]; strikes: Strike[];
  effects: MultiplayerEffect[];
}
function queueMultiplayerAction(game: MeridianGame, team: PlayerTeam, input: unknown): ActionTicket | null {
  // Admission limits must not reveal the total (including hidden) entity count.
  const action = parseBattleAction(input, game.s?.entities.filter(e => e.team === team).length || 0);
  return action ? game.queueAction(team, action, false) : null;
}
function multiplayerFog(visible: Uint8Array, explored: Uint8Array): number[] {
  const runs: number[] = [];
  for (let i = 0; i < visible.length; i++) {
    const value = visible[i] ? 255 : explored[i] ? 80 : 0;
    if (runs.length && runs[runs.length - 1] === value) runs[runs.length - 2]++;
    else runs.push(1, value);
  }
  return runs;
}
function applyMultiplayerFog(world: Battlefield, team: PlayerTeam, runs: number[]) {
  const sight = world.sight[team];
  let index = 0;
  if (runs.length % 2) throw Error('Invalid visibility data');
  for (let i = 0; i < runs.length; i += 2) {
    const count = runs[i], value = runs[i + 1];
    if (!Number.isInteger(count) || count <= 0 || index + count > world.fogPixels.length ||
        ![0, 80, 255].includes(value)) throw Error('Invalid visibility data');
    sight.visible.fill(value === 255 ? 255 : 0, index, index + count);
    sight.explored.fill(value ? 1 : 0, index, index + count);
    world.fogPixels.fill(value, index, index + count);
    index += count;
  }
  if (index !== world.fogPixels.length) throw Error('Visibility dimensions do not match');
  world.fogVersion++;
}
function multiplayerEntity(e: Entity, team: PlayerTeam, known: Set<number>): Entity {
  const own = e.team === team;
  let order: UnitOrder = { type: 'idle' };
  if (own && (!('id' in e.order) || known.has(e.order.id))) order = { ...e.order };
  // Explicit allowlist: no paths, AI contacts, hidden targets, enemy queues or economic metadata.
  const result = {
    id: e.id, kind: e.kind, type: e.type, team: e.team, faction: e.faction,
    x: e.x, z: e.z, hp: e.hp, maxHp: e.maxHp, size: e.size, rot: e.rot,
    progress: e.progress, walk: e.walk, shield: e.shield, maxShield: e.maxShield,
    carry: e.carry, lastHit: e.lastHit, shieldFlash: e.shieldFlash,
    vision: 0, kills: own ? e.kills : 0, work: 0, cd: 0, nextThink: 0, nextPath: 0,
    path: [], pi: 0, order,
    queue: own ? e.queue.map(q => ({ type: q.type, progress: q.progress, time: q.time, cost: q.cost, gas: q.gas })) : []
  } as Entity;
  if (e.kind === 'resource' && result.kind === 'resource') result.amount = e.amount;
  if (own) {
    if (e.rally) result.rally = { x: e.rally.x, z: e.rally.z };
    if (e.paid) result.paid = { cost: e.paid.cost, gas: e.paid.gas };
    if (e.gasId !== undefined) result.gasId = e.gasId;
  }
  return result;
}
function multiplayerFrame(game: MeridianGame, team: PlayerTeam, resources: Map<number, Entity>): MultiplayerFrame {
  const s = game.s!, world = game.world!, sight = world.sight[team];
  const current = s.entities.filter(e => e.hp > 0 && game.canSee(team, e));
  // Neutral deposits remain at their last observed state, not their live state in fog.
  for (const [id, old] of resources) if (sight.visible[world.idx(old.x, old.z)]) resources.delete(id);
  const known = new Set([...current.map(e => e.id), ...resources.keys()]);
  const entities: Entity[] = [];
  for (const e of current) {
    const projected = multiplayerEntity(e, team, known);
    if (e.kind === 'resource') resources.set(e.id, projected);
    else entities.push(projected);
  }
  entities.push(...resources.values());
  const party = game.party(team);
  return { type: 'frame', tick: game.commandQueue.tick, time: s.time,
    party: { id: team, faction: party.faction, controller: { kind: 'human' },
      account: { ...party.account, abilities: { ...party.account.abilities } }, meta: {}, benefits: {},
      fieldWorkshopUsed: party.fieldWorkshopUsed },
    entities, fog: multiplayerFog(sight.visible, sight.explored), effects: takeMultiplayerEffects(game, team),
    strikes: s.strikes.filter(a => a.type !== 'shell' && !a.done && (a.team === team || !!sight.visible[world.idx(a.x, a.z)]))
      .map(a => ({ x: a.x, z: a.z, at: a.at, radius: a.radius, team: a.team, type: a.type, damage: 0 })),
    scans: s.scans.filter(a => a.team === team).map(a => ({ x: a.x, z: a.z, r: a.r, until: a.until, team })),
    fields: s.fields.filter(a => a.team === team || !!sight.visible[world.idx(a.x, a.z)])
      .map(a => ({ x: a.x, z: a.z, r: a.r, until: a.until, team: a.team, type: a.type })) };
}
