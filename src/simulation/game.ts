    /* Deterministic fixed-step RTS simulation. Rendering and UI are independent. */
    'use strict';
    const UNIT_BODY_SCALE = 1.4;
    function createParty(id: PlayerTeam, faction: FactionId, meta: Record<string, number>, benefits: Record<string, number>,
      loadout: readonly AbilityType[] = DEFAULT_ABILITY_LOADOUT): PartyState {
      return {
        id, faction, meta, benefits, loadout: normalizedAbilityLoadout(loadout), controller: { kind: 'human' },
        account: {
          alloy: STARTING_ALLOY[meta.startingAlloy || 0] + (benefits.supplyCrate || 0) * EXPEDITION_EFFECTS.alloy,
          gas: (benefits.aetherAllocation || 0) * EXPEDITION_EFFECTS.aether,
          energy: COMMAND_ENERGY.start + (benefits.commandCapacitor || 0) * EXPEDITION_EFFECTS.energy,
          abilities: Object.fromEntries(contentKeys(ABILITIES).map(key => [key, 0])) as Record<AbilityType, number>
        }
      };
    }
    // Validate before touching a running game, terrain or RNG. No implicit FFA/alliances.
    function scenarioSetup(opts: ScenarioOptions) {
      if (!Array.isArray(opts.parties) || !Array.isArray(opts.hostilities))
        throw Error('Scenario requires party and hostility arrays');
      const count = opts.parties.length;
      if (opts.startSeed !== undefined && (!Number.isSafeInteger(opts.startSeed) || opts.startSeed <= 0))
        throw Error('Invalid deployment seed');
      if (!Number.isInteger(opts.seed) || opts.seed <= 0 || !Object.hasOwn(BATTLEFIELDS, opts.map) ||
          count < 2 || count > 4 || !Number.isFinite(opts.duration) || opts.duration <= 0)
        throw Error('Scenario requires a seed, known map, 2–4 parties and a positive duration');
      if (Array.from(opts.parties).some(p => !p || !Number.isInteger(p.faction) || !FACTIONS[p.faction] ||
          !['human', 'ai'].includes(p.controller))) throw Error('Invalid scenario party');
      const matrix = opts.hostilities;
      if (matrix.length !== count || Array.from(matrix).some(row => !Array.isArray(row) || row.length !== count) ||
          matrix.some((row, a) => Array.from(row).some((enemy, b) => typeof enemy !== 'boolean' ||
            (a === b && enemy) || enemy !== matrix[b][a])))
        throw Error('Scenario requires an explicit symmetric hostility matrix with no self-hostility');
      return {
        parties: opts.parties.map((p, id) => createParty(id as PlayerTeam, p.faction, {}, normalizedBenefits(p.benefits))),
        aiTeams: opts.parties.flatMap((p, id) => p.controller === 'ai' ? [id as PlayerTeam] : []),
        rules: { kind: 'scenario', duration: opts.duration, hostilities: matrix.map(row => [...row]) } as BattleRules
      };
    }
    // Snapshot the single-player recipe without terrain, entities or random draws.
    function singlePlayerParties(profile: MeridianProfile, opts: BattleOptions): PartyState[] {
      const enemies = opts.enemies ?? [FACTION_ID.THIRD];
      if (!Array.isArray(enemies) || enemies.length < 1 || enemies.length > 3 ||
          Array.from(enemies).some(faction => !Number.isInteger(faction) || !FACTIONS[faction]))
        throw Error('Expedition battle requires 1–3 enemy factions');
      const savedMeta = profile.upgrades || {},
        meta = Object.fromEntries(
          (Object.keys(PERMANENT_UPGRADES) as UpgradeType[]).filter(key => Object.hasOwn(savedMeta, key)).map(key =>
            [key, clamp(Math.floor(Number(savedMeta[key]) || 0), 0, PERMANENT_UPGRADES[key].max)])
        );
      return [
        createParty(0, FACTIONS[opts.faction as FactionId] ? opts.faction as FactionId : FACTION_ID.FIRST,
          meta, normalizedBenefits(opts.benefits), normalizedAbilityLoadout(opts.abilities)),
        ...enemies.map((faction, slot) => createParty((slot + 1) as PlayerTeam, faction,
          {}, normalizedBenefits(opts.enemyBenefits?.[slot]), FACTION_ABILITY_LOADOUTS[faction]))
      ];
    }
    function createCommandQueue(): CommandQueue {
      return { tick: 0, nextSequence: 1, pending: [], lastResults: [], processing: false };
    }
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
      cosmeticRandom: () => number;
      effects: MeridianEffects;
      commandQueue: CommandQueue = createCommandQueue();
      presentation?: (event: SimulationPresentation) => void;
      networkTeam: PlayerTeam | null = null;
      networkSubmit?: (action: BattleAction) => boolean;

      get localTeam(): PlayerTeam { return this.world?.viewTeam ?? 0; }

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
        this.cosmeticRandom = seeded(1);
        // Preserve the single-player RNG contract; scenarios isolate all cosmetic draws.
        this.effects = createEffects(() => this.s?.rules.kind === 'scenario' ? this.cosmeticRandom() : this.random());
        this.effects.groundHeight = (x,z) => this.world?.surface?.heightAt(x,z) ?? 0;
        this.effects.entityHeight = e => this.world?.surface?.entityHeight(e) ?? 0;
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
      setPerspective(this: MeridianGame, team: PlayerTeam): boolean {
        if ((this.networkTeam != null && team !== this.networkTeam) ||
            !this.s || !this.world || !this.s.parties.some(p => p.id === team) ||
            (this.s.rules.kind === 'single-player' && team !== 0)) return false;
        if (team === this.localTeam) return true;
        if (!this.world.selectView(team)) return false;
        // Old local effects must not leak information into the newly selected view.
        this.effects.reset();
        return true;
      },
      resetRandom(this: MeridianGame, seed: number) {
        this.random = seeded(seed + 77);
        this.cosmeticRandom = seeded(seed ^ 0x4658524e);
      },
      start(this: MeridianGame, opts: BattleOptions = {}) {
        const mission = opts.mission === undefined ? DEFAULT_MISSION : opts.mission;
        if (typeof mission !== 'string' || !Object.hasOwn(MISSIONS, mission) || !MISSIONS[mission].maps.includes(battlefieldId(opts.map)))
          throw new Error('Unsupported mission/map combination');
        if (opts.deployment !== undefined && !['resource-start', 'exploration'].includes(opts.deployment))
          throw Error('Unsupported deployment mode');
        const parties = singlePlayerParties(this.profile, opts), state: MissionState = { id: mission };
        return this.startBattle(opts, parties, { kind: 'single-player', mission: state }, parties.slice(1).map(p => p.id));
      },
      startScenario(this: MeridianGame, opts: ScenarioOptions) {
        const { parties, rules, aiTeams } = scenarioSetup(opts);
        return this.startBattle(opts, parties, rules, aiTeams);
      },
      startBattle(this: MeridianGame, opts: BattleOptions & { startSeed?: number }, parties: PartyState[], rules: BattleRules, aiTeams: PlayerTeam[]) {
        const map = battlefieldId(opts.map),
          seed = opts.seed || Math.floor(Math.random() * 1e8);
        this.world = new Battlefield(seed, map, parties.length);
        const layout = this.world.layout;
        const deployment = rules.kind === 'scenario' ? 'exploration' : opts.deployment ??
          ((opts.depth ?? 0) === 0 && this.profile.expeditionDepth === 0 && !this.profile.tutorialComplete ? 'resource-start' : 'exploration');
        const starts = allocateBattlefieldStarts(this.world, rules.kind === 'scenario' ? opts.startSeed ?? seed : seed, parties.length, deployment), [playerStart] = starts;
        this.s = {
          seed, map,
          depth: clamp(Math.floor(Number(opts.depth) || 0), 0, 999999),
          time: 0,
          parties, rules, stopped: false,
          nextId: 1,
          entities: [], scans: [], strikes: [], fields: [], recalls: [],
          stats: { kills: 0, structuresDestroyed: 0, lost: 0, trained: 0, gathered: 0, built: 0, damage: 0 },
          triggers: {},
          cam: { x: playerStart.x + 5, z: playerStart.z - 2, zoom: 57 },
          result: null,
          speed: 1
        };
        this.resetRandom(seed);
        this.commandQueue = createCommandQueue();
        this.ids.clear();
        this.effects.reset();
        this.acc = 0;
        this.fogClock = 0;
        this.resultClock = 0;
        let s = this.s!;
        // Reserve the former HQ's ID/RNG draw without placing a starting structure.
        this.random(); s.nextId++;
        // Keep the former default loadout's RNG entry point for crystal amounts and enemy spawns.
        for (let i = 0; i < 24; i++) this.random();
        for (let [i, site] of layout.resourceSites.entries()) {
          for (let j = 0; j < 5; j++) {
            let p = this.crystalPosition(i, j);
            this.spawnResource('crystal', p.x, p.z, 1800 + Math.floor(this.random() * 900));
          }
          const gas = battlefieldGasPosition(site);
          this.spawnResource('gas', gas.x, gas.z, 999999);
        }
        this.random(); s.nextId++;
        // Preserve the established resource/bonus-worker RNG entry points, not the old loadout.
        for (let i = 0; i < 11; i++) this.random();
        // Former extra-HQ slots follow the protected two-party/resource RNG sequence.
        for (let i = 2; i < parties.length; i++) {
          this.random(); s.nextId++;
        }
        this.world.rebuild(s.entities);
        this.rehash();
        for (let e of s.entities)
          if (e.kind === 'unit') {
            let p = this.unitPosition(e);
            if (!p) throw new Error('No free space for starting units.');
            Object.assign(e, p);
          }
        // Add bonus units only after the original layout and enemy RNG draws.
        for (const party of parties) {
          const team = party.id, perks = party.benefits, home = starts[team],
            workers = (party.meta.startingWorkers || 0) + (perks.pioneerSquad || 0);
          for (let i = 0; i < workers; i++)
            if (!this.spawnDeploymentUnit('worker', { x: home.x - 7, z: home.z - 4 + i * 2 }, home, team, this.factionFor(team)))
              throw new Error('No free space for starting workers.');
          if (perks.commanderMandate &&
            !this.spawnDeploymentUnit('hero', { x: home.x - 9, z: home.z + 7 }, home, team, this.factionFor(team)))
            throw new Error('No free space for starting commander.');
        }
        for (const party of parties) {
          const home = starts[party.id];
          party.deploymentPending = true;
          party.account.alloy += BUILDINGS.hq.cost;
          if (!this.spawnDeploymentUnit('worker', home, home, party.id, party.faction, true))
            throw new Error('No free space for deployment worker.');
        }
        this.rehash();
        this.world.reveal(s.entities);
        for (const party of parties) if (party.benefits.surveyDrones) {
          const team = party.id, home = starts[team],
            site = layout.resourceSites.filter(p => !this.world!.sight[team].explored[this.world!.idx(p.x, p.z)])
              .sort((a, b) => distance(a, home) - distance(b, home))[0];
          if (site) this.world.explore(team, site, EXPEDITION_EFFECTS.surveyRadius);
        }
        for (const team of aiTeams) this.enableAI(team);
        // CPU scenarios must never enter the expedition UI or pay out profile rewards.
        if (rules.kind === 'scenario') return s;
        this.emit('start', {});
        this.emit('radio', deployment === 'resource-start'
          ? 'Expedition command|Resources are in sight. Deploy your command outpost from Build to establish a base.'
          : 'Expedition command|Explore with your worker and find resources before choosing a site for your command outpost. Construction reserves are aboard.');
        return s;
      },
      benefitsFor(this: MeridianGame, team: PlayerTeam): Record<string, number> {
        return this.party(team).benefits;
      },
      startingPositions(this: MeridianGame, seed: number, count = 2): Position[] {
        return allocateBattlefieldStarts(this.world!, seed, count, 'exploration');
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
      spawnDeploymentUnit(this: MeridianGame, type: UnitType, preferred: Position, home: Position,
        team: PlayerTeam, faction: FactionId, primary = false) {
        const world = this.world!, size = UNITS[type].size, points: Position[] = [preferred, home];
        for (let i = 0; i < world.deploymentReachable.length; i++) if (world.deploymentReachable[i]) {
          const p = world.point(i); if (distance(p, home) <= 20) points.push(p);
        }
        points.sort((a, b) => distance(a, preferred) - distance(b, preferred));
        const p = points.find(p => world.deploymentReachable[world.idx(p.x, p.z)] &&
          (primary || distance(p, home) >= (size + UNITS.worker.size) * UNIT_BODY_SCALE) &&
          world.surface!.segment(p, world.point(world.idx(p.x, p.z)), size * UNIT_BODY_SCALE) &&
          this.unitFits({ ...p, type, size }, p.x, p.z));
        return p ? this.spawnUnit(type, p.x, p.z, team, faction) : null;
      },
      crystalPosition(this: MeridianGame, siteIndex: number, depositIndex: number): Position {
        return battlefieldCrystalPosition(this.world!.layout.resourceSites[siteIndex], siteIndex, depositIndex);
      },
      spawnResource(this: MeridianGame, type: ResourceType, x: number, z: number, amount: number) {
        return this.spawn('resource', type, x, z, -1, FACTION_ID.FIRST, { amount, size: type === 'gas' ? 1.5 : 1.3 });
      },
      party(this: MeridianGame, team: PlayerTeam = 0): PartyState { return this.s!.parties[team]; },
      account(this: MeridianGame, team: PlayerTeam = 0): TeamState { return this.party(team).account; },
      factionFor(this: MeridianGame, team: PlayerTeam = 0): FactionId {
        return this.party(team).faction;
      },
      notify(this: MeridianGame, team: PlayerTeam, ...event: GameEvent) {
        this.presentation?.({ kind: 'notice', team, event });
        if (team === this.localTeam) this.emit(...event);
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
        const rules = this.s!.rules;
        if (a.team === -1 || b.team === -1 || a.team === b.team) return false;
        if (rules.kind === 'single-player') return true;
        return rules.hostilities[a.team]?.[b.team] === true;
      },
      visible(this: MeridianGame, e: Position & { team?: TeamId }) { return this.canSee(this.localTeam, e); },
      observed(this: MeridianGame, e: Entity) {
        return e.team === -1 ? !!this.world!.explored[this.world!.idx(e.x, e.z)] : this.visible(e);
      },
      canSee(this: MeridianGame, team: PlayerTeam, e: Position & {team?: TeamId}) {
        return e.team === team || !!this.world!.sight[team].visible[this.world!.idx(e.x, e.z)];
      },
    };
    type GameMethods = typeof gameMethods;
    interface MeridianGame extends GameMethods {}
    defineMeridianGameMethods(gameMethods);
