# Bot plan

Generated from `src/bot/plan/graph.ts` by `npm run plan:doc`.

## Changing the plan

Propose changes as edits to the nodes and edges in `src/bot/plan/graph.ts`. Update the diagram first by running `npm run plan:doc`, then make advisors and the evaluator match the graph.

Node kinds: objective is the top-level outcome; mission is durable strategic intent; group organizes work; task is continuous actionable work; milestone is a measured goal; policy describes a decision rule; capability marks supported or unavailable behavior.

Within a world, a milestone stays done once reached. A task with a replacement stays live until a task that requires it, or its group, is done; then it stays done and its work goes to the replacement. Other tasks are live and act again when their goal regresses.

Edges: contains organizes the plan tree; requires gates a dependent on a prerequisite and points from prerequisite (`from`) to dependent (`to`); contributesTo links work that contributes to an outcome without defining containment or a gate.

```mermaid
flowchart TD
  classDef objective fill:#dbeafe,stroke:#475569,color:#0f172a;
  classDef mission fill:#e0e7ff,stroke:#475569,color:#0f172a;
  classDef group fill:#f3e8ff,stroke:#475569,color:#0f172a;
  classDef task fill:#dcfce7,stroke:#475569,color:#0f172a;
  classDef milestone fill:#fef3c7,stroke:#475569,color:#0f172a;
  classDef policy fill:#ffedd5,stroke:#475569,color:#0f172a;
  classDef capability fill:#fee2e2,stroke:#475569,color:#0f172a;
  n0["Complete the round<br/><small>round · objective</small>"]
  n1["Develop the economy<br/><small>economy · mission</small>"]
  n2["Resource producers<br/><small>economy.producers · group</small>"]
  n3["Lumberyard<br/><small>economy.lumberyard · task</small>"]
  n4["Quarry<br/><small>economy.quarry · task</small>"]
  n5["Iron mine<br/><small>economy.mine · task</small>"]
  n6["Resource balance<br/><small>economy.balance · policy</small>"]
  n7["Producers at level 5<br/><small>economy.producers.5 · milestone</small>"]
  n8["Producers at level 8<br/><small>economy.producers.8 · milestone</small>"]
  n9["Producers at level 10<br/><small>economy.producers.10 · milestone</small>"]
  n10["Producers at level 12<br/><small>economy.producers.12 · milestone</small>"]
  n11["Producers at level 15<br/><small>economy.producers.15 · milestone</small>"]
  n12["Producers at level 20<br/><small>economy.producers.20 · milestone</small>"]
  n13["Producers capped at 25<br/><small>economy.producer-cap · policy</small>"]
  n14["Capacity and protection<br/><small>economy.capacity · group</small>"]
  n15["Farm capacity<br/><small>economy.farm · task</small>"]
  n16["Storehouse capacity<br/><small>economy.storehouse · task</small>"]
  n17["Great Hall<br/><small>economy.hall · task</small>"]
  n18["Early-build successor window<br/><small>economy.successor-window · policy</small>"]
  n19["Production payback<br/><small>economy.payback · policy</small>"]
  n20["Round-end completion<br/><small>economy.round-end · policy</small>"]
  n21["Great Hall push<br/><small>economy.hall-push · policy</small>"]
  n22["Early game<br/><small>early-game · group</small>"]
  n23["Early producer gate<br/><small>early.economy · milestone</small>"]
  n24["Barracks 1<br/><small>early.barracks1 · task</small>"]
  n25["Wall 5<br/><small>early.wall5 · task</small>"]
  n26["Hall 10<br/><small>early.hall10 · task</small>"]
  n27["Barracks 5<br/><small>early.barracks5 · task</small>"]
  n28["200 home Pikemen<br/><small>early.pikemen · task</small>"]
  n29["Military<br/><small>defense · mission</small>"]
  n30["Garrison<br/><small>military.garrison · group</small>"]
  n31["Train Pikemen<br/><small>military.pikemen-baseline · task</small>"]
  n32["Capital holds 3× any city<br/><small>military.defence-scale · policy</small>"]
  n33["Barracks grows when troops lag<br/><small>military.barracks-growth · task</small>"]
  n34["Scouting<br/><small>military.scouting · group</small>"]
  n35["Stable 1<br/><small>military.stable1 · task</small>"]
  n36["Train Scouts<br/><small>military.scouts · task</small>"]
  n37["Wall capped at 10<br/><small>military.wall-cap · policy</small>"]
  n38["Attack<br/><small>military.attack · group</small>"]
  n39["Workshop 10<br/><small>military.attack-workshop · task</small>"]
  n40["Stable 10 and beyond<br/><small>military.attack-stable · task</small>"]
  n41["Pump Lancers<br/><small>military.lancers · policy</small>"]
  n42["Pump Rams<br/><small>military.rams · policy</small>"]
  n43["Keep building the capital<br/><small>military.capital-growth · policy</small>"]
  n44["Conquest<br/><small>conquest · mission</small>"]
  n45["Raider force<br/><small>military.raiders · task</small>"]
  n46["First conquest<br/><small>first-conquest · group</small>"]
  n47["Conquest enabled<br/><small>conquest.infrastructure · group</small>"]
  n48["Smithy 10<br/><small>conquest.smithy10 · task</small>"]
  n49["Market 5<br/><small>conquest.market5 · task</small>"]
  n50["Court<br/><small>conquest.court · task</small>"]
  n51["Conquest capacity prerequisite<br/><small>conquest.capacity · task</small>"]
  n52["Producer funding fallback<br/><small>conquest.producer-funding · policy</small>"]
  n53["Conquest producer investment<br/><small>conquest.producer-investment · task</small>"]
  n54["Conquest enabled<br/><small>conquest.enabled · milestone</small>"]
  n55["Next cities<br/><small>expansion · mission</small>"]
  n56["Prepare Raider escort<br/><small>conquest.escort · task</small>"]
  n57["Prepare Envoy<br/><small>conquest.envoy · task</small>"]
  n58["Dispatch conquest wave<br/><small>conquest.dispatch · task</small>"]
  n59["Target owned<br/><small>conquest.target-owned · milestone</small>"]
  n60["First city captured<br/><small>conquest.first-achieved · milestone</small>"]
  n61["Recall the escort<br/><small>expansion.recall · task</small>"]
  n62["Parallel mission budgets<br/><small>capability.parallel-budgets · capability</small>"]
  n63["Multiple submissions per cycle<br/><small>capability.multi-submit · capability</small>"]
  n64["City roles<br/><small>roles · policy</small>"]
  n65["Supply economic cities<br/><small>logistics · mission</small>"]
  n66["Fulfil requests<br/><small>logistics.fulfil · task</small>"]
  n67["Economic city<br/><small>economic-city · mission</small>"]
  n68["Build order<br/><small>econ.build-order · group</small>"]
  n69["1. Cellar 3<br/><small>econ.cellar3 · task</small>"]
  n70["2. Great Hall 5<br/><small>econ.hall5 · task</small>"]
  n71["3. Cellar covers requested stock<br/><small>econ.cellar-cover · task</small>"]
  n72["4. Great Hall 13<br/><small>econ.hall13 · task</small>"]
  n73["5. Cellar 10<br/><small>econ.cellar10 · task</small>"]
  n74["6. Storehouse 3<br/><small>econ.storehouse3 · task</small>"]
  n75["Setup done<br/><small>econ.setup-done · milestone</small>"]
  n76["Producers<br/><small>econ.producers · group</small>"]
  n77["Lumberyard<br/><small>econ.lumberyard · task</small>"]
  n78["Quarry<br/><small>econ.quarry · task</small>"]
  n79["Iron mine<br/><small>econ.mine · task</small>"]
  n80["Resource balance<br/><small>econ.balance · policy</small>"]
  n81["Producers at level 5<br/><small>econ.producers.5 · milestone</small>"]
  n82["Producers at level 10<br/><small>econ.producers.10 · milestone</small>"]
  n83["Producers 11–25<br/><small>econ.producers-late · group</small>"]
  n84["Lumberyard<br/><small>econ.lumberyard25 · task</small>"]
  n85["Quarry<br/><small>econ.quarry25 · task</small>"]
  n86["Iron mine<br/><small>econ.mine25 · task</small>"]
  n87["Producers at level 25<br/><small>econ.producers.25 · milestone</small>"]
  n88["Farm when blocked<br/><small>econ.farm · task</small>"]
  n89["Storage grows when needed<br/><small>econ.storage-growth · policy</small>"]
  n90["Storehouse<br/><small>econ.storehouse · task</small>"]
  n91["Cellar follows storage<br/><small>econ.cellar · task</small>"]
  n92["Market grows when needed<br/><small>econ.market-growth · policy</small>"]
  n93["No military<br/><small>econ.no-military · policy</small>"]
  n94["Market<br/><small>econ.market · task</small>"]
  n95["Market grows when needed<br/><small>logistics.market-growth · task</small>"]
  n96["Requests to the capital<br/><small>econ.requests · group</small>"]
  n97["Request resources<br/><small>econ.request-resources · task</small>"]
  n98["Request defenders<br/><small>econ.request-defenders · task</small>"]
  n99["Request scouts<br/><small>econ.request-scouts · task</small>"]
  n100["Producers at level 15<br/><small>econ.producers.15 · milestone</small>"]
  n101["Send surplus to the capital<br/><small>econ.surplus · task</small>"]
  n102["Wall 10<br/><small>econ.wall10 · task</small>"]
  n103["Next conquest<br/><small>expansion.next · group</small>"]
  n104["Expansion readiness<br/><small>expansion.readiness · policy</small>"]
  n105["Every city defended<br/><small>expansion.cities-defended · milestone</small>"]
  n106["Train next Envoy<br/><small>expansion.envoy · task</small>"]
  n107["Escort army at home<br/><small>expansion.escort · task</small>"]
  n108["Dispatch waves<br/><small>expansion.dispatch · task</small>"]
  n109["Target captured<br/><small>expansion.captured · milestone</small>"]
  n110["4 cities owned<br/><small>expansion.cities4 · milestone</small>"]
  n111["Enemy conquest<br/><small>expansion.enemy · group</small>"]
  n112["Close and big<br/><small>expansion.enemy-target · policy</small>"]
  n113["Scout the target<br/><small>expansion.enemy-scout · task</small>"]
  n114["Attack at 2×<br/><small>expansion.decisive · policy</small>"]
  n115["Dispatch conquest<br/><small>expansion.enemy-dispatch · task</small>"]
  n0 -->|contains| n1
  n0 -->|contains| n22
  n0 -->|contains| n44
  n0 -->|contains| n29
  n0 -->|contains| n65
  n0 -->|contains| n67
  n0 -->|contains| n64
  n0 -->|contains| n62
  n0 -->|contains| n63
  n65 -->|contains| n66
  n67 -->|contains| n68
  n68 -->|contains| n69
  n68 -->|contains| n70
  n68 -->|contains| n71
  n68 -->|contains| n72
  n68 -->|contains| n73
  n68 -->|contains| n74
  n68 -->|contains| n75
  n67 -->|contains| n76
  n76 -->|contains| n77
  n76 -->|contains| n78
  n76 -->|contains| n79
  n76 -->|contains| n80
  n76 -->|contains| n81
  n76 -->|contains| n82
  n67 -->|contains| n102
  n67 -->|contains| n83
  n83 -->|contains| n84
  n83 -->|contains| n85
  n83 -->|contains| n86
  n83 -->|contains| n87
  n67 -->|contains| n88
  n67 -->|contains| n89
  n89 -->|contains| n90
  n89 -->|contains| n91
  n67 -->|contains| n92
  n67 -->|contains| n93
  n92 -->|contains| n94
  n65 -->|contains| n95
  n67 -->|contains| n96
  n96 -->|contains| n97
  n96 -->|contains| n98
  n96 -->|contains| n99
  n83 -->|contains| n100
  n67 -->|contains| n101
  n103 -->|contains| n104
  n103 -->|contains| n105
  n104 -->|contains| n106
  n105 -.->|requires| n106
  n103 -->|contains| n107
  n103 -->|contains| n108
  n103 -->|contains| n109
  n55 -->|contains| n61
  n55 -->|contains| n110
  n55 -->|contains| n111
  n111 -->|contains| n112
  n111 -->|contains| n113
  n111 -->|contains| n114
  n111 -->|contains| n115
  n69 -.->|requires| n70
  n70 -.->|requires| n71
  n71 -.->|requires| n72
  n72 -.->|requires| n73
  n73 -.->|requires| n74
  n74 -.->|requires| n75
  n75 -.->|requires| n76
  n75 -.->|requires| n89
  n75 -.->|requires| n92
  n81 -.->|requires| n94
  n82 -.->|requires| n102
  n102 -.->|requires| n83
  n102 -.->|requires| n98
  n94 -.->|requires| n101
  n100 -.->|requires| n101
  n49 -.->|requires| n65
  n97 ==>|contributesTo| n66
  n98 ==>|contributesTo| n66
  n99 ==>|contributesTo| n66
  n66 ==>|contributesTo| n67
  n60 -.->|requires| n103
  n106 -.->|requires| n108
  n107 -.->|requires| n108
  n108 ==>|contributesTo| n109
  n109 ==>|contributesTo| n67
  n1 -->|contains| n2
  n2 -->|contains| n3
  n2 -->|contains| n4
  n2 -->|contains| n5
  n2 -->|contains| n6
  n2 -->|contains| n7
  n2 -->|contains| n8
  n2 -->|contains| n9
  n2 -->|contains| n10
  n2 -->|contains| n11
  n2 -->|contains| n12
  n2 -->|contains| n13
  n1 -->|contains| n14
  n14 -->|contains| n15
  n14 -->|contains| n16
  n1 -->|contains| n17
  n1 -->|contains| n18
  n1 -->|contains| n19
  n1 -->|contains| n20
  n1 -->|contains| n21
  n29 -->|contains| n30
  n30 -->|contains| n31
  n30 -->|contains| n32
  n30 -->|contains| n33
  n29 -->|contains| n34
  n34 -->|contains| n35
  n34 -->|contains| n36
  n29 -->|contains| n37
  n29 -->|contains| n38
  n38 -->|contains| n39
  n38 -->|contains| n40
  n38 -->|contains| n41
  n38 -->|contains| n42
  n38 -->|contains| n43
  n22 -->|contains| n23
  n22 -->|contains| n24
  n22 -->|contains| n25
  n22 -->|contains| n26
  n22 -->|contains| n27
  n22 -->|contains| n28
  n22 -->|contains| n47
  n44 -->|contains| n45
  n44 -->|contains| n46
  n44 -->|contains| n55
  n47 -->|contains| n48
  n47 -->|contains| n49
  n47 -->|contains| n50
  n47 -->|contains| n51
  n47 -->|contains| n52
  n47 -->|contains| n54
  n46 -->|contains| n56
  n46 -->|contains| n57
  n46 -->|contains| n58
  n46 -->|contains| n59
  n46 -->|contains| n60
  n55 -->|contains| n103
  n110 -.->|requires| n111
  n113 -.->|requires| n115
  n52 -->|contains| n53
  n8 -.->|requires| n17
  n12 -.->|requires| n32
  n12 -.->|requires| n21
  n23 -.->|requires| n24
  n24 -.->|requires| n25
  n25 -.->|requires| n26
  n26 -.->|requires| n27
  n27 -.->|requires| n11
  n24 -.->|requires| n28
  n24 -.->|requires| n46
  n11 -.->|requires| n35
  n28 -.->|requires| n35
  n12 -.->|requires| n38
  n40 -.->|requires| n39
  n35 -.->|requires| n36
  n11 -.->|requires| n47
  n56 -.->|requires| n58
  n57 -.->|requires| n58
  n48 -.->|requires| n54
  n49 -.->|requires| n54
  n50 -.->|requires| n54
  n54 -.->|requires| n55
  n54 -.->|requires| n58
  n58 ==>|contributesTo| n59
  n59 -.->|requires| n60
  n59 -.->|requires| n61
  class n0 objective;
  class n1,n29,n44,n55,n65,n67 mission;
  class n2,n14,n22,n30,n34,n38,n46,n47,n68,n76,n83,n96,n103,n111 group;
  class n3,n4,n5,n15,n16,n17,n24,n25,n26,n27,n28,n31,n33,n35,n36,n39,n40,n45,n48,n49,n50,n51,n53,n56,n57,n58,n61,n66,n69,n70,n71,n72,n73,n74,n77,n78,n79,n84,n85,n86,n88,n90,n91,n94,n95,n97,n98,n99,n101,n102,n106,n107,n108,n113,n115 task;
  class n7,n8,n9,n10,n11,n12,n23,n54,n59,n60,n75,n81,n82,n87,n100,n105,n109,n110 milestone;
  class n6,n13,n18,n19,n20,n21,n32,n37,n41,n42,n43,n52,n64,n80,n89,n92,n93,n104,n112,n114 policy;
  class n62,n63 capability;
  linkStyle 0 stroke:#2563eb,stroke-width:2px;
  linkStyle 1 stroke:#2563eb,stroke-width:2px;
  linkStyle 2 stroke:#2563eb,stroke-width:2px;
  linkStyle 3 stroke:#2563eb,stroke-width:2px;
  linkStyle 4 stroke:#2563eb,stroke-width:2px;
  linkStyle 5 stroke:#2563eb,stroke-width:2px;
  linkStyle 6 stroke:#2563eb,stroke-width:2px;
  linkStyle 7 stroke:#2563eb,stroke-width:2px;
  linkStyle 8 stroke:#2563eb,stroke-width:2px;
  linkStyle 9 stroke:#2563eb,stroke-width:2px;
  linkStyle 10 stroke:#2563eb,stroke-width:2px;
  linkStyle 11 stroke:#2563eb,stroke-width:2px;
  linkStyle 12 stroke:#2563eb,stroke-width:2px;
  linkStyle 13 stroke:#2563eb,stroke-width:2px;
  linkStyle 14 stroke:#2563eb,stroke-width:2px;
  linkStyle 15 stroke:#2563eb,stroke-width:2px;
  linkStyle 16 stroke:#2563eb,stroke-width:2px;
  linkStyle 17 stroke:#2563eb,stroke-width:2px;
  linkStyle 18 stroke:#2563eb,stroke-width:2px;
  linkStyle 19 stroke:#2563eb,stroke-width:2px;
  linkStyle 20 stroke:#2563eb,stroke-width:2px;
  linkStyle 21 stroke:#2563eb,stroke-width:2px;
  linkStyle 22 stroke:#2563eb,stroke-width:2px;
  linkStyle 23 stroke:#2563eb,stroke-width:2px;
  linkStyle 24 stroke:#2563eb,stroke-width:2px;
  linkStyle 25 stroke:#2563eb,stroke-width:2px;
  linkStyle 26 stroke:#2563eb,stroke-width:2px;
  linkStyle 27 stroke:#2563eb,stroke-width:2px;
  linkStyle 28 stroke:#2563eb,stroke-width:2px;
  linkStyle 29 stroke:#2563eb,stroke-width:2px;
  linkStyle 30 stroke:#2563eb,stroke-width:2px;
  linkStyle 31 stroke:#2563eb,stroke-width:2px;
  linkStyle 32 stroke:#2563eb,stroke-width:2px;
  linkStyle 33 stroke:#2563eb,stroke-width:2px;
  linkStyle 34 stroke:#2563eb,stroke-width:2px;
  linkStyle 35 stroke:#2563eb,stroke-width:2px;
  linkStyle 36 stroke:#2563eb,stroke-width:2px;
  linkStyle 37 stroke:#2563eb,stroke-width:2px;
  linkStyle 38 stroke:#2563eb,stroke-width:2px;
  linkStyle 39 stroke:#2563eb,stroke-width:2px;
  linkStyle 40 stroke:#2563eb,stroke-width:2px;
  linkStyle 41 stroke:#2563eb,stroke-width:2px;
  linkStyle 42 stroke:#2563eb,stroke-width:2px;
  linkStyle 43 stroke:#2563eb,stroke-width:2px;
  linkStyle 44 stroke:#2563eb,stroke-width:2px;
  linkStyle 45 stroke:#2563eb,stroke-width:2px;
  linkStyle 46 stroke:#2563eb,stroke-width:2px;
  linkStyle 47 stroke:#2563eb,stroke-width:2px;
  linkStyle 48 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 49 stroke:#2563eb,stroke-width:2px;
  linkStyle 50 stroke:#2563eb,stroke-width:2px;
  linkStyle 51 stroke:#2563eb,stroke-width:2px;
  linkStyle 52 stroke:#2563eb,stroke-width:2px;
  linkStyle 53 stroke:#2563eb,stroke-width:2px;
  linkStyle 54 stroke:#2563eb,stroke-width:2px;
  linkStyle 55 stroke:#2563eb,stroke-width:2px;
  linkStyle 56 stroke:#2563eb,stroke-width:2px;
  linkStyle 57 stroke:#2563eb,stroke-width:2px;
  linkStyle 58 stroke:#2563eb,stroke-width:2px;
  linkStyle 59 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 60 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 61 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 62 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 63 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 64 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 65 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 66 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 67 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 68 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 69 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 70 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 71 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 72 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 73 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 74 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 75 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 76 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 77 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 78 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 79 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 80 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 81 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 82 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 83 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 84 stroke:#2563eb,stroke-width:2px;
  linkStyle 85 stroke:#2563eb,stroke-width:2px;
  linkStyle 86 stroke:#2563eb,stroke-width:2px;
  linkStyle 87 stroke:#2563eb,stroke-width:2px;
  linkStyle 88 stroke:#2563eb,stroke-width:2px;
  linkStyle 89 stroke:#2563eb,stroke-width:2px;
  linkStyle 90 stroke:#2563eb,stroke-width:2px;
  linkStyle 91 stroke:#2563eb,stroke-width:2px;
  linkStyle 92 stroke:#2563eb,stroke-width:2px;
  linkStyle 93 stroke:#2563eb,stroke-width:2px;
  linkStyle 94 stroke:#2563eb,stroke-width:2px;
  linkStyle 95 stroke:#2563eb,stroke-width:2px;
  linkStyle 96 stroke:#2563eb,stroke-width:2px;
  linkStyle 97 stroke:#2563eb,stroke-width:2px;
  linkStyle 98 stroke:#2563eb,stroke-width:2px;
  linkStyle 99 stroke:#2563eb,stroke-width:2px;
  linkStyle 100 stroke:#2563eb,stroke-width:2px;
  linkStyle 101 stroke:#2563eb,stroke-width:2px;
  linkStyle 102 stroke:#2563eb,stroke-width:2px;
  linkStyle 103 stroke:#2563eb,stroke-width:2px;
  linkStyle 104 stroke:#2563eb,stroke-width:2px;
  linkStyle 105 stroke:#2563eb,stroke-width:2px;
  linkStyle 106 stroke:#2563eb,stroke-width:2px;
  linkStyle 107 stroke:#2563eb,stroke-width:2px;
  linkStyle 108 stroke:#2563eb,stroke-width:2px;
  linkStyle 109 stroke:#2563eb,stroke-width:2px;
  linkStyle 110 stroke:#2563eb,stroke-width:2px;
  linkStyle 111 stroke:#2563eb,stroke-width:2px;
  linkStyle 112 stroke:#2563eb,stroke-width:2px;
  linkStyle 113 stroke:#2563eb,stroke-width:2px;
  linkStyle 114 stroke:#2563eb,stroke-width:2px;
  linkStyle 115 stroke:#2563eb,stroke-width:2px;
  linkStyle 116 stroke:#2563eb,stroke-width:2px;
  linkStyle 117 stroke:#2563eb,stroke-width:2px;
  linkStyle 118 stroke:#2563eb,stroke-width:2px;
  linkStyle 119 stroke:#2563eb,stroke-width:2px;
  linkStyle 120 stroke:#2563eb,stroke-width:2px;
  linkStyle 121 stroke:#2563eb,stroke-width:2px;
  linkStyle 122 stroke:#2563eb,stroke-width:2px;
  linkStyle 123 stroke:#2563eb,stroke-width:2px;
  linkStyle 124 stroke:#2563eb,stroke-width:2px;
  linkStyle 125 stroke:#2563eb,stroke-width:2px;
  linkStyle 126 stroke:#2563eb,stroke-width:2px;
  linkStyle 127 stroke:#2563eb,stroke-width:2px;
  linkStyle 128 stroke:#2563eb,stroke-width:2px;
  linkStyle 129 stroke:#2563eb,stroke-width:2px;
  linkStyle 130 stroke:#2563eb,stroke-width:2px;
  linkStyle 131 stroke:#2563eb,stroke-width:2px;
  linkStyle 132 stroke:#2563eb,stroke-width:2px;
  linkStyle 133 stroke:#2563eb,stroke-width:2px;
  linkStyle 134 stroke:#2563eb,stroke-width:2px;
  linkStyle 135 stroke:#2563eb,stroke-width:2px;
  linkStyle 136 stroke:#2563eb,stroke-width:2px;
  linkStyle 137 stroke:#2563eb,stroke-width:2px;
  linkStyle 138 stroke:#2563eb,stroke-width:2px;
  linkStyle 139 stroke:#2563eb,stroke-width:2px;
  linkStyle 140 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 141 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 142 stroke:#2563eb,stroke-width:2px;
  linkStyle 143 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 144 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 145 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 146 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 147 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 148 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 149 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 150 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 151 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 152 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 153 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 154 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 155 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 156 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 157 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 158 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 159 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 160 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 161 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 162 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 163 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 164 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 165 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 166 stroke:#7c3aed,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 167 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
  linkStyle 168 stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5;
```

