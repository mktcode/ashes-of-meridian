/* Observer-filtered transient events and a read-only, delayed rendering timeline. */
'use strict';
type MultiplayerNotice = Extract<GameEvent, ['toast' | 'radio' | 'alert' | 'complete' | 'queued' | 'scan' | 'heal', unknown]> |
  ['trained', { type: UnitType }];
type MultiplayerEffect = { time: number } & (
  | { kind: 'shot' | 'healing' | 'mining' | 'construction'; source: EffectPose; target: EffectPose; travel?: number }
  | { kind: 'damage'; point: Position & { team: TeamId }; amount: number }
  | { kind: 'explosion'; point: Position; size: number; color: number; big: boolean }
  | { kind: 'drop'; point: Position; team: PlayerTeam; color: number }
  | { kind: 'sound'; point: Position; heavy: boolean }
  | { kind: 'notice'; event: MultiplayerNotice }
);
const multiplayerEffectBoxes = new WeakMap<MeridianGame, Map<PlayerTeam, MultiplayerEffect[]>>();
function effectPose(e: Entity): EffectPose {
  return { x: e.x, z: e.z, kind: e.kind, type: e.type, team: e.team, faction: e.faction, rot: e.rot, size: e.size };
}
function projectMultiplayerEffect(game: MeridianGame, team: PlayerTeam, event: SimulationPresentation): MultiplayerEffect | null {
  const time = game.s!.time, point = (p: Position) => ({ x: p.x, z: p.z });
  const seen = (p: Position & { team?: TeamId }) => game.canSee(team, p);
  if ('source' in event) {
    if (!seen(event.source) || !seen(event.target)) {
      // An audible visible muzzle must not disclose an unseen endpoint (or vice versa).
      return event.kind === 'shot' && seen(event.source)
        ? { kind: 'sound', time, point: point(event.source), heavy: event.source.type === 'tank' || event.source.type === 'destroyer' || !!event.travel } : null;
    }
    return { kind: event.kind, time, source: effectPose(event.source), target: effectPose(event.target), travel: event.travel };
  }
  switch (event.kind) {
    case 'damage': return seen(event.target) ? { kind: 'damage', time,
      point: { ...point(event.target), team: event.target.team }, amount: event.amount } : null;
    case 'explosion': return seen(event.point) ? { kind: 'explosion', time, point: point(event.point), size: event.size,
      color: event.color ?? (event.point.team === team ? 0xa2e3db : 0xf2b084), big: event.big } : null;
    case 'drop': return event.team === team ? { ...event, time, point: point(event.point) } : null;
    case 'notice': {
      if (event.team !== null && event.team !== team) return null;
      const [type, data] = event.event;
      let notice: MultiplayerNotice;
      switch (type) {
        case 'toast': case 'radio': notice = [type, data]; break;
        case 'queued': notice = [type, data]; break;
        case 'alert': {
          if (typeof data === 'string') notice = [type, data];
          else notice = [type, { text: data.text, danger: data.danger,
            ...(data.x !== undefined && data.z !== undefined && (event.team === team || seen({ x: data.x, z: data.z }))
              ? { x: data.x, z: data.z } : {}) }];
          break;
        }
        case 'complete': notice = [type, { ...point(data), type: data.type }]; break;
        case 'trained': notice = [type, { type: data.type }]; break;
        case 'scan': case 'heal': notice = [type, point(data)]; break;
        default: return null; // Never forward start/result or raw entity/command payloads.
      }
      return { kind: 'notice', time, event: notice };
    }
  }
}
function enableMultiplayerPresentation(game: MeridianGame) {
  const boxes = new Map<PlayerTeam, MultiplayerEffect[]>(), workTimes = new Map<number, number>();
  multiplayerEffectBoxes.set(game, boxes);
  game.presentation = event => {
    if (event.kind === 'mining' || event.kind === 'construction') {
      if (game.s!.time - (workTimes.get(event.source.id) ?? -Infinity) < .25) return;
      workTimes.set(event.source.id, game.s!.time);
      if (workTimes.size > 1024) workTimes.delete(workTimes.keys().next().value!);
    }
    for (const party of game.s!.parties) {
      const projected = projectMultiplayerEffect(game, party.id, event);
      if (!projected) continue;
      let box = boxes.get(party.id);
      if (!box) boxes.set(party.id, box = []);
      if (box.length === 256) box.shift();
      box.push(projected);
    }
  };
}
function takeMultiplayerEffects(game: MeridianGame, team: PlayerTeam): MultiplayerEffect[] {
  const boxes = multiplayerEffectBoxes.get(game), events = boxes?.get(team) ?? [];
  boxes?.set(team, []);
  return events;
}

