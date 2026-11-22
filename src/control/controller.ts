import {earlyBuildWindow,constructionContext} from '../advisors/build-queue.js';
import { randomUUID } from "node:crypto";
import {
  createServer as createLeaseServer,
  type Server as LeaseServer,
} from "node:net";
import type {
  Action,
  ActionsResponse,
  HistoryResponse,
  MapResponse,
  ReportsResponse,
  Report,
  Resources,
  SimulateBattleResponse,
  MeResponse,
  RulesResponse,
  StateResponse,
  WorldSummary,
} from "../shared/api.js";
import {
  productionScope,
  productionView,
  trackProduction,
} from "./production.js";
import { economicAdvisor, forecastEconomy } from "../advisors/economic.js";
import { economicCityAdvisor } from "../advisors/economic-city.js";
import { logisticsAdvisor } from "../advisors/logistics.js";
import { militaryAdvisor } from "../advisors/military.js";
import { expansionReadiness } from "../advisors/sustained-defense.js";
import { prioritizeFarmRunway } from "../advisors/farm-runway.js";
import {applyConquest, conquestScope, conquestTravel, conquestTargetLoyalty, recurringConquestFits, type ConquestContext} from "../advisors/conquest.js";
import { BARRACKS_CAP, militaryUnlocked, RAIDER_SEND_MIN } from "../advisors/defense-budget.js";
import {safeEnvoyAttack} from "../review/conquest-plan.js";
import type { AdvisorContext, Proposal } from "../advisors/types.js";
import type { ControlStorage } from "./storage.js";
import { allocateWithPresident } from "../bot/allocation/president.js";
import { effectiveRoles, evaluatePlanning, reachedNodes, routeReplaced } from "../bot/plan/evaluate.js";
import { PLAN } from "../bot/plan/graph.js";
import { BotRunner } from "../bot/runner/runner.js";
import { prepareJournalEntry } from "../bot/execution/journal.js";
import { conquestMission, conquestPlan, type MissionInstance } from "../bot/strategy/missions/conquest.js";
import { cityRoles, filterProposalsByRole } from "../bot/strategy/roles.js";
import {
  remoteRequest,
  RemoteError,
  validateOrigin,
  type Remote,
} from "./remote.js";
import type {
  ControlView,
  Decision,
  Pending,
  SavedControl,
  Settings,
} from "./types.js";

function proposalDescription(proposal: Proposal): string {
  return proposal.action.type === "trade"
    ? proposal.buildingName
    : `${proposal.buildingName} target ${proposal.targetLevel}`;
}

function tradeResourcesMatch(expected: Partial<Resources>, actual: Resources): boolean {
  return (["timber", "stone", "iron"] as const).every(resource =>
    (expected[resource] ?? 0) === actual[resource]
  );
}