Contains edges are solid blue, requires edges are dashed red, and contributesTo edges are dashed purple.

| Key | Kind | Title | Summary | Gating thresholds | Requires | Replaced by |
| --- | --- | --- | --- | --- | --- | --- |
| round | objective | Complete the round | Run the current policy in the selected world. | — | — | — |
| economy | mission | Develop the economy | Maintain capacity, protection, productive investment, and construction runway. | — | — | — |
| economy.producers | group | Resource producers | Develop lumberyard, quarry, and mine under the current producer policy. | — | — | — |
| economy.lumberyard | task | Lumberyard | Evaluate timber production and payback. | — | — | — |
| economy.quarry | task | Quarry | Evaluate stone production and payback. | — | — | — |
| economy.mine | task | Iron mine | Evaluate iron production and payback. | — | — | — |
| economy.balance | policy | Resource balance | Boost the producer of a resource whose stock (in minutes of its own production) lags the other two by 5 minutes or more. | lagMinutes=5, baseScore=90, maxScore=99 | — | — |
| economy.producers.5 | milestone | Producers at level 5 | All three resource producers reach level 5. | minimum=5 | — | — |
| economy.producers.8 | milestone | Producers at level 8 | All three resource producers reach level 8. | minimum=8 | — | — |
| economy.producers.10 | milestone | Producers at level 10 | All three resource producers reach level 10. | minimum=10 | — | — |
| economy.producers.12 | milestone | Producers at level 12 | All three resource producers reach level 12; the early capital gate is Lumberyard 14, Quarry 14, Mine 14. | minimum=12 | — | — |
| economy.producers.15 | milestone | Producers at level 15 | All three resource producers reach level 15 after Barracks 5. | minimum=15 | early.barracks5 | — |
| economy.producers.20 | milestone | Producers at level 20 | All three resource producers reach level 20. | minimum=20 | — | — |
| economy.producer-cap | policy | Producers capped at 25 | Capital producers stop at level 25; attack and defence transitions remain at level 20. | — | — | — |
| economy.capacity | group | Capacity and protection | Protect resources and maintain population and storage capacity. | — | — | — |
| economy.farm | task | Farm capacity | Keep free population for queued work and Pikeman training; before a long build, offer the Farm first if the batches trained meanwhile wouldn't fit. | — | — | — |
| economy.storehouse | task | Storehouse capacity | Prevent projected overflow; after a capture, proactively expand capital storage to fit the next Envoy before recurring admission, even without overflow. | — | — | — |
| economy.hall | task | Great Hall | Use the existing bounded construction payback comparison. | — | economy.producers.8 | — |
| economy.successor-window | policy | Early-build successor window | Allow only the existing strict construction-successor window. | remainingRealSecondsExclusive=10 | — | — |
| economy.payback | policy | Production payback | Keep the existing round-end production return test and ceiling. | producerCeiling=25 | — | — |
| economy.round-end | policy | Round-end completion | Keep current affordability, construction, and use deadlines. | — | — | — |
| economy.hall-push | policy | Great Hall push | Once producers reach 20, force the Great Hall to 15, then keep it growing alongside military growth. | level=15 | economy.producers.20 | — |
| early-game | group | Early game | Grow producers to 14/14/14, then build Barracks 1, Wall 5, Hall 10 and Barracks 5 before reaching producers 15. Train toward 200 home Pikemen alongside the build order and complete the infrastructure that enables conquest. | — | — | — |
| early.economy | milestone | Early producer gate | Reach Lumberyard 14, Quarry 14 and Mine 14. | lumberyard=14, quarry=14, mine=14 | — | — |
| early.barracks1 | task | Barracks 1 | Build Barracks 1 after the early producer gate. | level=1 | early.economy | — |
| early.wall5 | task | Wall 5 | Rush Wall 5 after Barracks 1, before further military development. | level=5 | early.barracks1 | — |
| early.hall10 | task | Hall 10 | Complete Hall 10 after Wall 5 and before further Barracks growth. | level=10 | early.wall5 | — |
| early.barracks5 | task | Barracks 5 | Grow Barracks to level 5 after Hall 10; Barracks stops there. | level=5 | early.hall10 | — |
| early.pikemen | task | 200 home Pikemen | Train Pikemen from Barracks 1 in parallel until 200 are home. | count=200 | early.barracks1 | military.pikemen-baseline |
| defense | mission | Military | Build the Pikemen garrison, keep the Raider attack force trained, and station Scouts. | — | — | — |
| military.garrison | group | Garrison | Organize the capital's garrison requirements and growth. | — | — | — |
| military.pikemen-baseline | task | Train Pikemen | Recruit from Barracks 1 toward the own target: 200 before producer 20, then max(200, 3 × strongest economic-city stationed Pikemen). With active requests, train toward max(own target, 250) + all active city requests, ensuring 250 retained after support. Without requests, keep the own target. | count=200 | — | — |
| military.defence-scale | policy | Capital holds 3× any city | At producer 20, the own target is max(200, 3 × strongest economic-city stationed Pikemen). With active requests, train toward max(own target, 250) + all active city requests; otherwise keep the own target. Economic cities follow via their ÷3 defender target. | multiplier=3 | economy.producers.20 | — |
| military.barracks-growth | task | Barracks grows when troops lag | Raise Barracks when it cannot train enough Pikemen or conquest Raiders in time; Barracks is capped at level 5. | — | — | — |
| military.scouting | group | Scouting | Build Stable 1 and keep the capital's Scouts trained. | — | — | — |
| military.stable1 | task | Stable 1 | After producers 15 and 200 home Pikemen, build Stable 1 for Scouts, including its Smithy 5 prerequisite. | level=1 | economy.producers.15, early.pikemen | — |
| military.scouts | task | Train Scouts | The capital keeps 20 Scouts at home per city it owns, and stations 20 in each economic city on request. | perCity=20 | military.stable1 | — |
| military.wall-cap | policy | Wall capped at 10 | Capital Walls stop at level 10. | maxLevel=10 | — | — |
| military.attack | group | Attack | Late-game resource sink: once the capital's producers reach 20, turn surplus into Lancers and Rams and keep building in the capital. | — | economy.producers.20 | — |
| military.attack-workshop | task | Workshop 10 | After Stable 10, build Workshop 10 before raising the Stable further. | level=10 | military.attack-stable | — |
| military.attack-stable | task | Stable 10 and beyond | Build the Stable to at least 10; after Workshop 10, keep raising it when it cannot train units fast enough. Farm takes priority. | level=10 | — | — |
| military.lancers | policy | Pump Lancers | Train Lancers from the Stable continuously while timber, stone and iron are each above 10,000 in the capital. | resourceFloor=10000 | — | — |
| military.rams | policy | Pump Rams | Train Rams from the Workshop while timber, stone and iron are each above 20,000 in the capital; Lancers come first. | resourceFloor=20000 | — | — |
| military.capital-growth | policy | Keep building the capital | The troop sink ranks below capital construction, so buildings keep growing while Lancers and Rams absorb the surplus. | — | — | — |
| conquest | mission | Conquest | Capture the first city once per round, then prepare for the next cities. | — | — | — |
| military.raiders | task | Raider force | Keep 150 Raiders for conquest, counting home, away and queued troops; replace losses. Each wave needs at least 100 at home and takes every Raider at home. | count=150 | — | — |
| first-conquest | group | First conquest | Starts at the early producer gate and Barracks 5 alongside the early game. Prepare the escort and Envoy and dispatch waves until the city is captured; later captures belong to Next cities. | originVillages=1, barracks=5, standingOrders=0 | early.barracks1 | — |
| conquest.infrastructure | group | Conquest enabled | Build Smithy 10, Market 5 and Court, with capacity and funding as needed. | — | economy.producers.15 | — |
| conquest.smithy10 | task | Smithy 10 | Build the conquest Smithy requirement. | level=10 | — | — |
| conquest.market5 | task | Market 5 | Build the conquest Market requirement. | level=5 | — | — |
| conquest.court | task | Court | Build the next conquest building returned by current rules. | level=1 | — | — |
| conquest.capacity | task | Conquest capacity prerequisite | Propose a Farm (96) when a conquest build or Raider/Envoy batch would leave less than max(50, 20% of the population limit rounded up) free. Propose a Storehouse (96) if any resource cost exceeds storage. | — | — | — |
| conquest.producer-funding | policy | Producer funding fallback | Compare the existing bounded producer investment against saving for the next conquest building. | — | — | — |
| conquest.producer-investment | task | Conquest producer investment | Build the selected producer when the bounded funding fallback applies. | — | — | — |
| conquest.enabled | milestone | Conquest enabled | Smithy 10, Market 5 and Court are complete; the Court needs the early-game Hall 10. | — | conquest.smithy10, conquest.market5, conquest.court | — |
| expansion | mission | Next cities | After the first capture, conquer the next cities one at a time once existing cities are developed. | — | conquest.enabled | — |
| conquest.escort | task | Prepare Raider escort | Prepare the simulated bounded escort without replacing surviving waves. | — | — | expansion.escort |
| conquest.envoy | task | Prepare Envoy | Prepare one reusable Envoy for the bounded mission. | count=1 | — | expansion.envoy |
| conquest.dispatch | task | Dispatch conquest wave | Recheck ownership and simulation before each of at most six waves. | maximumWaves=6 | conquest.escort, conquest.envoy, conquest.enabled | expansion.dispatch |
| conquest.target-owned | milestone | Target owned | Fresh village ownership completes the mission regardless of final response attribution. | — | — | — |
| conquest.first-achieved | milestone | First city captured | Retain evidence for the completed first conquest. | — | conquest.target-owned | — |
| expansion.recall | task | Recall the escort | After a capture, the conquering attack's survivors stay in the captured city as support; send every stationed Raider back home to the capital. Pikemen are left in place. | — | conquest.target-owned | — |
| capability.parallel-budgets | capability | Parallel mission budgets | Unavailable: no cross-mission parallel budget allocator. | — | — | — |
| capability.multi-submit | capability | Multiple submissions per cycle | Unavailable: one authorized submission per cycle remains. | — | — | — |
| roles | policy | City roles | Tag every city automatically: the conquest origin is the capital, every other city is economic. | — | — | — |
| logistics | mission | Supply economic cities | The capital fulfils requests published by economic cities: resources by trade, later defenders. | — | conquest.market5 | — |
| logistics.fulfil | task | Fulfil requests | Send each requested resource as its own trade, weighed against the capital's own builds; one shipment per resource in flight per city. | — | — | — |
| economic-city | mission | Economic city | Grow a captured city into an economy fed by capital shipments; no military. | — | — | — |
| econ.build-order | group | Build order | Fixed steps in order; each step starts only after the previous one is done. | — | — | — |
| econ.cellar3 | task | 1. Cellar 3 | Cheap first protection: hides 796 of each resource. | level=3 | — | — |
| econ.hall5 | task | 2. Great Hall 5 | First construction speed-up with shipped resources. | level=5 | econ.cellar3 | — |
| econ.cellar-cover | task | 3. Cellar covers requested stock | Raise the Cellar until it hides the requested stock: Cellar 7 hides 2,491, covering a 2,000 top-up. | level=7 | econ.hall5 | — |
| econ.hall13 | task | 4. Great Hall 13 | Keep building the Hall with pulled resources: about 47% faster construction at level 13. | level=13 | econ.cellar-cover | — |
| econ.cellar10 | task | 5. Cellar 10 | Hides 5,860 of each resource. | level=10 | econ.hall13 | — |
| econ.storehouse3 | task | 6. Storehouse 3 | Holds 5,358 of each resource, room for larger top-ups and for stock bound to the capital. | level=3 | econ.cellar10 | — |
| econ.setup-done | milestone | Setup done | Every build-order step is done; the city moves on to producers, storage growth and the Market. | — | econ.storehouse3 | — |
| econ.producers | group | Producers | Producers up to 10; above that is Producers 11–25, after Wall 10. | — | econ.setup-done | — |
| econ.lumberyard | task | Lumberyard | Grow timber production. | level=10 | — | — |
| econ.quarry | task | Quarry | Grow stone production. | level=10 | — | — |
| econ.mine | task | Iron mine | Grow iron production. | level=10 | — | — |
| econ.balance | policy | Resource balance | Same rule as the capital: boost the producer of a lagging resource; the boost is not capped by the economic-city producer score. | lagMinutes=5, baseScore=90, maxScore=99 | — | — |
| econ.producers.5 | milestone | Producers at level 5 | All three producers reach level 5. | minimum=5 | — | — |
| econ.producers.10 | milestone | Producers at level 10 | All three producers reach level 10. | minimum=10 | — | — |
| econ.producers-late | group | Producers 11–25 | Raise producers from level 11 through 25 after Wall 10. | — | econ.wall10 | — |
| econ.lumberyard25 | task | Lumberyard | Grow timber production. | level=25 | — | — |
| econ.quarry25 | task | Quarry | Grow stone production. | level=25 | — | — |
| econ.mine25 | task | Iron mine | Grow iron production. | level=25 | — | — |
| econ.producers.25 | milestone | Producers at level 25 | All three producers reach level 25. | minimum=25 | — | — |
| econ.farm | task | Farm when blocked | Build a Farm only when population blocks the next step. | — | — | — |
| econ.storage-growth | policy | Storage grows when needed | Raise the Storehouse when stock plus shipments in flight and income would overflow it; the Cellar follows so it keeps protecting the stock. | forecastTicks=300 | econ.setup-done | — |
| econ.storehouse | task | Storehouse | Storehouse upgrade chosen by the storage policy. | — | — | — |
| econ.cellar | task | Cellar follows storage | Keep Cellar protection at or above the stock the city holds. | — | — | — |
| econ.market-growth | policy | Market grows when needed | Market 1 after producers 5; further levels when the surplus for the capital needs more merchants than the Market has. | — | econ.setup-done | — |
| econ.no-military | policy | No military | Never builds Barracks, Smithy or Stable and never trains troops; the Wall up to 10 is the exception. Defenders and Scouts are stationed by the capital. | — | — | — |
| econ.market | task | Market | Build a Market once producers reach level 5 (needs Great Hall 3 and Storehouse 2); the market policy raises it when surplus shipping needs more merchants. | level=1 | econ.producers.5 | — |
| logistics.market-growth | task | Market grows when needed | Raise the capital's Market when open requests need more merchants than it has. | — | — | — |
| econ.requests | group | Requests to the capital | What this city asks the capital for; the capital decides whether it can afford it. | — | — | — |
| econ.request-resources | task | Request resources | Per resource, by stage: setup below 1,000 tops up to 2,000 (95); growth below 2,000 tops up to 4,000 (85); developed the same buffer at 40. | setupBelow=1000, setupTopUp=2000, setupScore=95, growthBelow=2000, growthTopUp=4000, growthScore=85, developedScore=40 | — | — |
| econ.request-defenders | task | Request defenders | Unlocked by Wall 10. Target stationed Pikemen = max(250, floor(capital home Pikemen ÷ 3)); request a top-up only below 80% (capital 600 → target 250, top-up below 200). The capital trains for 250 retained + all active city requests, or its higher own target plus requests, and sends only when 250 remain at home. | baseline=250, capitalShare=3, triggerShare=0.8 | econ.wall10 | — |
| econ.request-scouts | task | Request scouts | Keep 20 Scouts stationed; support Scouts defend against enemy scouting. | — | — | — |
| econ.producers.15 | milestone | Producers at level 15 | All three producers reach level 15. | minimum=15 | — | — |
| econ.surplus | task | Send surplus to the capital | Once all producers are 15+, ship stock above the next build's cost (at least 4,000 of each kept) to the capital, bounded by merchants and the capital's free storage. | producers=15, reserve=4000, minimumMerchants=5 | econ.market, econ.producers.15 | — |
| econ.wall10 | task | Wall 10 | Built after producers reach 10; the only military building an economic city builds. | level=10 | econ.producers.10 | — |
| expansion.next | group | Next conquest | After the first capture, keep taking one new city at a time when existing cities are developed enough. | — | conquest.first-achieved | — |
| expansion.readiness | policy | Expansion readiness | Start the next mission after capital readiness and Great Hall 10 in every economic city, only if estimated Envoy funding, training and capture fit before round end with a 60-tick margin; train its Envoy only after Every city defended. | economicHall=10, homePikemen=150, endMargin=60 | — | — |
| expansion.cities-defended | milestone | Every city defended | Every economic city has Wall 10 and at least 80% of its Pikemen target stationed. | economicWall=10, defenderShare=0.8 | — | — |
| expansion.envoy | task | Train next Envoy | Train one Envoy for the next target once the next conquest has started. | — | expansion.cities-defended | — |
| expansion.escort | task | Escort army at home | Before every wave, train up to max(150, simulated escort) Raiders; earlier survivors count. | — | — | — |
| expansion.dispatch | task | Dispatch waves | Recheck each of at most six waves with at least 100 home Raiders. Capture deadlines use current target loyalty from battle reports or target assessments, otherwise landed hits and regeneration; fresh admission assumes 100. | maximumWaves=6 | expansion.envoy, expansion.escort | — |
| expansion.captured | milestone | Target captured | The captured city is tagged economic and starts the economic-city flow. | — | — | — |
| expansion.cities4 | milestone | 4 cities owned | Own four cities before opening the enemy-conquest plan. | minimum=4 | — | — |
| expansion.enemy | group | Enemy conquest | Scout and simulate attacks on enemy player villages before dispatching conquest. | — | expansion.cities4 | — |
| expansion.enemy-target | policy | Close and big | Target enemy player villages, ranked by size (points) over distance. | — | — | — |
| expansion.enemy-scout | task | Scout the target | Send Scouts before any attack; use the report's intel for the battle simulation. | — | — | — |
| expansion.decisive | policy | Attack at 2× | Attack only with at least 100 Raiders at home, when our attack is at least 2× their defence and an Envoy is simulated to survive. Winner losses are (loser ÷ winner)^1.5, so a 2× edge costs about 35% of the army. | strengthRatio=2 | — | — |
| expansion.enemy-dispatch | task | Dispatch conquest | Dispatch the enemy conquest after scouting and a decisive battle simulation, with at least 100 Raiders at home. | — | expansion.enemy-scout | — |
