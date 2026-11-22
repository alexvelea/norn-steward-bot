import { RAIDER_TARGET } from "../../advisors/defense-budget.js";

/** Written rules per plan node: what an action under this node may do and why.
 * Agents audit journalled actions against this text; code should follow it. */
export interface NodeSpec {
  intent: string;
  eligible?: readonly string[];
  priority?: readonly string[];
  never?: readonly string[];
}

export const SPECS: Readonly<Record<string, NodeSpec>> = {
  "economy.lumberyard": {
    intent: "Grow timber production in the capital.",
    eligible: ["Below the producer policy ceiling.", "Production payback holds before round end."],
    priority: [
      "Below the next milestone (5, 8, 10): 85 before level 5, else 75, minus 1 per producer with lower coverage ranked ahead.",
      "At or above the milestone: 60 minus 10 per rank.",
      "82 minus rank when Pikeman training needs more of this resource than 80% of production.",
    ],
  },
  "economy.balance": {
    intent: "Keep the three resources balanced so one shortage does not stall every build.",
    eligible: [
      "For each resource: stock minutes = stock / the average production per minute of the three resources.",
      "A resource lags when its stock minutes are 5 or more below both of the other two.",
    ],
    priority: ["The lagging resource's producer scores 90, plus 1 per further 5 minutes of lag, up to 99 (the higher of this and its normal score)."],
  },
  "economy.farm": {
    intent: "Keep free population for queued work and Pikeman training; before a long build, offer the Farm first if the batches trained meanwhile wouldn't fit.",
    eligible: [
      "Free population below max(50, 20% of the limit), or a Pikeman batch would not fit after the Farm completes.",
      "Before a long build: if the Pikeman batches trained while that build and then the Farm complete would leave fewer free slots than the buffer (max(50, 20% of the limit)), offer the Farm first.",
    ],
    priority: ["100 when no population is free.", "95 when below the buffer.", "95 when the runway rule applies (the Farm goes before the long build).", "20 otherwise (not executed)."],
  },
  "economy.storehouse": {
    intent: "Avoid overflow and proactively fit the capital's next Envoy before recurring admission.",
    eligible: ["Projected stock exceeds storage, or the capital owns captured cities, has no owned/queued Envoy and the live next Envoy cost exceeds capacity.", "Admission still waits for completed storage and applies the fresh-target round-end guard."],
    priority: ["96 for capital Envoy capacity; otherwise 90 plus up to 9 for forecast overflow.", "25 otherwise (not executed)."],
  },
  "economy.hall": {
    intent: "Buy construction speed only when it pays back.",
    eligible: [
      "Producers at level 8 or more; Hall below 5 is a fixed milestone.",
      "Beyond that, the simulated build plan finishes sooner with the Hall first.",
    ],
    priority: ["86 for the Hall 5 milestone.", "70 to 79 by the share of build time saved.", "At most 69 while Pikeman or Raider training is active.", "30 when it does not pay back."],
    never: ["Never deferred because an attack is incoming."],
  },
  "first-conquest": {
    intent: "Conquer as soon as possible: meet the conquest requirements in the capital alongside the rest of the early game.",
    eligible: ["The capital is the only city, meets the early producer gate, has Barracks 5 and no queued orders.", "It does not wait for the rest of the early game (Wall 5, Hall 10, producers 15, 200 Pikemen).", "Producer upgrades pause during the Hall 10 rush; Raiders wait for Barracks 5."],
    priority: ["Mission tasks compete with every other task through the President (88 to 96); the capital saves for them when they are its top need."],
    never: ["Never pause or exclude the capital's other tasks; conquest is an operation on top of normal production."],
  },
  "conquest.enabled": {
    intent: "Smithy 10, Market 5 and Court built; the Court needs the early-game Hall 10.",
  },
  "conquest.capacity": {
    intent: "Make room for a specific conquest build or Raider/Envoy batch, independently of routine capacity upkeep.",
    eligible: [
      "Farm: free population is below the action's population cost plus the greater of 50 slots or 20% of the population limit rounded up.",
      "Storehouse: any one resource cost exceeds the storage limit. The population check comes first, but a Farm that cannot fit in storage can require a Storehouse first.",
    ],
    priority: ["96 for either paid prerequisite."],
  },
  "conquest.dispatch": {
    intent: "Capture the nearest unowned village with the Envoy and escort.",
    eligible: ["Escort and Envoy at home.", "Fresh ownership and battle simulation show the Envoy survives."],
    priority: ["94."],
    never: ["Never more than six waves.", "Never reuse the Envoy before the previous battle is confirmed."],
  },
  roles: {
    intent: "Give every city a role without any operator input.",
    eligible: [
      "Capital: the origin of the first conquest; if it is lost, the oldest remaining city.",
      "Economic: every other city, from the tick it is captured.",
    ],
    never: ["Never change a role manually or from the dashboard."],
  },
  logistics: {
    intent: "Fulfil what economic cities request; they decide what they need and how urgent it is.",
    eligible: ["Capital has Market 5 (13 merchants of 1,000 each)."],
  },
  "logistics.fulfil": {
    intent: "Turn open requests into trades. During conquest preparation, fund the capital’s Envoy deficit from economic cities, richest surplus first, lowering their reserve to 1000 per resource; use normal Markets and available merchants. Only already in-flight trades count toward admission.",
    eligible: ["An open request for that resource.", "No trade from the capital to that city already carrying that resource."],
    priority: [
      "Uses the request's own score.",
      "Competes with the capital's builds through the President: if the capital's top need scores higher and is short on resources, the capital saves and the request waits.",
    ],
    never: ["Never ship from the capital's saving reservation.", "Never send more than the receiver can store."],
  },
  "economic-city": {
    intent: "Turn a captured city into an economy as fast as possible by pulling resources from the capital.",
    eligible: ["City role is economic."],
    never: ["Never run the capital's economy, defence or conquest branches in this city."],
  },
  "econ.build-order": {
    intent: "Fixed build order; resources come from requests, so the Hall can be built nearly continuously.",
    eligible: ["Each step starts only after the previous step is done.", "Farm and Storehouse may interrupt only when they block the next step."],
    never: ["Never skip ahead to a later step."],
  },
  "econ.cellar3": { intent: "Cheap first protection: Cellar 3 hides 796 of each resource.", priority: ["Step 1."] },
  "econ.hall5": { intent: "First construction speed-up.", priority: ["Step 2."] },
  "econ.cellar-cover": {
    intent: "Raise the Cellar until it hides the stock the requests keep: Cellar 7 hides 2,491, above the 2,000 top-up.",
    eligible: ["A larger top-up level (Request L2) raises the target."],
    priority: ["Step 3."],
  },
  "econ.hall13": {
    intent: "Build the Hall continuously with pulled resources up to 13: about 47% faster construction.",
    priority: ["Step 4.", "Stop at 13: Hall 15 adds only about 9% more for roughly 4,000 extra of each resource."],
  },
  "econ.cellar10": { intent: "Cellar 10 hides 5,860 of each resource.", priority: ["Step 5, after Hall 13."] },
  "econ.storehouse3": { intent: "Storehouse 3 holds 5,358 of each resource.", priority: ["Step 6, after Cellar 10."] },
  "econ.storage-growth": {
    intent: "Grow storage with the city's needs once the build order is done.",
    eligible: [
      "Stock plus shipments in flight plus 300 ticks of income would exceed storage, or the next build does not fit.",
      "Cellar: raise it whenever protection falls below the stock the city keeps.",
    ],
    never: ["Never grow storage ahead of need."],
  },
  "econ.market-growth": {
    intent: "Merchant capacity follows shipping demand.",
    eligible: ["Market 1 once producers reach level 5.", "Further levels when the surplus for the capital needs more whole merchants than the Market has in total (score 95: above producer and Storehouse builds, so shipping is never capped by merchants).", "Game requirements: Great Hall 3 and Storehouse 2; level L has round(0.4·L² + 0.6·L) merchants carrying 1,000 each."],
  },
  "logistics.market-growth": {
    intent: "Raise the capital's Market when merchants are the bottleneck for fulfilling requests.",
    eligible: ["The open requests together need more merchants than the Market has in total."],
    priority: ["Scored like the highest open request it unblocks."],
  },
  "econ.balance": {
    intent: "Same balance rule as the capital, once setup is done.",
    priority: ["The boost (90 to 99) is not capped by the economic-city producer score of 65."],
  },
  "econ.setup-done": {
    intent: "Marks the end of the build order; producers, storage growth and Market growth start here.",
    eligible: ["Every build-order step has reached its level."],
  },
  "econ.producers": {
    intent: "Producers up to 10; above that is Producers 11–25, after Wall 10.",
    eligible: ["Grow all three producers to level 10 in Producers.", "After Wall 10, grow them up to level 25 in Producers 11–25."],
    priority: ["Score: to be decided when codified."],
  },
  "econ.farm": { intent: "Only unblock population.", eligible: ["Free population is too low for the next step."] },
  "econ.storehouse": {
    intent: "Only unblock storage during the build order; afterwards follow the storage policy.",
    eligible: ["The next step's cost or the request's top-up level does not fit in storage."],
  },
  "econ.no-military": {
    intent: "Never builds Barracks, Smithy or Stable and never trains troops; the Wall up to 10 is the exception. Defenders and Scouts are stationed by the capital.",
    never: ["Never build Barracks, Smithy or Stable.", "Never train troops.", "Walls up to level 10 are the only military-building exception."],
  },
  "econ.market": {
    intent: "Merchants for sending surplus to the capital.",
    eligible: ["All three producers at level 5."],
  },
  "econ.surplus": {
    intent: "A developed city funds the capital instead of piling up stock.",
    eligible: ["All three producers at level 15 or higher and a Market.", "Per resource, surplus = stock − max(4,000, cost of the city's highest-scored next build), capped by the capital's free storage after shipments in flight.", "Ship when the surplus fills min(5, all) merchants; one trade carries all three resources, largest surplus first."],
    priority: ["Score 50: below the city's own builds, so it never spends what the next build needs."],
    never: ["Normally retain 4000 and the next build's bill. During conquest preparation only, lower the reserve to 1000 to fund the Envoy deficit, richest surplus first at priority 95. Available merchants and capital storage still bound every shipment."],
  },
  "econ.requests": {
    intent: "The economic city publishes what it needs; the capital fulfils it. The game only allows pushing, so requests live only inside the bot.",
    never: ["A request never submits an action by itself."],
  },
  "econ.request-resources": {
    intent: "Ask the capital for each resource separately, with a buffer that grows with the city's stage.",
    eligible: [
      "Setup (build order not done): a resource below 1,000 is topped up to 2,000.",
      "Growth (setup done, producers below 10): a resource below 2,000 is topped up to 4,000.",
      "Developed (producers 10 or more): same buffer as growth.",
      "Top-ups never exceed storage; nothing is requested for a resource already in flight from the capital.",
    ],
    priority: ["Setup 95 (as soon as possible).", "Growth 85.", "Developed 40: only when the capital has nothing more important.", "With several economic cities, the youngest wins."],
  },

  expansion: {
    intent: "After the first capture, conquer the next cities one at a time once existing cities are developed.",
    eligible: ["Conquest enabled.", "No other conquest in progress."],
    never: ["Never hold the capital's production while waves are prepared or in flight."],
  },
  "expansion.next": {
    intent: "Repeat the capture for the next city.",
    eligible: ["First city captured."],
  },
  "expansion.readiness": {
    intent: "Start the next conquest only when Envoy funding, training and capture plus a 60-tick margin fit before round end, after the previous one ends, capital readiness is met, and all economic cities reach Great Hall 10; train its Envoy only after Every city defended.",
    eligible: [
      "The previous conquest has ended (captured or stopped).",
      "Every economic city has Great Hall 10.",
      "Capital has a Court and 150 Pikemen at home; no standing orders.",
    ],
    never: ["Never train an Envoy for the next city before Every city defended."],
  },
  "expansion.cities-defended": {
    intent: "Wait for every economic city to be defended before training the next Envoy.",
    eligible: [
      "Every economic city has Wall 10.",
      "Every economic city has at least 80% of its Pikemen target stationed.",
      "With no economic cities, the city-defense condition is vacuously met.",
    ],
  },
  "expansion.escort": {
    intent: `Before every wave, train up to max(${RAIDER_TARGET}, simulated escort) Raiders; earlier survivors count.`,
    eligible: [`Train the missing Raiders when the count at home, away and queued is below max(${RAIDER_TARGET}, simulated escort).`],
    never: ["Never send Pikemen that are part of the home-defence target.", "Never dispatch with fewer than 100 home Raiders."],
  },
  "expansion.dispatch": {
    intent: "Dispatch with at least 100 Raiders; estimate remaining capture time from current target loyalty, not a reset to 100 after each hit.",
    eligible: ["At least 100 Raiders and one Envoy at home; every home Raider is sent.", "Use the latest target battle report or target assessment; otherwise count landed waves and conservatively regenerate since mission start. Fresh admission remains at 100 loyalty."],
    priority: ["94."],
    never: ["Never more than six waves per target.", "Never target an owned village."],
  },
  "expansion.captured": {
    intent: "Fresh ownership of the target completes the instance; the city is tagged economic.",
  },
  "economy.producers.20": {
    intent: "All three resource producers reach level 20.",
    eligible: ["All three resource producers reach level 20."],
    priority: ["Score: to be decided when codified."],
  },
  "economy.hall-push": {
    intent: "Once producers reach 20, force the Great Hall to 15, then keep it growing alongside military growth.",
    eligible: ["All three resource producers reach level 20."],
    priority: ["Great Hall 15 comes first after producers 20.", "Score: to be decided when codified."],
  },
  "economy.producer-cap": {
    intent: "Capital producers stop at level 25; attack and defence transitions remain at level 20.",
    never: ["Never raise a capital producer above level 25."],
  },
  "early.economy": {
    intent: "Reach the capital's early military producer gate: Lumberyard 14, Quarry 14, Mine 14.",
    eligible: ["Lumberyard is at least level 14.", "Quarry is at least level 14.", "Mine is at least level 14."],
  },
  "early.barracks1": {
    intent: "Build Barracks 1 after the early producer gate.",
    eligible: ["Lumberyard 14, Quarry 14 and Mine 14 are complete."],
    priority: ["Score: to be decided when codified."],
  },
  "early.wall5": {
    intent: "Rush Wall 5 immediately after Barracks 1, ahead of further military development.",
    eligible: ["Barracks 1 is built.", "Wall is below 5."],
    priority: ["Score 88, ignoring the producer-13 floor and Pikeman value comparison until Wall 5."],
  },
  "early.hall10": {
    intent: "Complete Hall 10 after Wall 5 and before further Barracks growth.",
    eligible: ["Wall 5 and Barracks 1 are built.", "Hall is below 10."],
    priority: ["Score 90; save for Hall 10 when only resources are missing.", "Block Barracks growth and military development while active."],
  },
  "early.barracks5": {
    intent: "Grow Barracks to level 5 after Hall 10, then cap it there.",
    eligible: ["Hall 10 and Wall 5 are complete.", "Barracks is below level 5."],
    never: ["Never build Barracks above level 5."],
  },
  "early.pikemen": {
    intent: "Train 200 home Pikemen from Barracks 1 in parallel with the early military buildings.",
    eligible: ["Barracks 1 is built.", "Home Pikemen reach 200; queued troops do not count toward this early goal."],
    priority: ["Continue bounded Pikeman training alongside Wall 5, Hall 10, Barracks growth and producer upgrades."],
  },
  "military.garrison": {
    intent: "Organize the capital's garrison requirements and growth.",
    priority: ["Score: to be decided when codified."],
  },
  "military.pikemen-baseline": {
    intent: "Train for 250 retained + all active city requests, or the higher own target plus requests. With no requests, retain the unchanged own target.",
    eligible: ["Recruit from Barracks 1; the early goal remains 200 home Pikemen.", "The own target is 200 before producer 20, then max(200, 3 × strongest economic-city stationed Pikemen).", "With active requests, train toward max(own target, 250) + the sum of all requests. One request for 250 requires at least 500 home Pikemen before sending.", "Send support only when at least 250 Pikemen will remain at home."],
    priority: ["Score: to be decided when codified."],
    never: ["Never use Shieldmen for this baseline."],
  },
  "military.defence-scale": {
    intent: "At producer 20, use own target max(200, 3 × strongest economic-city stationed Pikemen); active requests require max(own target, 250) + all requests. Without requests, keep the own target.",
    eligible: ["The capital's producers reach level 20.", "Compare home Pikemen with the strongest other city's defence."],
    priority: ["Retain at least 250 plus all active requests in the training target, even when the own target is lower; preserve a higher own target. Economic-city targets use max(250, floor(capital home Pikemen ÷ 3)).", "Score: to be decided when codified."],
  },
  "military.barracks-growth": {
    intent: "Raise Barracks when it cannot train enough Pikemen or conquest Raiders in time, up to level 5.",
    eligible: [`The Pikemen target or the conquest training target of ${RAIDER_TARGET} Raiders cannot be reached fast enough.`, "Barracks is below level 5."],
    priority: ["Score 92 (above Storehouse overflow and producer builds, below Farm capacity) while every resource covers twice the upgrade plus two Pikemen batches; otherwise 65, so it never takes what Pikemen need."],
    never: ["Never build Barracks above level 5."],
  },
  "military.raiders": {
    intent: `Keep ${RAIDER_TARGET} Raiders for conquest and replace losses.`,
    eligible: [`Train when Raiders at home, away and queued total fewer than ${RAIDER_TARGET}.`, "A conquest wave needs at least 100 Raiders at home and takes every Raider at home."],
    priority: ["72 for baseline Raider training."],
    never: ["Never wait for Raiders that are not being trained."],
  },
  "military.stable1": {
    intent: "After owning a second village, build Stable 1 for Scouts once Scout-path Smithy is done; the Stable is only for Scouts.",
    eligible: ["Producers 15 and 200 home Pikemen are reached.", "Smithy reaches level 5 first, because Stable 1 requires it."],
    priority: ["Follow the military development step order: Barracks 3, then Smithy and Stable 1 with its missing prerequisites."],
    never: ["Before producers reach 20, never build beyond Stable 1; Attack owns later Stable levels."],
  },
  "military.scouts": {
    intent: "The capital keeps 20 Scouts at home per city it owns, and stations 20 in each economic city on request.",
    eligible: ["At least two villages are owned and Stable 1 is built.", "Keep 20 Scouts at home per city owned.", "Station 20 Scouts in each economic city on request."],
    priority: ["Score: to be decided when codified."],
    never: ["Never use the Stable for non-Scout units."],
  },
  "military.attack": {
    intent: "Late-game resource sink: once the capital's producers reach 20, turn surplus into Lancers and Rams and keep building in the capital.",
    eligible: ["The capital's producers reach level 20."],
  },
  "military.attack-workshop": {
    intent: "After Stable 10, build Workshop 10 before raising the Stable further.",
    eligible: ["Stable 10 is built."],
    priority: ["Workshop 10 ranks above Stable growth beyond 10."],
  },
  "military.attack-stable": {
    intent: "Build the Stable to at least 10; after Workshop 10, keep raising it when it cannot train units fast enough.",
    priority: ["Farm takes priority over Stable growth."],
  },
  "military.lancers": {
    intent: "Train Lancers from the Stable continuously while timber, stone and iron are each above 10,000 in the capital.",
    eligible: ["Every capital resource is above 10,000.", "Batches never drop a resource below 10,000."],
    priority: ["Lancers come before Rams."],
  },
  "military.rams": {
    intent: "Train Rams from the Workshop while timber, stone and iron are each above 20,000 in the capital; Lancers come first.",
    eligible: ["Every capital resource is above 20,000 after the next Lancer batch.", "Batches never drop a resource below 20,000."],
  },
  "military.capital-growth": {
    intent: "Keep upgrading capital buildings alongside the troop sink.",
  },
  "military.wall-cap": {
    intent: "Capital Walls stop at level 10.",
    eligible: ["Build Capital Walls only up to level 10."],
    priority: ["Score: to be decided when codified."],
    never: ["Never build Walls above level 10."],
  },
  "expansion.cities4": {
    intent: "Own four cities before opening the enemy-conquest plan.",
    eligible: ["Own at least 4 cities."],
    priority: ["Score: to be decided when codified."],
  },
  "expansion.enemy": {
    intent: "Scout and simulate attacks on enemy player villages before dispatching conquest.",
    priority: ["Score: to be decided when codified."],
  },
  "expansion.enemy-target": {
    intent: "Target enemy player villages, ranked by size (points) over distance.",
    eligible: ["Target enemy player villages.", "Rank candidates by points over distance."],
    priority: ["Score: to be decided when codified."],
  },
  "expansion.enemy-scout": {
    intent: "Send Scouts before any attack; use the report's intel for the battle simulation.",
    eligible: ["Send Scouts before an attack.", "Use report intel for the battle simulation."],
    priority: ["Score: to be decided when codified."],
  },
  "expansion.decisive": {
    intent: "Attack only with at least 100 Raiders at home, when our attack is at least 2× their defence and an Envoy is simulated to survive. Winner losses are (loser ÷ winner)^1.5, so a 2× edge costs about 35% of the army.",
    eligible: ["At least 100 Raiders are at home.", "Our attack is at least 2× their defence.", "An Envoy is simulated to survive."],
    priority: ["Score: to be decided when codified."],
  },
  "expansion.enemy-dispatch": {
    intent: "Dispatch the enemy conquest after scouting and a decisive battle simulation, with at least 100 Raiders at home.",
    eligible: ["At least 100 Raiders are at home.", "The target has been scouted and its report informs the simulation.", "The attack is at least 2× the enemy defence and an Envoy is simulated to survive."],
    priority: ["Score: to be decided when codified."],
  },
  "expansion.recall": {
    intent: "After a capture, the conquering attack's survivors stay in the captured city as support; send every stationed Raider back home to the capital. Pikemen are left in place.",
    eligible: ["After every capture.", "Return all stationed Raiders to the capital.", "Leave Pikemen in the captured city."],
    priority: ["Score: to be decided when codified."],
  },
  "econ.producers.10": {
    intent: "All three producers reach level 10.",
    eligible: ["All three producers reach level 10."],
    priority: ["Score: to be decided when codified."],
  },
  "econ.producers-late": {
    intent: "Raise producers from level 11 through 25 after Wall 10.",
    eligible: ["Wall 10 is complete."],
    priority: ["Score: to be decided when codified."],
  },
  "econ.lumberyard25": {
    intent: "Grow timber production from 11 to 25 once Wall 10 is built.",
    eligible: ["Wall 10 built; level below 25."],
    priority: ["Same scoring and resource-balance boost as the level-10 task."],
  },
  "econ.quarry25": {
    intent: "Grow stone production from 11 to 25 once Wall 10 is built.",
    eligible: ["Wall 10 built; level below 25."],
    priority: ["Same scoring and resource-balance boost as the level-10 task."],
  },
  "econ.mine25": {
    intent: "Grow iron production from 11 to 25 once Wall 10 is built.",
    eligible: ["Wall 10 built; level below 25."],
    priority: ["Same scoring and resource-balance boost as the level-10 task."],
  },
  "econ.producers.25": {
    intent: "All three producers reach level 25.",
    eligible: ["All three producers reach level 25."],
    priority: ["Score: to be decided when codified."],
  },
  "econ.wall10": {
    intent: "Built after producers reach 10; the only military building an economic city builds.",
    eligible: [
      "All three producers reach level 10.",
      "Barracks 1 is built first, because Wall requires it.",
      "Build the economic-city Wall up to level 10.",
    ],
    priority: ["Score: to be decided when codified."],
  },
  "econ.request-defenders": {
    intent: "Request a top-up below 80% of max(250, floor(capital home Pikemen ÷ 3)). The capital trains for 250 retained + all active city requests, or its higher own target plus requests.",
    eligible: ["Wall 10 is complete.", "Target stationed Pikemen = max(250, floor(capital home Pikemen ÷ 3)).", "For capital 600, target 250 and request a top-up only below 200 stationed Pikemen.", "The capital sends only when home Pikemen cover 250 retained plus this request."],
    priority: ["Score: to be decided when codified."],
    never: ["Never train defenders in the economic city; the capital fulfils the request."],
  },
  "econ.request-scouts": {
    intent: "Keep 20 Scouts stationed; support Scouts defend against enemy scouting.",
    eligible: ["Keep 20 Scouts stationed.", "Support Scouts defend against enemy scouting."],
    priority: ["Score: to be decided when codified."],
    never: ["Never train Scouts in the economic city; the capital fulfils requests."],
  },
};