/** A kernel-owned loopback listener is a process lease, automatically released even after a crash. */
export async function acquireExecutorLease(port = 8790): Promise<LeaseServer> {
  const server = createLeaseServer((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
}
export class Controller {
  private saved: SavedControl;
  private automatic = true;
  private revision = 0;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private backoffUntil = 0;
  private lastPlan = "";
  private metadata: {
    revision: number;
    at: number;
    me: MeResponse;
    worlds: WorldSummary[];
  } | null = null;
  private cachedRules: {
    revision: number;
    epoch: string;
    worldId: string;
    version: number;
    rules: RulesResponse;
  } | null = null;
  private conquest: ConquestContext | undefined;
  private conquestReports: ReportsResponse = { reports: [], next: null };
  private persistence: Promise<void> = Promise.resolve();
  private runner!: BotRunner<void>;
  private view: Omit<
    ControlView,
    | "settings"
    | "automatic"
    | "busy"
    | "decisions"
    | "pending"
    | "nextAttemptAt"
  > = {
    connection: "unconfigured",
    error: null,
    lastEvaluatedAt: null,
    account: null,
    worlds: [],
    world: null,
    villages: [],
    proposals: [],
    selection: {
      selected: null,
      reason: "Waiting for a configured player and world.",
      reservations: [],
    },
    conflicts: [],
    production: null,
    economicForecasts: [],
    planning: {
      version: 1,
      revision: 0,
      scope: "",
      rulesVersion: 0,
      observedTick: 0,
      evaluatedAt: "",
      nodes: [],
      edges: PLAN.edges,
      villages: [],
      missions: [],
      candidates: [],
      allocation: { selectedCandidateId: null, reasonCode: "NOT_EVALUATED", excluded: [] },
      reservations: [],
      operations: [],
      wake: null,
    },
  };
  private constructor(
    saved: SavedControl,
    private storage: ControlStorage,
    private request: Remote,
    private now: () => number,
  ) {
    this.saved = saved;
    this.runner = new BotRunner(() => this.runCycle());
  }
  static async create(
    storage: ControlStorage,
    initial: Settings,
    request: Remote = remoteRequest,
    now: () => number = Date.now,
    options: { execute?: boolean } = {},
  ): Promise<Controller> {
    const saved = (await storage.load()) ?? {
      settings: initial,
      pending: null,
      decisions: [],
      missions: [],
    };
    if (!saved.recoveryRequired && !saved.persistenceFault)
      saved.settings.serverUrl = validateOrigin(saved.settings.serverUrl);
    const controller = new Controller(saved, storage, request, now);
    controller.automatic = saved.recoveryRequired || saved.persistenceFault
      ? false
      : options.execute ?? saved.automatic ?? true;
    if (saved.recoveryRequired || saved.persistenceFault) {
      controller.view.connection = "error";
      controller.view.error = saved.recoveryRequired ?? saved.persistenceFault ?? null;
      return controller;
    }
    await controller.persist();
    return controller;
  }
  get settings(): Settings {
    return { ...this.saved.settings };
  }
  snapshot(): ControlView {
    const { apiKey, ...settings } = this.saved.settings;
    // A pending operation contains no credentials. All returned objects are serialized by the HTTP layer.
    return {
      ...this.view,
      settings: {
        ...settings,
        keyConfigured: !!apiKey,
        keyHint: apiKey ? `••••••••${apiKey.slice(-4)}` : "Not configured",
      },
      automatic: this.automatic,
      busy: this.busy,
      decisions: this.saved.decisions,
      pending: this.saved.pending ?? this.saved.active?.[0] ?? null,
      active: this.saved.active ?? [],
      nextAttemptAt:
        this.backoffUntil > this.now()
          ? new Date(this.backoffUntil).toISOString()
          : null,
    };
  }
  private persist(): Promise<void> {
    if (this.saved.recoveryRequired || this.saved.persistenceFault) {
      return Promise.reject(new Error(
        this.saved.recoveryRequired ?? "Control state persistence failed; execution is blocked.",
      ));
    }
    const value = structuredClone({ ...this.saved, automatic: this.automatic });
    this.persistence = this.persistence
      .catch(() => undefined)
      .then(() => this.storage.save(value))
      .catch((error: unknown) => {
        this.saved.persistenceFault = "Control state persistence failed; execution is blocked.";
        this.automatic = false;
        this.view.connection = "error";
        this.view.error = this.saved.persistenceFault;
        throw error;
      });
    return this.persistence;
  }
  private record(
    kind: Decision["kind"],
    text: string,
    proposal?: Proposal,
    clientId?: string,
    tick?: number,
  ): void {
    this.saved.decisions.unshift({
      id: randomUUID(),
      at: new Date(this.now()).toISOString(),
      kind,
      text,
      proposalId: proposal?.id,
      clientId,
      tick,
    });
    this.saved.decisions = this.saved.decisions.slice(0, 100);
  }
  async configure(input: Partial<Settings>): Promise<void> {
    if (this.busy)
      throw new Error(
        "An evaluation is in progress; retry settings in a moment.",
      );
    const settings = { ...this.saved.settings, ...input };
    settings.serverUrl = validateOrigin(settings.serverUrl);
    if (!settings.worldId.trim() || !settings.apiKey.trim())
      throw new Error("A player key and world are required.");
    this.revision++;
    this.backoffUntil = 0;
    this.saved.settings = settings;
    this.lastPlan = "";
    this.view = {
      ...this.view,
      connection: "connecting",
      account: null,
      world: null,
      villages: [],
      proposals: [],
      economicForecasts: [],
      production: null,
      selection: {
        selected: null,
        reason: "Revalidating connection.",
        reservations: [],
      },
      error: null,
    };
    this.record(
      "waiting",
      "Connection settings updated; revalidating the account with the current execution preference.",
    );
    await this.persist();
    await this.cycle();
  }
  async setAutomatic(enabled: boolean): Promise<void> {
    if (enabled && (this.saved.recoveryRequired || this.saved.persistenceFault))
      throw new Error(this.saved.recoveryRequired ?? "Control state persistence failed; execution is blocked.");
    if (
      enabled &&
      (this.view.connection !== "connected" ||
        !this.view.account ||
        !this.view.world)
    )
      throw new Error(
        "The bot needs a valid game connection before it can run.",
      );
    this.automatic = enabled;
    this.revision++;
    this.record(
      "waiting",
      enabled
        ? "Bot execution resumed; decisions are revalidated against live state."
        : "Bot execution paused by operator.",
    );
    try {
      await this.persist();
    } catch (e) {
      this.automatic = false;
      this.revision++;
      throw e;
    }
  }
  async resolveUncertain(acknowledged: boolean): Promise<void> {
    if (this.automatic || this.busy || !acknowledged)
      throw new Error(
        "Pause execution and acknowledge inspection of the game activity log first.",
      );
    const pending = this.saved.pending;
    if (!pending) return;
    if (pending.phase === "accepted")
      throw new Error(
        "Accepted work is still tracked; wait for completion or cancel it in Town view.",
      );
    this.record(
      "uncertain",
      "Operator inspected the activity log and cleared this uncertain operation. Its original request ID remains in history.",
      pending.proposal,
      pending.action.clientId,
    );
    this.saved.pending = null;
    this.automatic = !this.saved.persistenceFault && !this.saved.recoveryRequired;
    this.backoffUntil = 0;
    await this.persist();
  }
  start(intervalMs = 1000): void {
    const run = async () => {
      if (this.stopped) return;
      await this.cycle();
      if (!this.stopped) this.timer = setTimeout(() => void run(), intervalMs);
    };
    void run();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.revision++;
    if (this.timer) clearTimeout(this.timer);
    await this.runner.stop();
  }
  private path(suffix: string): string {
    return `/worlds/${encodeURIComponent(this.saved.settings.worldId)}${suffix}`;
  }
  private async readMetadata(force = false) {
    if (
      !force &&
      this.metadata?.revision === this.revision &&
      this.now() - this.metadata.at < 30000
    )
      return this.metadata;
    const [me, worlds] = await Promise.all([
      this.request<MeResponse>(this.settings, "/me"),
      this.request<WorldSummary[]>(this.settings, "/worlds"),
    ]);
    this.metadata = { revision: this.revision, at: this.now(), me, worlds };
    return this.metadata;
  }
  private async readContext(forceRules = false): Promise<AdvisorContext> {
    const settings = this.settings;
    const state = await this.request<StateResponse>(
      settings,
      this.path("/state"),
    );
    if (state.world.id !== settings.worldId)
      throw new Error("Returned state belongs to another world.");
    const cached = this.cachedRules;
    const valid =
      cached?.revision === this.revision &&
      cached.worldId === state.world.id &&
      cached.epoch === state.world.epoch &&
      cached.version === state.world.rulesVersion;
    const rules =
      valid && !forceRules
        ? cached.rules
        : await this.request<RulesResponse>(settings, this.path("/rules"));
    if (rules.version !== state.world.rulesVersion)
      throw new Error(
        "Rules version mismatch; wait for compatible live rules.",
      );
    this.cachedRules = {
      revision: this.revision,
      worldId: state.world.id,
      epoch: state.world.epoch,
      version: rules.version,
      rules,
    };
    return { state, rules };
  }
  /** Join is idempotent upstream: retries return the existing village, never another one. */
  private async readJoinedContext(
    worlds: WorldSummary[],
    revision: number,
  ): Promise<AdvisorContext> {
    let context: AdvisorContext | undefined;
    let missing: unknown;
    try {
      context = await this.readContext();
      if (context.state.villages.length) return context;
    } catch (error) {
      if (!(error instanceof RemoteError) || error.code !== "NOT_IN_WORLD")
        throw error;
      missing = error;
    }
    worlds = (await this.readMetadata(true)).worlds;
    const world = worlds.find((w) => w.id === this.settings.worldId);
    if (
      !this.automatic ||
      this.stopped ||
      revision !== this.revision ||
      world?.status !== "running"
    ) {
      if (context) return context;
      throw missing;
    }
    this.record(
      "submitted",
      `Automatically joining ${world.name}, round ${world.round}.`,
      undefined,
      undefined,
      world.tick,
    );
    await this.persist();
    if (!this.automatic || this.stopped || revision !== this.revision) {
      if (context) return context;
      throw missing;
    }
    await this.request<StateResponse>(this.settings, this.path("/join"), {});
    // Refresh both state and rules: joining may race a round transition.
    const joined = await this.readContext();
    if (!joined.state.villages.length)
      throw new Error(
        "World join returned no village; the bot will retry after refreshing state.",
      );
    this.record(
      "confirmed",
      `Joined ${joined.state.world.name}, round ${joined.state.world.round}; managing ${joined.state.villages.map((v) => v.name).join(", ")}.`,
      undefined,
      undefined,
      joined.state.world.tick,
    );
    return joined;
  }
  /** Research transition uses only the existing executor. No timers or independent spender. */
  private async readConquest(context: AdvisorContext): Promise<void> {
    const {state,rules}=context;
    const scope=conquestScope(this.settings.serverUrl,this.view.account!.id,context);
    const scopedMissions=(this.saved.missions??[]).filter(value=>value.scope===scope)
      .sort((a,b)=>a.startedTick-b.startedTick);
    const latest=scopedMissions.at(-1);
    let mission=latest;
    let newlyStarted=false;
    let admissionMap:MapResponse|undefined;
    if(!mission&&state.villages.length===1&&state.world.status==='running'){
      const v=state.villages[0];
      if(militaryUnlocked(v)&&v.buildings.barracks>=BARRACKS_CAP&&!Object.values(v.orders).some(q=>q.length)){
        mission=conquestMission({scope,villageId:v.id,startedTick:state.world.tick,status:'preparing',waves:0});
        newlyStarted=true;
      }
    }
    if(!scopedMissions.some(value=>value.status==='active')&&latest&&
      (latest.status==='completed'||latest.status==='failed')&&state.villages.length>=2&&
      state.world.status==='running'){
      const roles=cityRoles(context,scopedMissions);
      const capital=state.villages.find(village=>roles.get(village.id)?.role==='capital');
      if(capital&&expansionReadiness(context,roles).ready){
        admissionMap=await this.request<MapResponse>(this.settings,this.path('/map')).catch(()=>undefined);
        if(recurringConquestFits(context,capital,admissionMap)){
          mission=conquestMission({
            scope,
            villageId:capital.id,
            startedTick:state.world.tick,
            status:'preparing',
            waves:0,
            sequence:(latest.sequence??1)+1,
          });
          newlyStarted=true;
        }
      }
    }
    if(!mission){this.conquest=undefined;this.conquestReports={reports:[],next:null};return;}
    if(newlyStarted){
      this.saveConquestPlan(conquestPlan(mission));
      await this.persist();
    }
    const plan=conquestPlan(mission);
    const hasPendingWave=[this.saved.pending,...(this.saved.active??[])].some(p=>p?.missionId===mission!.id&&p.action.type==='send');
    this.conquestReports=hasPendingWave
      ? await this.request<ReportsResponse>(this.settings,this.path('/reports'))
      : {reports:[],next:null};
    const savePlan=()=>{this.saveConquestPlan(plan);};
    const v=state.villages.find(v=>v.id===plan.villageId);
    if(!v){plan.status='stopped';plan.reason='Origin lost';}
    if(plan.targetId&&state.villages.some(v=>v.id===plan.targetId)){
      plan.status='captured';plan.capturedTick??=state.world.tick;
    }
    this.conquest={plan};
    if(plan.status!=='preparing'||!v||Math.min(v.buildings.lumberyard,v.buildings.quarry,v.buildings.mine)<15){savePlan();return;}
    const map=admissionMap??await this.request<MapResponse>(this.settings,this.path('/map'));
    this.conquest.map=map;
    if(!plan.targetId){
      plan.targetId=map.villages.filter(t=>t.ownerId===null).sort((a,b)=>
        Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y)||a.id.localeCompare(b.id))[0]?.id;
      if(!plan.targetId){plan.status='stopped';plan.reason='No unowned target';savePlan();return;}
    }
    if(map.villages.find(t=>t.id===plan.targetId)?.ownerId!==null){plan.status='stopped';plan.reason='Target ownership changed';savePlan();return;}
    const hamlet=rules.rules.MAP as {hamletLevels:{wall:number[]};hamletBaseDefense:number;hamletMilitiaCap:number;hamletMilitiaPerTick:number};
    if(!plan.escort){
      for(let n=20;n<=1000;n+=20){
        const battle=await this.request<SimulateBattleResponse>(this.settings,this.path('/simulate/battle'),{
          attacker:{raider:n,envoy:1},defender:{},wall:hamlet.hamletLevels.wall[1],loyalty:100,
          baseDefense:hamlet.hamletBaseDefense+hamlet.hamletMilitiaCap});
        if(safeEnvoyAttack(battle)){plan.escort=n;break;}
      }
      if(!plan.escort){plan.status='stopped';plan.reason='No bounded surviving-Envoy escort';savePlan();return;}
    }
    if((v.units.home.envoy??0)<1||(v.units.home.raider??0)<RAIDER_SEND_MIN||
      state.commands.outgoing.some(c=>c.from.id===v.id)){savePlan();return;}
    const travel=conquestTravel(context,this.conquest)!;
    const last=plan.lastBattle;
    // Only a journal-linked own victory may reset militia. Otherwise use the maximum.
    const baseDefense=hamlet.hamletBaseDefense+(last?.outcome==='won'?
      Math.min(hamlet.hamletMilitiaCap,Math.ceil(hamlet.hamletMilitiaPerTick*(state.world.tick+travel-last.tick))):hamlet.hamletMilitiaCap);
    const targetLoyalty=conquestTargetLoyalty(context,this.conquest);
    const battle=await this.request<SimulateBattleResponse>(this.settings,this.path('/simulate/battle'),{
      attacker:{raider:v.units.home.raider,envoy:1},defender:{},wall:hamlet.hamletLevels.wall[1],loyalty:100,baseDefense});
    this.conquest.assessment={tick:state.world.tick,raiders:v.units.home.raider!,battle,targetId:plan.targetId,targetLoyalty};
    savePlan();
  }
  private saveConquestPlan(plan: ConquestContext["plan"]): MissionInstance {
    const mission=conquestMission(plan);
    this.saved.missions=[...(this.saved.missions??[]).filter(value=>value.id!==mission.id),mission];
    return mission;
  }
  private async reconcileConquest(context: AdvisorContext,p: Pending): Promise<void> {
    const state=context.state;
    const mission=this.saved.missions?.find(value=>value.id===p.missionId);
    if(!mission||mission.scope!==conquestScope(this.settings.serverUrl,this.view.account!.id,context)){
      this.clearOperation(p);await this.persist();return;
    }
    const plan=conquestPlan(mission);
    const captured=!!plan.targetId&&state.villages.some(v=>v.id===plan.targetId);
    if(captured){plan.status='captured';plan.capturedTick??=state.world.tick;}
    if(captured&&p.phase!=='accepted'){
      this.record('uncertain','Fresh state confirms conquest target ownership; final request attribution remains unknown. Suppress replay.',p.proposal,p.action.clientId,state.world.tick);
      this.clearOperation(p);this.saveConquestPlan(plan);await this.persist();return;
    }
    if(p.phase==='accepted'){
      const report=this.conquestReports.reports.find(r=>r.commandId===p.itemId&&r.kind==='battle'&&r.role==='attacker'&&
        r.attacker.id===plan.villageId&&r.attacker.ownerId===state.player.id&&r.defender.id===plan.targetId&&r.tick>=p.createdTick&&r.tick<=state.world.tick);
      if(report){
        const detail=await this.request<Report>(this.settings,this.path(`/reports/${encodeURIComponent(report.id)}`));
        if(detail.commandId!==p.itemId||detail.attacker.id!==plan.villageId||detail.defender.id!==plan.targetId||detail.role!=='attacker')
          throw new Error('Conquest report provenance mismatch');
        plan.lastBattle=detail;
        if(!captured&&(detail.outcome!=='won'||(!detail.conquered&&(detail.attackerUnits?.sent.envoy??0)-(detail.attackerUnits?.lost.envoy??0)<1))){
          plan.status='stopped';plan.reason='Battle failed or sole Envoy lost';
        }
        this.record('confirmed',`Conquest battle ${detail.id}: ${detail.outcome}; loyalty ${detail.loyalty?.after??'unknown'}. Ownership is checked in fresh state.`,p.proposal,p.action.clientId,state.world.tick);
        this.clearOperation(p);
      }else if(!state.commands.outgoing.some(c=>c.id===p.itemId)){
        if(!captured){plan.status='stopped';plan.reason='Accepted conquest command disappeared without report';}
        this.record(captured?'confirmed':'cancelled',captured?
          'Fresh state confirms conquest target ownership; no retained matching battle report, so battle attribution remains unknown.':
          'Accepted conquest command disappeared without report; no battle success is inferred.',p.proposal,p.action.clientId,state.world.tick);
        this.clearOperation(p);
      }
    }else if(state.commands.outgoing.some(c=>c.from.id===plan.villageId)||
      (state.villages.find(v=>v.id===plan.villageId)?.units.home.raider??0)!==p.proposal.currentLevel){
      plan.status='stopped';plan.reason='Uncertain conquest send changed troops; inspect activity';this.clearOperation(p);
    }else if(state.world.tick>=p.expiresTick){
      this.automatic=false;this.record('uncertain','Conquest idempotency window expired; inspect activity before resuming.',p.proposal,p.action.clientId,state.world.tick);
    }
    this.saveConquestPlan(plan);
    await this.persist();
  }
  private plan(context: AdvisorContext): void {
    // A completed first component can outlive its accepted queue item across a pause/restart.
    // Do not use that memory to append to an unrelated/manual Barracks queue.
    const missionScope=conquestScope(this.settings.serverUrl,this.view.account!.id,context);
    const missions=(this.saved.missions??[]).filter(value=>value.scope===missionScope);
    const roles=cityRoles(context,missions);
    context = {...context, cityRoles:roles, activeProposals:[...(this.saved.active ?? []), ...(this.saved.pending?[this.saved.pending]:[])].map(p => p.proposal)};
    this.view.world = context.state.world;
    this.view.villages = context.state.villages.map((v) => ({
      id: v.id,
      name: v.name,
      points: v.points,
    }));
    this.view.economicForecasts = context.state.villages.map(forecastEconomy);
    this.view.proposals = [economicAdvisor, militaryAdvisor, economicCityAdvisor, logisticsAdvisor]
      .flatMap(advisor => advisor.evaluate(context));
    // Role filter first: deduplication must never let a role-excluded proposal displace an allowed one.
    this.view.proposals=filterProposalsByRole(this.view.proposals,roles,effectiveRoles);
    prioritizeFarmRunway(context, this.view.proposals);
    this.view.proposals=applyConquest(context,this.view.proposals,this.conquest);
    const eligible=context.state.villages.filter(v=>earlyBuildWindow(context.state,v));
    if(eligible.length){
      const future=constructionContext(context);
      let builds=[economicAdvisor,militaryAdvisor,economicCityAdvisor,logisticsAdvisor].flatMap(a=>a.evaluate(future));
      builds=filterProposalsByRole(builds,roles,effectiveRoles);
      prioritizeFarmRunway(future,builds);
      builds=applyConquest(future,builds,this.conquest).filter(p=>p.action.type==='build'&&eligible.some(v=>v.id===p.villageId));
      for(const p of builds){
        const actual=eligible.find(v=>v.id===p.villageId)!;
        if(p.action.type==='build')p.currentLevel=actual.buildings[p.action.building];
        p.reason+=` Queue the next building with ${earlyBuildWindow(context.state,actual)!.seconds.toFixed(1)} real seconds left; pay from current stocks.`;
      }
      this.view.proposals=this.view.proposals.filter(p=>p.action.type!=='build'||!eligible.some(v=>v.id===p.villageId)).concat(builds);
    }
    const pendingTrade=this.saved.pending;
    if(pendingTrade&&pendingTrade.action.type==='trade'&&pendingTrade.phase!=='accepted'&&
      !this.view.proposals.some(proposal=>proposal.id===pendingTrade.proposal.id))
      this.view.proposals.push(pendingTrade.proposal);
    this.view.proposals=filterProposalsByRole(this.view.proposals,roles,effectiveRoles);
    const scope=productionScope(this.settings.serverUrl,this.view.account!.id,context.state);
    const reached=this.saved.reached?.scope===scope?this.saved.reached.villages:{};
    this.view.proposals=routeReplaced(this.view.proposals,reached);
    const lane = (a: Proposal["action"]) => {
      if (a.type === "build") return `${a.village}:build`;
      if (a.type === "send") return a.kind === "attack" ? "combat" : `support:${a.target}`;
      if (a.type === "recall") return `recall:${a.village}:${a.home}`;
      if (a.type === "trade") {
        const resource = (["timber", "stone", "iron"] as const).find(
          (value) => (a.resources[value] ?? 0) > 0,
        );
        return `${a.village}:trade:${a.target}:${resource ?? "none"}`;
      }
      return `${a.village}:train:${(context.rules.rules.UNITS as Record<string,{building:string}>)[a.unit].building}`;
    };
    for (const proposal of this.view.proposals) {
      const occupied = (this.saved.active ?? []).filter(p => lane(p.action) === lane(proposal.action));
      const v=context.state.villages.find(v=>v.id===proposal.villageId);
      const early=proposal.action.type==='build'&&v&&earlyBuildWindow(context.state,v)&&occupied.length===1&&
        occupied[0].phase==='accepted'&&occupied[0].itemId===v.buildQueue[0].id;
      if (occupied.length && !early && proposal.status === "ready") {
        proposal.status = "waiting"; proposal.blockers.push("EXECUTOR_QUEUE_BUSY");
      }
    }
    const allocation=allocateWithPresident(this.view.proposals,{
      pending:this.saved.pending?.proposal??null,
    });
    this.view.selection = allocation.selection;
    const journal=[...(this.saved.active??[]),...(this.saved.pending?[this.saved.pending]:[])];
    this.view.planning=evaluatePlanning({
      context,
      memory:{missions,scope,reached},
      candidates:this.view.proposals,
      journal,
      evaluatedAt:new Date(this.now()).toISOString(),
      selectedId:this.view.selection.selected?.id??null,
      allocationReasonCode:allocation.reasonCodes[0]??"NO_ACTION_NEEDED",
      excludedCandidates:allocation.excluded,
      reservations:allocation.reservations,
    });
    this.saved.reached={scope,villages:reachedNodes(this.view.planning)};
    if (!this.view.selection.selected && this.saved.active?.length) {
      this.view.selection.reason += ` Tracking ${this.saved.active.length} accepted operation(s) across independent construction/training/command queues.`;
    }
    this.view.conflicts = context.state.villages
      .filter((v) => v.orders.build.length > 0)
      .map(
        (v) =>
          `${v.name} has server standing build orders. The advisor will not add competing construction there.`,
      );
    const selected = this.view.selection.selected;
    const signature = JSON.stringify({
      id: selected?.id,
      importance: selected?.importance,
      reservations: this.view.selection.reservations,
      queues: context.state.villages.map((v) => v.buildQueue.map((q) => q.id)),
    });
    if (signature !== this.lastPlan) {
      this.record(
        selected ? "recommendation" : "waiting",
        this.view.selection.reason,
        selected ?? undefined,
        undefined,
        context.state.world.tick,
      );
      this.lastPlan = signature;
    }
    this.view.lastEvaluatedAt = new Date(this.now()).toISOString();
  }
  /** Pending requests survive process restarts; retries never create a new clientId. */
  private clearOperation(p: Pending): void {
    if (this.saved.pending === p) this.saved.pending = null;
    this.saved.active = (this.saved.active ?? []).filter(o => o !== p);
  }
  private archiveAccepted(): void {
    if (this.saved.pending?.phase !== "accepted") return;
    this.saved.active = [...(this.saved.active ?? []), this.saved.pending];
    this.saved.pending = null;
  }
  private async reconcile(context: AdvisorContext): Promise<void> {
    for (const p of [...(this.saved.active ?? []), ...(this.saved.pending ? [this.saved.pending] : [])]) await this.reconcileOne(context, p);
    this.archiveAccepted();
  }
  private async reconcileOne(context: AdvisorContext, p: Pending): Promise<void> {
    const s = context.state;
    const v = s.villages.find((v) => v.id === p.proposal.villageId);
    if (
      p.serverUrl !== this.saved.settings.serverUrl ||
      p.worldId !== s.world.id ||
      p.epoch !== s.world.epoch ||
      p.accountId !== this.view.account?.id ||
      !v
    ) {
      this.record(
        "cancelled",
        "Pending operation belongs to an old world, epoch or account; it will not be replayed.",
        p.proposal,
        p.action.clientId,
        s.world.tick,
      );
      this.clearOperation(p);
      await this.persist();
      return;
    }
    if (p.action.type === "send") {
      const action = p.action as Extract<Action, {type:"send"}>;
      if(p.missionId)await this.reconcileConquest(context,p);
      else if(p.action.kind === "support" && p.phase === "accepted") {
        if (s.commands.outgoing.some(command => command.id === p.itemId)) return;
        const destination=s.villages.find(city=>city.id===action.target);
        const sentUnits=Object.entries(action.units)
          .filter((entry):entry is [string,number]=>typeof entry[1]==="number"&&entry[1]>0);
        const confirmed=sentUnits.length>0&&sentUnits.every(([unit,count])=>{
          const stationed=destination?.supportHere.filter(stack=>stack.home.id===action.village)
            .reduce((sum,stack)=>sum+(stack.units[unit as keyof typeof stack.units]??0),0)??0;
          return stationed>=count;
        });
        this.record(confirmed?"confirmed":"cancelled",confirmed?
          "Support arrived and is present in fresh state.":
          "Accepted support command disappeared without reaching its target; no arrival is inferred.",
          p.proposal,p.action.clientId,s.world.tick);
        this.clearOperation(p);await this.persist();
      } else if(p.phase!=="accepted"){
        this.automatic=false;
        this.record("uncertain","An unclassified legacy send is retained for operator inspection and will not be replayed.",p.proposal,p.action.clientId,s.world.tick);
        await this.persist();
      }else if(!s.commands.outgoing.some(command=>command.id===p.itemId)){
        this.record("cancelled","An unclassified accepted send left the outgoing command list; no outcome is inferred.",p.proposal,p.action.clientId,s.world.tick);
        this.clearOperation(p);
        await this.persist();
      }
      return;
    }
    if(p.action.type==="recall"){
      const action = p.action as Extract<Action, {type:"recall"}>;
      if(p.phase!=="accepted"){
        this.automatic=false;
        this.record("uncertain","Recall outcome is unknown; automatic execution is paused rather than replaying it.",p.proposal,p.action.clientId,s.world.tick);
        await this.persist();return;
      }
      if(s.commands.outgoing.some(command=>command.id===p.itemId))return;
      const city=s.villages.find(value=>value.id===action.village);
      const remaining=city?.supportHere.filter(stack=>stack.home.id===action.home)
        .reduce((sum,stack)=>sum+(stack.units.raider??0),0)??0;
      const confirmed=remaining<p.proposal.currentLevel;
      this.record(confirmed?"confirmed":"cancelled",confirmed?
        "Recalled Raiders left the captured city, confirmed by fresh state.":
        "Accepted recall disappeared without changing the stationed Raider stack.",
        p.proposal,p.action.clientId,s.world.tick);
      this.clearOperation(p);await this.persist();return;
    }
    if (p.action.type === "train") {
      await this.reconcileTraining(context, p);
      return;
    }
    if (p.action.type === "trade") {
      await this.reconcileTrade(context, p);
      return;
    }
    const building = p.action.building;
    const item = p.itemId
      ? v.buildQueue.find((q) => q.id === p.itemId)
      : undefined;
    if (p.phase === "accepted") {
      if (item) return;
      this.record(
        v.buildings[building] >= p.proposal.targetLevel
          ? "confirmed"
          : "cancelled",
        v.buildings[building] >= p.proposal.targetLevel
          ? `${p.proposal.buildingName} reached level ${p.proposal.targetLevel}, confirmed by fresh server state.`
          : "Accepted construction disappeared without reaching its target; it may have been cancelled by another actor.",
        p.proposal,
        p.action.clientId,
        s.world.tick,
      );
      this.clearOperation(p);
      await this.persist();
      return;
    }
    if (
      v.buildings[building] !== p.proposal.currentLevel ||
      v.buildQueue.some((q) => q.building === building && q.level >= p.proposal.targetLevel)
    ) {
      this.record(
        "uncertain",
        "Desired building state changed after an uncertain request. It may have applied or another actor may have acted; do not submit a second upgrade.",
        p.proposal,
        p.action.clientId,
        s.world.tick,
      );
      this.clearOperation(p);
      await this.persist();
      return;
    }
    if (s.world.tick >= p.expiresTick) {
      this.automatic = false;
      this.record(
        "uncertain",
        "Idempotency window expired with no confirmed outcome. Automatic execution is paused; inspect the activity log before clearing this operation.",
        p.proposal,
        p.action.clientId,
        s.world.tick,
      );
      this.backoffUntil = this.now() + 60000;
      await this.persist();
    }
  }
  private async reconcileTrade(context: AdvisorContext, p: Pending): Promise<void> {
    if (p.action.type !== "trade") return;
    const action=p.action as Extract<Pending["action"],{type:"trade"}>;
    const state=context.state;
    const trade=p.itemId?state.trades.outgoing.find(value=>value.id===p.itemId):undefined;
    if(p.phase==="accepted"){
      if(!trade||trade.returning){
        const destination=state.villages.find(value=>value.id===action.target)?.name??action.target;
        this.record("confirmed",`Trade to ${destination} delivered.`,p.proposal,p.action.clientId,state.world.tick);
        this.clearOperation(p);
        await this.persist();
      }
      return;
    }
    if(state.world.tick>=p.expiresTick){
      this.automatic=false;
      this.record("uncertain","Trade idempotency window expired; automatic execution is paused. Inspect activity before clearing this operation.",p.proposal,p.action.clientId,state.world.tick);
      await this.persist();
    }
  }
  /** Counts include away troops; marching a batch must never trigger replacement spending. */
  private async reconcileTraining(
    context: AdvisorContext,
    p: Pending,
  ): Promise<void> {
    if (p.action.type !== "train") return;
    const { unit, count } = p.action;
    const v = context.state.villages.find(
      (v) => v.id === p.proposal.villageId,
    )!;
    const queues = Object.values(v.training).flat();
    const owned = (v.units.home[unit] ?? 0) + (v.units.away[unit] ?? 0);
    if (p.phase === "accepted") {
      if (queues.some((q) => q.id === p.itemId)) return;
      const complete = owned >= p.proposal.currentLevel + count;
      this.record(
        complete ? "confirmed" : "cancelled",
        complete
          ? `${count} ${p.proposal.buildingName} completed training, confirmed by fresh server state.`
          : "Accepted training disappeared without its expected troops; cancellation or losses may have occurred.",
        p.proposal,
        p.action.clientId,
        context.state.world.tick,
      );
      this.clearOperation(p);
    } else if (
      owned !== p.proposal.currentLevel ||
      queues.some((q) => q.unit === unit)
    ) {
      // Observed changes cannot prove attribution, but must suppress a duplicate order.
      this.record(
        "uncertain",
        "Troops or training changed after an uncertain request; another actor may have acted. Do not replay this batch.",
        p.proposal,
        p.action.clientId,
        context.state.world.tick,
      );
      this.clearOperation(p);
    } else if (context.state.world.tick >= p.expiresTick) {
      this.automatic = false;
      this.backoffUntil = this.now() + 60000;
      this.record(
        "uncertain",
        "Training idempotency window expired. Automatic execution is paused; inspect activity before clearing this operation.",
        p.proposal,
        p.action.clientId,
        context.state.world.tick,
      );
    }
    await this.persist();
  }
  cycle(): Promise<void> {
    return this.runner.cycle();
  }
  private async runCycle(): Promise<void> {
    if (this.saved.recoveryRequired || this.saved.persistenceFault) {
      this.automatic=false;
      this.view.connection="error";
      this.view.error=this.saved.recoveryRequired??this.saved.persistenceFault??"Control state persistence failed.";
      return;
    }
    if (this.busy || this.stopped || this.now() < this.backoffUntil) return;
    if (!this.saved.settings.apiKey) {
      this.view.connection = "unconfigured";
      return;
    }
    this.busy = true;
    const revision = this.revision;
    try {
      this.view.connection = this.view.account
        ? this.view.connection
        : "connecting";
      const { me, worlds } = await this.readMetadata();
      this.view.account = me.account;
      this.view.worlds = worlds;
      const context = await this.readJoinedContext(worlds, revision);
      this.view.connection = "connected";
      this.view.error = null;
      const scope = productionScope(
        this.settings.serverUrl,
        me.account.id,
        context.state,
      );
      let history: HistoryResponse = { samples: [] };
      if (this.saved.production?.scope !== scope) {
        try {
          history = await this.request<HistoryResponse>(
            this.settings,
            this.path("/history"),
          );
        } catch {}
      }
      this.saved.production = trackProduction(
        this.saved.production,
        scope,
        context.state,
        history.samples,
      );
      this.view.production = productionView(this.saved.production);
      await this.readConquest(context);
      await this.reconcile(context);
      this.plan(context);
      await this.persist();
      if (!this.automatic || revision !== this.revision || this.stopped) return;

      // Read state and live rules again immediately before sending: manual commands may have won the race.
      if (!this.view.selection.selected) return;
      const fresh = await this.readContext(true);
      this.saved.production = trackProduction(
        this.saved.production,
        productionScope(this.settings.serverUrl, me.account.id, fresh.state),
        fresh.state,
      );
      this.view.production = productionView(this.saved.production);
      await this.readConquest(fresh);
      await this.reconcile(fresh);
      this.plan(fresh);
      if (!this.automatic || revision !== this.revision || this.stopped) return;
      const selected = this.view.selection.selected;
      if (!selected) return;
      let pending = this.saved.pending;
      if (
        pending &&
        (pending.proposal.id !== selected.id ||
          fresh.state.world.tick >= pending.expiresTick)
      )
        return;
      if (!pending) {
        const ttl = Number(
          (fresh.rules.rules.LIMITS as { clientIdTtl?: number })?.clientIdTtl,
        );
        if (!Number.isFinite(ttl) || ttl <= 1)
          throw new Error(
            "Live idempotency TTL is unavailable; refusing to execute.",
          );
        pending = prepareJournalEntry(selected,{
          accountId: me.account.id,
          worldId: fresh.state.world.id,
          epoch: fresh.state.world.epoch,
          serverUrl: this.saved.settings.serverUrl,
          createdTick: fresh.state.world.tick,
          expiresTick: fresh.state.world.tick + ttl - 1,
        },`econ-${randomUUID()}`);
        if(selected.advisor==='conquest'&&selected.action.type==='send')
          pending.missionId=this.conquest?.plan?conquestMission(this.conquest.plan).id:undefined;
        this.saved.pending = pending;
        this.record(
          "prepared",
          `${proposalDescription(selected)} prepared; journalling its request ID before any network write.`,
          selected,
          pending.action.clientId,
          fresh.state.world.tick,
        );
        await this.persist(); // Never POST unless its request ID is durably journalled.
      }
      if (!this.automatic || revision !== this.revision || this.stopped) return;
      try {
        pending.phase = "submitted";
        this.record(
          "submitted",
          `${proposalDescription(pending.proposal)} handed to the API; awaiting its result.`,
          pending.proposal,
          pending.action.clientId,
          fresh.state.world.tick,
        );
        const response = await this.request<ActionsResponse>(
          this.settings,
          this.path("/actions"),
          {
            actions: [pending.action],
            returnState: true,
            note: `${pending.proposal.advisor} Advisor: ${pending.proposal.buildingName}; importance ${pending.proposal.importance}`,
          },
        );
        const result = response.results[0];
        if (!result)
          throw new RemoteError(
            0,
            5000,
            "Action response contained no result; outcome unknown.",
          );
        if (!result.ok) {
          this.record(
            "rejected",
            `${result.error.code}: ${result.error.message}`,
            selected,
            pending.action.clientId,
            response.tick,
          );
          this.saved.pending = null;
          this.backoffUntil =
            this.now() +
            Math.max(10000, Number(result.error.details?.retryAfterMs) || 0);
        } else if (pending.action.type === "send" && "command" in result.data) {
          const command = result.data.command;
          if(pending.action.kind==="support") {
            if(command.kind!=="support"||command.from.id!==pending.action.village||command.to.id!==pending.action.target)
              throw new RemoteError(0,5000,"Unexpected support command; inspect activity.");
          } else if(!pending.missionId||command.kind!=='attack'||command.from.id!==pending.action.village||command.to.id!==pending.action.target||
              JSON.stringify(command.units)!==JSON.stringify(pending.action.units))
            throw new RemoteError(0,5000,'Unexpected conquest command; inspect activity.');
          pending.phase = "accepted";
          pending.itemId = command.id;
          if(pending.missionId){
            const mission=this.saved.missions?.find(value=>value.id===pending!.missionId);
            if(!mission)throw new RemoteError(0,5000,'Conquest mission disappeared before command acceptance was recorded.');
            mission.memory.waves++;
            this.record('accepted',`Conquest wave ${mission.memory.waves} dispatched; arrival tick ${command.arrivalTick}.`,selected,pending.action.clientId,response.tick);
          }else this.record("accepted",`Support command accepted; arrival tick ${command.arrivalTick}.`,selected,pending.action.clientId,response.tick);
        } else if(pending.action.type==="recall"&&"command" in result.data) {
          const command=result.data.command;
          if(command.kind!=="support"||!command.returning)throw new RemoteError(0,5000,"Unexpected recall result; inspect activity.");
          pending.phase="accepted";pending.itemId=command.id;
          this.record("accepted",`Recall accepted; return arrival tick ${command.arrivalTick}.`,selected,pending.action.clientId,response.tick);
        } else if (pending.action.type === "trade" && "trade" in result.data) {
          const tradeAction=pending.action as Extract<Pending["action"],{type:"trade"}>;
          const trade=result.data.trade;
          if(trade.from.id!==tradeAction.village||trade.to.id!==tradeAction.target||
            !tradeResourcesMatch(tradeAction.resources,trade.resources)||
            trade.returning)
            throw new RemoteError(0,5000,"Unexpected trade result; inspect activity.");
          pending.phase="accepted";
          pending.itemId=trade.id;
          const destination=fresh.state.villages.find(value=>value.id===tradeAction.target)?.name??tradeAction.target;
          this.record("accepted",`Trade to ${destination} accepted: ${trade.resources.timber}/${trade.resources.stone}/${trade.resources.iron}; arrival tick ${trade.arrivalTick}.`,selected,pending.action.clientId,response.tick);
        } else if (
          (pending.action.type === "build" && "item" in result.data) ||
          (pending.action.type === "train" && "batch" in result.data)
        ) {
          pending.phase = "accepted";
          pending.itemId =
            "item" in result.data
              ? result.data.item.id
              : "batch" in result.data
                ? result.data.batch.id
                : undefined;
          this.record(
            "accepted",
            `${selected.buildingName} target ${selected.targetLevel} accepted into ${pending.action.type === "train" ? "training" : "construction"} queue; completion is not confirmed yet.`,
            selected,
            pending.action.clientId,
            response.tick,
          );
        } else
          throw new RemoteError(
            0,
            5000,
            "Unexpected action result; inspect the game activity log.",
          );
        await this.persist();
      } catch (e) {
        const error =
          e instanceof RemoteError
            ? e
            : new RemoteError(
                0,
                5000,
                "Unexpected transport error; outcome is unknown.",
              );
        if (error.status && error.status < 500 && error.status !== 429) {
          this.saved.pending = null;
          this.record(
            "rejected",
            error.message,
            selected,
            pending.action.clientId,
          );
          if (error.status === 401 || error.status === 403)
            this.automatic = false;
        } else {
          pending.phase = "uncertain";
          this.record(
            "uncertain",
            error.message + " Revalidate before retrying the same request ID.",
            selected,
            pending.action.clientId,
          );
        }
        this.backoffUntil = this.now() + error.retryMs;
        await this.persist();
      }
    } catch (e) {
      this.view.connection = "error";
      this.view.error = this.saved.persistenceFault ?? this.saved.recoveryRequired ??
        (e instanceof Error ? e.message : "Evaluation failed.");
      const delay = e instanceof RemoteError ? e.retryMs : 10000;
      this.backoffUntil = this.now() + delay;
      if (e instanceof RemoteError && (e.status === 401 || e.status === 403)) {
        this.automatic = false;
        await this.persist().catch(() => undefined);
      }
    } finally {
      this.busy = false;
    }
  }
}
