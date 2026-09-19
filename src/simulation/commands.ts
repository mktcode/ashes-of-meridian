/* Actor-facing action boundary. Immediate local execution, not a wire protocol or tick queue. */
'use strict';
function parseBattleAction(value: unknown, maxIds: number): BattleAction | null {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
  const position = (v: unknown): v is Position => record(v) &&
    typeof v.x === 'number' && Number.isFinite(v.x) && typeof v.z === 'number' && Number.isFinite(v.z);
  const ids = (v: unknown): v is number[] => Array.isArray(v) && v.length <= maxIds && Array.from(v).every(id);
  const point = (p: Position): Position => ({ x: p.x, z: p.z });
  if (!record(value)) return null;
  switch (value.kind) {
    case 'train':
      return typeof value.unit === 'string' && hasContentKey(UNITS, value.unit)
        ? { kind: 'train', unit: value.unit } : null;
    case 'build':
      return typeof value.building === 'string' && hasContentKey(BUILDINGS, value.building) &&
        position(value.position) && ids(value.selected)
        ? { kind: 'build', building: value.building, position: point(value.position), selected: [...new Set(value.selected)] } : null;
    case 'ability':
      return typeof value.ability === 'string' && hasContentKey(ABILITIES, value.ability) && position(value.position)
        ? { kind: 'ability', ability: value.ability, position: point(value.position) } : null;
    case 'rally':
      return ids(value.ids) && position(value.position)
        ? { kind: 'rally', ids: [...new Set(value.ids)], position: point(value.position) } : null;
    case 'cancelQueue':
      return id(value.id) && typeof value.index === 'number' && Number.isSafeInteger(value.index) && value.index >= 0
        ? { kind: 'cancelQueue', id: value.id, index: value.index } : null;
    case 'cancelConstruction': case 'toggleRepair': case 'sell':
      return id(value.id) ? { kind: value.kind, id: value.id } : null;
    case 'order': {
      if (!ids(value.ids) || !record(value.order)) return null;
      const o = value.order;
      let order: CommandOrder;
      switch (o.type) {
        case 'idle': case 'hold': case 'stop':
          order = { type: o.type }; break;
        case 'move': case 'attackMove': case 'guard':
          if (!position(o)) return null;
          order = { type: o.type, ...point(o) }; break;
        case 'attack': case 'build': case 'smart':
          if (!id(o.id) || !position(o)) return null;
          order = { type: o.type, id: o.id, ...point(o) }; break;
        case 'mine': case 'follow': case 'repair':
          if (!id(o.id) || ((o.x !== undefined || o.z !== undefined) && !position(o))) return null;
          order = { type: o.type, id: o.id, ...(position(o) ? point(o) : {}) }; break;
        default: return null;
      }
      return { kind: 'order', ids: [...new Set(value.ids)], order };
    }
    default: return null;
  }
}
const commandMethods = {
  executeAction(this: MeridianGame, team: PlayerTeam, input: unknown, announce = true): boolean {
    const s = this.s;
    if (!s || s.result || s.stopped || !Number.isInteger(team) || !s.parties.some(p => p.id === team)) return false;
    const action = parseBattleAction(input, s.entities.length);
    if (!action) return false;
    const inBounds = (p: Position) => Math.abs(p.x) <= this.world!.extent && Math.abs(p.z) <= this.world!.extent;
    if ('position' in action && !inBounds(action.position)) return false;
    switch (action.kind) {
      case 'train': return this.train(action.unit, team);
      case 'build': return this.build(action.building, action.position, action.selected, team);
      case 'ability': return this.ability(action.ability, action.position, team);
      case 'sell': return this.sellBuilding(action.id, team);
      case 'toggleRepair': return this.toggleBuildingRepair(action.id, team);
      case 'cancelConstruction': {
        const b = this.get(action.id);
        if (!b || b.team !== team || b.kind !== 'building' || b.progress >= 1) return false;
        this.cancelConstruction(b.id, team); return true;
      }
      case 'cancelQueue': {
        const b = this.get(action.id);
        if (!b || b.team !== team || b.kind !== 'building' || !b.queue[action.index]) return false;
        this.cancelQueue(b.id, action.index, team); return true;
      }
      case 'rally': {
        const buildings = action.ids.map(id => this.managedBuilding(id, team)).filter((b): b is BuildingEntity => !!b);
        if (!buildings.length) {
          this.notify(team, 'toast', 'Select a completed own structure before setting a rally point.');
          return false;
        }
        for (const b of buildings) b.rally = { ...action.position };
        if (announce) this.notify(team, 'order', { type: 'move', count: buildings.length, ...action.position });
        return true;
      }
      case 'order': {
        const order = action.order;
        if (order.x !== undefined && order.z !== undefined && !inBounds({ x: order.x, z: order.z })) return false;
        const own = action.ids.filter(id => { const e = this.get(id); return e?.team === team && e.kind === 'unit'; });
        if (!own.length) return false;
        if ('id' in order) {
          const target = this.get(order.id);
          if (!target) return false;
          const known = target.kind === 'resource'
            ? !!this.world!.sight[team].explored[this.world!.idx(target.x, target.z)] : this.canSee(team, target);
          if (!known) return false;
          if (order.type === 'attack' && !this.enemy({ team }, target)) return false;
          if (order.type === 'follow' && (target.team !== team || target.kind !== 'unit')) return false;
          if (order.type === 'mine' && (target.kind !== 'resource' || target.type !== 'crystal' ||
            own.some(id => this.get(id)!.type !== 'worker'))) return false;
          if ((order.type === 'build' || order.type === 'repair') &&
            (this.workerTask(target, team) !== order.type || !own.some(id => this.get(id)!.type === 'worker'))) return false;
        }
        return this.command(own, order, team, announce);
      }
    }
  }
};
type CommandMethods = typeof commandMethods;
interface MeridianGame extends CommandMethods {}
defineMeridianGameMethods(commandMethods);
