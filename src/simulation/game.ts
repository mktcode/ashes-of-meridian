    /* Deterministic fixed-step RTS simulation. Rendering and UI are independent. */
    'use strict';
    const UNIT_BODY_SCALE = 1.4;
    class MeridianGame {
      profile: MeridianProfile;
      emit: GameEventSink;
      s: RunState | null;
      world: Battlefield | null;
      ids: Map<number, Entity>;
      spatial: Map<string, Entity[]>;
      acc: number;
      fogClock: number;
      resultClock: number;
      navDirty: boolean;
      random: () => number;
      effects: MeridianEffects;

      constructor(
        profile: MeridianProfile,
        emit: GameEventSink = () => {},
        createEffects: (random: () => number) => MeridianEffects = random => new MeridianEffects(random)
      ) {
        this.profile = profile;
        this.emit = emit;
        this.s = null;
        this.world = null;
        this.ids = new Map();
        this.spatial = new Map();
        this.acc = 0;
        this.fogClock = 0;
        this.resultClock = 0;
        this.navDirty = false;
        this.random = seeded(1);
        this.effects = createEffects(() => this.random());
      }
    }
    function defineMeridianGameMethods(methods: Record<string, Function>) {
      for (const [name, method] of Object.entries(methods))
        Object.defineProperty(MeridianGame.prototype, name, {
          value: method,
          configurable: true,
          writable: true
        });
    }
    const gameMethods = {
      start(this: MeridianGame, opts: BattleOptions = {}) {
        let faction: FactionId = FACTIONS[opts.faction as FactionId] ? opts.faction as FactionId : FACTION_ID.FIRST,
          enemy: FactionId = FACTIONS[opts.enemy as FactionId] ? opts.enemy as FactionId : FACTION_ID.THIRD,
          map = battlefieldId(opts.map),
          layout = BATTLEFIELDS[map].layout,
          savedMeta = this.profile.upgrades || {},
          meta = Object.fromEntries(
            (Object.keys(META) as UpgradeType[]).filter(key => Object.hasOwn(savedMeta, key)).map(key =>
              [key, clamp(Math.floor(Number(savedMeta[key]) || 0), 0, META[key].max)])
          ),
          benefits = normalizedBenefits(opts.benefits), enemyBenefits = normalizedBenefits(opts.enemyBenefits),
          seed = opts.seed || Math.floor(Math.random() * 1e8),
          playerAlloy = STARTING_ALLOY[meta.startingAlloy || 0] + (benefits.supplyCrate || 0) * EXPEDITION_EFFECTS.alloy;
        this.world = new Battlefield(seed, map);
        this.world.startSites = battlefieldStartSites(this.world);
        const [playerStart, enemyStart] = this.startingPositions(seed);
        this.s = {
          seed, faction, enemy, map, meta, benefits, enemyBenefits,
          depth: clamp(Math.floor(Number(opts.depth) || 0), 0, 999999),
          time: 0,
          teams: [benefits, enemyBenefits].map((perks, team) => ({
            alloy: team === 0 ? playerAlloy : STARTING_ALLOY[0] + (perks.supplyCrate || 0) * EXPEDITION_EFFECTS.alloy,
            gas: (perks.aetherAllocation || 0) * EXPEDITION_EFFECTS.aether,
            energy: COMMAND_ENERGY.start + (perks.commandCapacitor || 0) * EXPEDITION_EFFECTS.energy,
            abilities: { orbital: 0, repair: 0, scan: 0, drop: 0 }
          })) as [TeamState, TeamState],
          nextId: 1,
          entities: [], scans: [], strikes: [], fields: [],
          ai: {},
          stats: { kills: 0, lost: 0, trained: 0, gathered: 0, built: 0, damage: 0 },
          triggers: {},
          cam: { x: playerStart.x + 5, z: playerStart.z - 2, zoom: 57 },
          result: null,
          speed: 1
        };
        this.random = seeded(seed + 77);
        this.ids.clear();
        this.effects.reset();
        this.acc = 0;
        this.fogClock = 0;
        this.resultClock = 0;
        let s = this.s!;
        // The base starts with an HQ; upgrade workers are added after the seeded setup.
        this.spawnBuilding('hq', playerStart.x, playerStart.z, 0, faction);
        // Keep the former default loadout's RNG entry point for crystal amounts and enemy spawns.
        for (let i = 0; i < 24; i++) this.random();
        for (let [i, site] of layout.resourceSites.entries()) {
          for (let j = 0; j < 5; j++) {
            let p = this.crystalPosition(i, j);
            this.spawnResource('crystal', p.x, p.z, 1800 + Math.floor(this.random() * 900));
          }
          this.spawnResource('gas', site.x + (i === 0 ? 5 : 7), site.z + (i === 0 ? 18 : 7), 999999);
        }
        let site = enemyStart;
        this.spawnBuilding('hq', site.x, site.z, 1, enemy);
        // Preserve the established resource/bonus-worker RNG entry points, not the old loadout.
        for (let i = 0; i < 11; i++) this.random();
        this.world.rebuild(s.entities);
        this.rehash();
        for (let e of s.entities)
          if (e.kind === 'unit') {
            let p = this.unitPosition(e);
            if (!p) throw new Error('No free space for starting units.');
            Object.assign(e, p);
          }
        // Add bonus units only after the original layout and enemy RNG draws.
        const startingWorkers = (meta.startingWorkers || 0) + (benefits.pioneerSquad || 0);
        for (const team of [0, 1] as const) {
          const perks = this.benefitsFor(team), home = team === 0 ? playerStart : enemyStart,
            workers = team === 0 ? startingWorkers : (perks.pioneerSquad || 0);
          for (let i = 0; i < workers; i++)
            if (!this.spawnUnit('worker', home.x - 7, home.z - 4 + i * 2, team, this.factionFor(team)))
              throw new Error('No free space for starting workers.');
          if (perks.commanderMandate &&
            !this.spawnUnit('hero', home.x - 9, home.z + 7, team, this.factionFor(team)))
            throw new Error('No free space for starting commander.');
        }
        this.rehash();
        this.world.reveal(s.entities);
        for (const team of [0, 1] as const) if (this.benefitsFor(team).surveyDrones) {
          const home = team === 0 ? playerStart : enemyStart,
            site = layout.resourceSites.filter(p => !this.world!.sight[team].explored[this.world!.idx(p.x, p.z)])
              .sort((a, b) => distance(a, home) - distance(b, home))[0];
          if (site) this.world.explore(team, site, EXPEDITION_EFFECTS.surveyRadius);
        }
        this.enableAI(1);
        this.emit('start', {});
        this.emit('radio', startingWorkers
          ? 'Expedition command|Your starting workers will harvest alloy automatically. Expand your economy, then destroy the enemy command center.'
          : 'Expedition command|Recruit your first worker from Infantry to establish your economy, then destroy the enemy command center.');
        return s;
      },
      benefitsFor(this: MeridianGame, team: PlayerTeam): Record<string, number> {
        return team === 0 ? this.s!.benefits : this.s!.enemyBenefits;
      },
      startingPositions(this: MeridianGame, seed: number): [Position, Position] {
        // Separate stream: replayable corner assignment never shifts terrain/resources/effects RNG.
        const random = seeded(seed ^ 0x53544152), available = [...this.world!.startSites],
          player = available.splice(Math.floor(random() * available.length), 1)[0];
        return [player, available[Math.floor(random() * available.length)]];
      },
      spawn<K extends EntityKind>(this: MeridianGame, kind: K, type: EntityTypeForKind<K>, x: number, z: number, team: TeamId, faction: FactionId = FACTION_ID.FIRST, extra: SpawnExtra = {}): EntityForKind<K> {
        let s = this.s!,
          d: Partial<BuildingDefinitionShape & UnitDefinitionShape> = kind === 'building'
            ? BUILDINGS[type as BuildingType]
            : UNITS[type as UnitType] || {},
          hp = d.hp || 1000;
        if (kind === 'unit') {
          if (faction === FACTION_ID.SECOND) hp *= 0.9;
          if (faction === FACTION_ID.THIRD) hp *= 0.85;
          if (faction === FACTION_ID.FIRST && ['tank', 'artillery'].includes(type)) hp *= 1.15;
        }
        let e = {
          id: s.nextId++,
          kind,
          type,
          x,
          z,
          team,
          faction,
          hp,
          maxHp: hp,
          size: d.size || 2,
          vision: d.vision || (kind === 'building' ? 21 : 17),
          rot: team === 1 ? Math.PI : 0,
          progress: 1,
          queue: [],
          order: { type: 'idle' },
          path: [],
          pi: 0,
          walk: 0,
          cd: this.random() * 0.5,
          nextThink: 0,
          nextPath: 0,
          lastHit: -100,
          kills: 0,
          carry: 0,
          work: 0,
          shield: faction === FACTION_ID.THIRD && kind === 'unit' ? hp * 0.32 : 0,
          maxShield: faction === FACTION_ID.THIRD && kind === 'unit' ? hp * 0.32 : 0,
          ...extra
        } as unknown as EntityForKind<K>;
        s.entities.push(e);
        this.ids.set(e.id, e);
        return e;
      },
      spawnBuilding(this: MeridianGame, type: BuildingType, x: number, z: number, team: TeamId, faction: FactionId, extra: SpawnExtra = {}) {
        return this.spawn('building', type, x, z, team, faction, extra);
      },
      spawnUnit(this: MeridianGame, type: UnitType, x: number, z: number, team: TeamId, faction: FactionId, extra: SpawnExtra = {}) {
        const p = this.unitPosition({ type, size: UNITS[type].size, x, z, ...extra });
        if (!p) return null;
        return this.spawn('unit', type, p.x, p.z, team, faction, { ...extra, ...p });
      },
      crystalPosition(this: MeridianGame, siteIndex: number, depositIndex: number): Position {
        // Leave a gap toward the adjacent starting factory at the eastern site.
        const phase = siteIndex === 5 ? 4.7 : siteIndex * 0.8;
        const site = this.world!.layout.resourceSites[siteIndex], a = (depositIndex * Math.PI * 2) / 5 + phase;
        return { x: site.x + Math.sin(a) * 3.9, z: site.z + Math.cos(a) * 3.0 };
      },
      spawnResource(this: MeridianGame, type: ResourceType, x: number, z: number, amount: number) {
        return this.spawn('resource', type, x, z, -1, FACTION_ID.FIRST, { amount, size: type === 'gas' ? 1.5 : 1.3 });
      },
      account(this: MeridianGame, team: PlayerTeam = 0): TeamState { return this.s!.teams[team]; },
      factionFor(this: MeridianGame, team: PlayerTeam = 0): FactionId {
        return team === 0 ? this.s!.faction : this.s!.enemy;
      },
      notify(this: MeridianGame, team: PlayerTeam, ...event: GameEvent) {
        if (team === 0) this.emit(...event);
      },
      get(this: MeridianGame, id: number | null | undefined): Entity | null {
        let e = this.ids.get(id as number);
        return e && e.hp > 0 ? e : null;
      },
      alive(this: MeridianGame, filter: (entity: Entity) => boolean = () => true): Entity[] {
        return this.s!.entities.filter(e => e.hp > 0 && filter(e));
      },
      closest(this: MeridianGame, pos: Position, filter: (entity: Entity) => boolean): Entity | null {
        let best = null,
          d = Infinity;
        for (let e of this.s!.entities)
          if (e.hp > 0 && filter(e)) {
            let dd = distance(pos, e);
            if (dd < d) {
              d = dd;
              best = e;
            }
          }
        return best;
      },
      rehash(this: MeridianGame) {
        this.spatial.clear();
        for (let e of this.s!.entities) {
          if (e.hp <= 0 || !['building', 'unit'].includes(e.kind)) continue;
          // Coordinate pairs cannot alias rows as map size or query radius grows.
          let key = `${Math.floor((e.x + this.world!.extent) / 10)},${Math.floor((e.z + this.world!.extent) / 10)}`;
          if (!this.spatial.has(key)) this.spatial.set(key, []);
          this.spatial.get(key)!.push(e);
        }
      },
      near(this: MeridianGame, x: number, z: number, r: number, filter: (entity: Entity) => boolean = () => true): Entity[] {
        let out = [],
          a = Math.floor((x - r + this.world!.extent) / 10),
          b = Math.floor((x + r + this.world!.extent) / 10),
          c = Math.floor((z - r + this.world!.extent) / 10),
          d = Math.floor((z + r + this.world!.extent) / 10),
          rr = r * r;
        for (let j = c; j <= d; j++)
          for (let i = a; i <= b; i++) {
            let arr = this.spatial.get(`${i},${j}`);
            if (arr)
              for (let e of arr)
                if (e.hp > 0 && (e.x - x) ** 2 + (e.z - z) ** 2 < rr && filter(e))
                  out.push(e);
          }
        return out;
      },
      enemy(this: MeridianGame, a: Pick<EntityBase, 'team'>, b: Pick<EntityBase, 'team'>) {
        return a.team === 1 ? b.team === 0 : b.team === 1;
      },
      visible(this: MeridianGame, e: Entity) { return this.canSee(0, e); },
      canSee(this: MeridianGame, team: PlayerTeam, e: Position & {team?: TeamId}) {
        return e.team === team || !!this.world!.sight[team].visible[this.world!.idx(e.x, e.z)];
      },
    };
    type GameMethods = typeof gameMethods;
    interface MeridianGame extends GameMethods {}
    defineMeridianGameMethods(gameMethods);