class MultiplayerTimeline {
  private frames: { time: number; entities: Map<number, Entity> }[] = [];
  private received = 0;
  private copiedTime = -1;
  private effects: MultiplayerEffect[] = [];
  readonly poses = new Map<number, Entity>();
  time = 0;
  reset() { this.frames = []; this.effects = []; this.poses.clear(); this.time = 0; this.received = 0; this.copiedTime = -1; }
  clearEffects() { this.effects = []; }
  push(frame: MultiplayerFrame, now: number) {
    if (this.frames.length && frame.time <= this.frames[this.frames.length - 1].time) return;
    this.frames.push({ time: frame.time, entities: new Map(frame.entities.map(e => [e.id, e])) });
    if (this.frames.length > 5) this.frames.shift();
    this.received = now;
    this.effects.push(...frame.effects);
    if (this.effects.length > 512) this.effects.splice(0, this.effects.length - 512);
  }
  advance(now: number, play: (event: MultiplayerEffect) => void): number {
    const latest = this.frames[this.frames.length - 1];
    if (!latest) return 0;
    const previous = this.time;
    // One snapshot plus a small jitter margin. Hold at the newest server position; never extrapolate.
    this.time = Math.max(this.time, Math.min(latest.time, latest.time + Math.max(0, now - this.received) / 1000 - .12));
    let left = this.frames[0], right = latest;
    for (const frame of this.frames) {
      if (frame.time <= this.time) left = frame;
      if (frame.time >= this.time) { right = frame; break; }
    }
    const alpha = right.time > left.time ? clamp((this.time - left.time) / (right.time - left.time), 0, 1) : 1;
    const fresh = this.copiedTime !== latest.time;
    this.copiedTime = latest.time;
    for (const id of this.poses.keys()) if (!latest.entities.has(id)) this.poses.delete(id);
    // The newest visibility set always wins: disappearances cannot leave interpolated ghosts.
    for (const [id, entity] of latest.entities) {
      const a = left.entities.get(id), b = right.entities.get(id);
      let pose = this.poses.get(id);
      if (!pose) this.poses.set(id, pose = { ...entity });
      // Stable view identity keeps dust continuous; copy metadata once per snapshot, not per render frame.
      if (fresh) {
        for (const key of Object.keys(pose)) if (!(key in entity)) delete (pose as unknown as Record<string, unknown>)[key];
        Object.assign(pose, entity);
      }
      if (!a || !b || a.kind !== b.kind || a.type !== b.type || Math.hypot(a.x - b.x, a.z - b.z) > 20) {
        pose.x = entity.x; pose.z = entity.z; pose.rot = entity.rot; pose.walk = entity.walk;
        continue;
      }
      const angle = Math.atan2(Math.sin(b.rot - a.rot), Math.cos(b.rot - a.rot));
      pose.x = a.x + (b.x - a.x) * alpha; pose.z = a.z + (b.z - a.z) * alpha;
      pose.rot = a.rot + angle * alpha; pose.walk = a.walk + (b.walk - a.walk) * alpha;
    }
    const due: MultiplayerEffect[] = [];
    while (this.effects.length && this.effects[0].time <= this.time) due.push(this.effects.shift()!);
    for (const event of due) if (this.time - event.time <= (event.kind === 'notice' ? 3 : .3)) play(event);
    return this.time - previous;
  }
}
