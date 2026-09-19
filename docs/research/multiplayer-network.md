# Netzwerk- und Multiplayer-Architektur für ein modernes Mobile-RTS

## 1. Executive Summary

RTS-Networking unterscheidet sich fundamental von Multiplayer-Netcode für Shooter, Rennspiele oder Actionspiele.

Bei einem Shooter existieren vielleicht einige Dutzend relevante replizierte Objekte. Bei einem RTS können dagegen Hunderte oder Tausende Units, Projektile, Gebäude, Ressourcen, Produktionsqueues, Buffs, AI-Zustände und Pathfinding-Prozesse gleichzeitig existieren.

Ein naiver Server-Ansatz

```text
Server:
    Unit 1 position
    Unit 2 position
    Unit 3 position
    ...
    Unit 1000 position

20x pro Sekunde an jeden Client senden
```

skaliert deshalb deutlich schlechter als:

```text
Player:
    "Units [12,18,22,...] -> MoveTo(400,270)"

Server:
    Command für Tick 8173 akzeptiert

alle Simulationen:
    führen denselben Command in Tick 8173 aus
```

Age of Empires hat dieses Prinzip bereits in den 1990ern eingesetzt. Ensemble berechnete damals, dass selbst die Übertragung einiger weniger Zustandswerte pro Einheit die mögliche Unit-Zahl massiv begrenzt hätte. Stattdessen liefen auf allen Rechnern dieselben Simulationen und nur Spielerbefehle wurden übertragen.

Supreme Commander verwendete dasselbe Grundprinzip für Spiele mit Tausenden Einheiten: eine deterministische Simulation mit 10 Simulations-Ticks pro Sekunde, getrennt von einer frei laufenden Präsentations-/Render-Schicht.

Der veröffentlichte Sourcecode von Command & Conquer: Generals zeigt ebenfalls ein framebasiertes Commandsystem mit `RunAhead`, Frame-Resends, CRC-Prüfungen und einem Logic-Tick, der in Multiplayer erst ausgeführt wird, wenn die notwendigen Frame-Daten vorhanden sind.

Blizzards öffentliche StarCraft-II-Protokolldokumentation bestätigt, dass die SC2-Simulation deterministisch ist. Replays speichern im Wesentlichen die Inputs der Spieler und führen beim Abspielen die Simulation erneut aus; für deterministische Wiedergabe benötigt SC2 sogar die passende Binary- und Data-Version. Die Dokumentation beschreibt außerdem einen festen `GameLoop`; im Echtzeitmodus des API-Protokolls laufen 22,4 GameLoops/s.

Factorio demonstriert schließlich eine interessante modernere Evolution: weiterhin deterministische Lockstep-Simulation, aber kein Full-Mesh-P2P mehr. Der Server sammelt die Inputs, bestimmt den autoritativen Command-Stream und verteilt pro Tick ein zusammengefasstes Paket. Ein langsamer Client muss dadurch nicht mehr zwangsläufig alle anderen blockieren.

Für ein neues Mobile-RTS würde ich deshalb als Ausgangsarchitektur bevorzugen:

```text
           Dedicated Match Server
          authoritative simulation
                   │
        authoritative command stream
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
    Client A    Client B    Client C
       │           │           │
 deterministic deterministic deterministic
 simulation    simulation    simulation
       │           │           │
      render      render      render
```

Das ist kein klassisches P2P-Lockstep.

Der Server:

* besitzt die kanonische Simulation,
* ordnet Commands einem Simulations-Tick zu,
* validiert Spielerbefehle,
* erzeugt den autoritativen Command-Stream,
* berechnet State-Hashes,
* hält Checkpoints und Replay-Daten,
* kontrolliert Disconnect/Reconnect.

Die Clients simulieren denselben Zustand lokal, sodass der Server im Normalbetrieb nicht permanent Unitpositionen übertragen muss.

Damit bekommt man einen Großteil der Skalierungsvorteile klassischer RTS-Lockstep-Architekturen, ohne sich vollständig an die langsamste Verbindung oder den langsamsten Client zu ketten.

---

# 2. Die eigentliche Netzwerkfrage eines RTS

Die zentrale Frage lautet nicht:

> TCP oder UDP?

Sie lautet:

> Welcher Teil des Spielzustands ist die autoritative Information, die über das Netzwerk synchronisiert wird?

Dafür gibt es im Wesentlichen drei Modelle.

| Modell                 | Übertragen wird                 | Vorteil                         | Hauptproblem            |
| ---------------------- | ------------------------------- | ------------------------------- | ----------------------- |
| State Replication      | Weltzustand                     | einfacheres Determinismusmodell | Bandbreite + Serverlast |
| Deterministic Lockstep | Commands/Input                  | extrem wenig Traffic            | Determinismus           |
| Hybrid                 | Commands + ausgewählte Zustände | flexibel                        | höhere Komplexität      |

Planetary Annihilation ist ein besonders interessantes Gegenbeispiel zur klassischen RTS-Tradition. Die Entwickler entschieden sich bewusst gegen Lockstep und für eine zentrale Server-Simulation. Der Server überträgt veränderte Eigenschaften als zeitbasierte „Curves“ bzw. Keyframes. Eine stehende Unit verursacht beispielsweise keinen Positions-Traffic; verändert sich nur ihre Position, wird nur diese Kurve aktualisiert. PA ließ den Server mit 10 Hz simulieren und die Clients interpolierten auf höhere Darstellungsraten.

Damit existieren zwei bewährte Extreme:

```text
AoE / SupCom / Factorio / klassisches RTS

Input
 ↓
deterministische Simulation überall
 ↓
World State
```

gegenüber:

```text
Planetary Annihilation / klassisches Client-Server

Input
 ↓
Server Simulation
 ↓
State Updates
 ↓
Client Presentation
```

Für dein Spiel würde ich eine Zwischenform wählen:

```text
Input
 ↓
AUTHORITATIVE SERVER SIM
 ↓
authoritative Commands
 ↓
CLIENT SIM
```

Der Server berechnet also tatsächlich das Spiel. Trotzdem repliziert er im Normalfall Commands statt des kompletten Weltzustands.

---

# 3. Age of Empires: das grundlegende RTS-Netzwerkmodell

Der klassische Artikel „1500 Archers on a 28.8“ von Ensemble Studios ist bis heute außergewöhnlich relevant.

Die Entwickler stellten fest, dass selbst die Übertragung von Position, Zustand, Blickrichtung und Schaden der Einheiten die mögliche Anzahl aktiver Units drastisch eingeschränkt hätte. Deshalb führte jeder Rechner dieselbe vollständige Simulation aus. Nur Spielerbefehle wurden synchronisiert.

Ein wichtiges Detail ist der zeitliche Versatz.

AoE führte Commands nicht sofort aus. Ein Befehl aus Communication Turn 1000 wurde beispielsweise für Turn 1002 vorgesehen. Typischerweise waren diese Communication Turns damals ungefähr 200 ms lang. Während ein Turn ausgeführt wurde, konnten Commands für zukünftige Turns übertragen und bestätigt werden.

Konzeptionell:

```text
Simulation läuft bei Tick 100

Input:
    Move(Unit17, X=250, Y=120)

Netzwerk:
    executeTick = 103

Tick 101
Tick 102

bis dahin:
    Paket kann übertragen
    bestätigt
    erneut übertragen werden

Tick 103:
    alle führen denselben Move aus
```

Das ist der Kern von Input Delay.

Die interessante Erkenntnis aus den damaligen Tests war außerdem, dass konstante Verzögerung subjektiv wesentlich besser funktionierte als stark schwankende Verzögerung. Bei AoE wurden etwa 250 ms Command Delay in den damaligen Tests kaum wahrgenommen; wechselnde Verzögerungen zwischen schnell und langsam wirkten dagegen störend. Das ist eine historische Messung für AoE und kein universeller heutiger Grenzwert, zeigt aber die Bedeutung von Jitter gegenüber reinem Ping.

AoE verwendete UDP und baute Ordering, Packet-Loss-Erkennung und Retransmission selbst darauf.

Noch wichtiger ist die Desync-Erfahrung.

Ensemble beschreibt Fälle, bei denen bereits eine minimale unterschiedliche Ausgangsposition eines Tieres langfristig vollkommen andere Zustände erzeugte. Sie checksumten Welt, Objects, Pathfinding, Targeting und andere Subsysteme, um diese Fehler aufzuspüren. Auch der deterministische Zufallszahlengenerator musste auf allen Teilnehmern dieselbe Anzahl von Aufrufen erhalten.

Das ist eine fundamentale Lektion:

> In einer deterministischen RTS-Simulation ist ein Desync normalerweise kein Netzwerkfehler. Er ist ein Simulationsfehler.

---

# 4. Command & Conquer: Generals — der Sourcecode zeigt viel

Der mittlerweile veröffentlichte Quellcode von Command & Conquer: Generals / Zero Hour ist in dieser Frage sehr aufschlussreich.

In `NetworkDefs.h` existiert:

```cpp
struct CommandPacket
{
    UnsignedInt m_frame;
    UnsignedShort m_numCommands;
    ...
};
```

also explizit:

```text
Frame N
 ├─ Command 1
 ├─ Command 2
 └─ Command 3
```

Außerdem existieren `MAX_FRAMES_AHEAD`, `MIN_RUNAHEAD`, Frame-Puffer und `FRAMES_TO_KEEP`. Das Netzwerk kennt Commands wie `FRAMEINFO`, `RUNAHEAD`, `FRAMERESENDREQUEST`, Acknowledgements und Keepalives.

Besonders eindeutig ist das Game-Loop-Verhalten:

```cpp
if ((TheNetwork == NULL && !TheGameLogic->isGamePaused())
    || (TheNetwork && TheNetwork->isFrameDataReady()))
{
    TheGameLogic->UPDATE();
}
```

Das bedeutet konzeptionell:

```text
Single Player:
    Sim darf laufen.

Multiplayer:
    Sim darf nur weiterlaufen,
    wenn Network Frame vollständig ist.
```

Das ist klassisches synchrones RTS-Networking.

Generals besitzt außerdem:

```text
sendLocalGameMessage(..., frame)
getFrameCommandList(frame)
allCommandsReady(frame)
processFrameTick(frame)
getExecutionFrame()
notifyOthersOfNewFrame()
requestFrameDataResend(...)
```

und führt explizit FPS- und Latenzmetriken für andere Teilnehmer.

Zusätzlich gibt es einen GameLogic-CRC und sogar einen eigenen Netzwerk-Message-Typ:

```text
MSG_LOGIC_CRC
```

sowie `sawCRCMismatch()`.

Interessant ist auch die Paketgröße. Generals zielte explizit auf 512 Bytes Gesamtgröße ab und reservierte unter damaligen IPv4-Annahmen 476 Bytes als Paketpayload.

Man sieht hier bereits fast alle Bestandteile, die ein heutiges System ebenfalls benötigt:

```text
command frames
future execution
run-ahead
ACK
resend
connection health
simulation checksum
disconnect handling
```

Nur Transport und Server-Topologie würde ich heute anders bauen.

---

# 5. Supreme Commander: Simulation und Rendering strikt trennen

Supreme Commander ist besonders relevant, weil das Spiel mit sehr großen Unitzahlen umgehen musste.

Laut Forrest Smith, der mit der Supreme-Commander-Engine bei Gas Powered Games arbeitete, besaß die Engine zwei getrennte Ebenen:

```text
Simulation Layer
    10 Hz
    deterministic
    movement
    physics
    AI
    gameplay

User Layer
    bis 60 Hz
    animation
    UI
    graphics
```

Nur Input-Commands wurden zwischen den Teilnehmern ausgetauscht.

Das ist für dein Mobile-RTS ein sehr wichtiges Architekturprinzip.

Deine Darstellung darf beispielsweise 60 oder 120 FPS erreichen:

```text
Render:
16.67 ms
16.67 ms
16.67 ms
...
```

während Gameplay nur alle 50 ms aktualisiert wird:

```text
Simulation @ 20 Hz:

T0 -------- T1 -------- T2 -------- T3
     50 ms       50 ms       50 ms
```

Zwischen zwei Simulationen interpoliert der Renderer.

Damit wird beispielsweise:

```text
SimPos previous = (100,100)
SimPos current  = (110,100)
```

visuell als:

```text
101
103
106
108
110
```

dargestellt.

Die Simulation kennt diese Zwischenpositionen überhaupt nicht.

Das bringt drei Vorteile:

1. deterministische Simulation bekommt einen festen Zeitschritt;
2. Netzwerk-Tickrate muss nicht Render-FPS entsprechen;
3. Mobile-GPUs können Render-FPS dynamisch ändern, ohne die Simulation zu verändern.

Supreme Commander musste dafür allerdings den klassischen Nachteil akzeptieren: Ein langsamer Teilnehmer konnte die gesamte Simulation herunterziehen.

Genau diesen Teil würde ich heute nicht übernehmen.

---

# 6. StarCraft II: was Blizzard öffentlich tatsächlich bestätigt

Bei StarCraft II ist wichtig, zwischen belegtem Wissen und häufig wiederholten Aussagen über den internen Battle.net-Transport zu unterscheiden.

Blizzards eigene `s2client-proto`-Dokumentation sagt eindeutig:

> Die Simulation ist bei gleichem Random Seed vollständig deterministisch.

Außerdem:

> Replays enthalten effektiv die Spielerinputs und lassen daraus die vollständige Simulation erneut ablaufen.

Deshalb muss ein Replay sogar mit der richtigen Binary- und Data-Version ausgeführt werden.

Das ist ein extrem starkes Indiz dafür, wie zentral Determinismus für die SC2-Engine ist.

Die API dokumentiert außerdem einen festen GameLoop und 22,4 GameLoops/s im Echtzeitmodus. Bei zwei Bot-Clients wartet ein Step darauf, dass beide Teilnehmer synchronisiert sind.

Was diese offizielle Dokumentation dagegen nicht vollständig spezifiziert, ist das genaue Produktionsprotokoll zwischen Ladder-Clients und Battle.net. Deshalb würde ich Aussagen wie „SC2 ist reines P2P“ nicht allein auf Basis dieser Quelle treffen.

Für die Engine-Architektur ist das aber fast nebensächlich.

Relevant ist:

```text
same initial state
+
same RNG seed
+
same command sequence
+
same simulation version
=
same resulting world
```

Das ist genau das Modell, das du für Command-basierte Synchronisation brauchst.

---

# 7. Factorio: wahrscheinlich das interessanteste moderne Vorbild

Factorio startete ebenfalls mit vollständigem P2P-Lockstep.

Wube beschreibt das ursprüngliche Modell so:

```text
Peer A ─── Peer B
  │  \       /
  │   \     /
  │    Peer C
  │
 Peer D
```

Jeder Teilnehmer musste mit jedem anderen kommunizieren.

Das skaliert netzwerktechnisch ungefähr mit:

```text
O(n²)
```

Verbindungen beziehungsweise Paketwegen.

Factorio stellte fest, dass NAT, unterschiedliche Latenzen, Joining/Leaving und einzelne Lag-Spikes das System erheblich komplizierten.

Die spätere Architektur wurde:

```text
         Server
       /   |   \
      /    |    \
     A     B     C
```

Aber wichtig:

Der Server repliziert deshalb nicht plötzlich alle Weltzustände.

Stattdessen sammelt er die Input-Actions aller Spieler für einen Tick, merged sie in ein autoritatives Paket und verteilt dieses an die Clients. Ein verlorenes Paket kann vom Server erneut angefordert werden. Die Anzahl der Kommunikationsbeziehungen sinkt damit vom Full-Mesh-Modell auf eine lineare Struktur.

Noch interessanter:

Der Server wird zur einzigen Input-Authority.

Damit kann er einen Teilnehmer mit einem Lag-Spike temporär aus dem aktuellen Command-Bundle herauslassen, statt das gesamte Spiel anzuhalten.

Das ist für Mobile äußerst relevant.

---

# 8. Meine Zielarchitektur für dein RTS

Ich würde dein System konzeptionell so bauen:

```text
                   MATCH SERVICE
                        │
                authentication
                matchmaking
                server allocation
                        │
                        ▼
               ┌─────────────────┐
               │  Match Server   │
               │                 │
               │ canonical sim   │
               │ tick sequencer  │
               │ command auth    │
               │ state hashes    │
               │ checkpoints     │
               │ replay log      │
               └────────┬────────┘
                        │
               authoritative frames
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Client A      Client B      Client C
          │             │             │
       local sim      local sim      local sim
          │             │             │
       renderer       renderer       renderer
```

Der Server sollte selbst die komplette Gameplay-Simulation ausführen.

Das ist ein entscheidender Unterschied zu einem bloßen Relay.

Damit existiert immer eine kanonische Antwort auf:

```text
Wie viel HP hat Unit 127?
Wo befindet sie sich?
Hat Spieler 2 genug Ressourcen?
Ist der Command gültig?
Wie lautet StateHash(Tick 9281)?
```

---

# 9. Simulation Tick

Für dein Spiel würde ich zunächst mit:

```text
SIMULATION_HZ = 20
SIMULATION_DT = 50 ms
```

arbeiten.

Das ist kein universeller Optimalwert, sondern ein vernünftiger Ausgangspunkt zwischen CPU-Kosten und Reaktionszeit.

Supreme Commander arbeitete beispielsweise mit 10 Hz; StarCraft IIs dokumentierter GameLoop im API-Echtzeitmodus läuft mit 22,4 Loops/s.

Deine Architektur wäre dann:

```text
Network Thread
      │
      ▼
CommandBuffer
      │
      ▼
Simulation @20Hz
      │
      ▼
Render Snapshots
      │
      ▼
Renderer @60/90/120Hz
```

Unter keinen Umständen sollte:

```text
simulation dt = actualFrameTime
```

gelten.

Also nicht:

```cpp
unit.position += velocity * realFrameDelta;
```

wenn dieses `realFrameDelta` vom Gerät stammt.

Gameplay muss immer:

```cpp
simulateFixedTick();
```

verwenden.

---

# 10. Der Command Stream

Ein Netzwerkcommand sollte eine vollständig definierte deterministische Operation darstellen.

Beispielsweise:

```cpp
struct MoveCommand
{
    uint32_t playerId;
    uint32_t sequence;
    uint32_t executionTick;

    UnitSet units;

    FixedVec2 destination;

    uint8_t mode;
    uint8_t formation;
};
```

Nicht übertragen werden:

```text
Unit bewegt sich auf x=...

Unit bewegt sich auf x=...

Unit bewegt sich auf x=...

Unit bewegt sich auf x=...
```

sondern:

```text
Tick 58321:
    UnitGroup X -> MoveTo(250,400)
```

Pathfinding, Formation, Steering, Target Acquisition usw. werden anschließend simuliert.

Das verbindet deine Netzwerkarchitektur unmittelbar mit der vorherigen Pathfinding-Architektur.

---

# 11. Unit IDs und Gruppencodierung

Ein Command auf 300 Units darf nicht notwendigerweise 300 vollständige Entity-Objekte oder GUIDs übertragen.

Beispielsweise:

```text
MoveCommand
    command = MOVE
    target = (1200, 800)

    unitIds:
      1001
      1002
      1003
      ...
```

Mit 32-Bit-IDs wären 300 IDs bereits 1200 Bytes.

Mögliche Optimierungen:

```text
sorted IDs
+
delta encoding
+
varints
```

Aus:

```text
1001
1002
1003
1010
1011
```

wird:

```text
1001
+1
+1
+7
+1
```

Noch effizienter kann ein temporärer `UnitSetId` sein:

```text
DefineUnitSet
    id = 381
    members = [...]

Move
    set = 381
    target = ...
```

Damit können Rapid-Fire-Befehle auf dieselbe Selection extrem klein werden.

Wichtig ist nur, dass die Auflösung des Sets deterministisch ist.

---

# 12. Commands brauchen eine totale Ordnung

Alle Simulationsteilnehmer müssen exakt dieselbe Reihenfolge sehen.

Beispielsweise:

```text
Tick 500:

Player 1 Command 928
Player 2 Command 117
Player 1 Command 929
```

Dafür würde ich eine kanonische Ordnung definieren:

```text
executionTick
playerId
sequenceNumber
```

also:

```cpp
sortKey = (tick, playerId, sequence);
```

Damit können zwei Commands niemals aufgrund unterschiedlicher Paketreihenfolge unterschiedlich verarbeitet werden.

---

# 13. Future Execution / Input Lead

Der Client darf einen Command nicht für den gerade bereits laufenden Tick senden.

Stattdessen:

```text
Server Tick = 1000

Minimum command lead:
3 ticks

frühester Command:
Tick 1003
```

Bei 20 Hz wären das:

```text
3 × 50 ms = 150 ms
```

Zeit zum:

```text
Client → Server
Server processing
Server → Client
Jitter
Retransmission
```

Das ist konzeptionell dasselbe Prinzip, das Age of Empires mit zukünftigen Communication Turns und C&C Generals mit `RunAhead` nutzte.

Der entscheidende Unterschied:

Ich würde den Match-Server unabhängig weiterlaufen lassen.

Ein langsamer Client darf:

```text
Server Tick: 1000
Client Tick:  993
```

haben.

Wenn seine CPU wieder aufholt:

```text
Client simulation:
993
994
995
...
1000
```

ggf. ohne Rendering.

Factorio ging genau in diese Richtung: Der Server sollte nicht mehr das komplette Match anhalten, wenn ein Client nicht schnell genug simuliert oder temporär nicht kommuniziert.

---

# 14. Latency Hiding

Die größte Schwäche von Lockstep ist gefühlte Input-Latenz.

Hier würde ich zwischen:

```text
UI Response
```

und:

```text
Gameplay Confirmation
```

trennen.

Der Spieler tippt beispielsweise auf die Karte.

Sofort:

```text
move marker
destination circle
formation preview
unit acknowledgment sound
command line
```

Dann trifft der Command im autoritativen Tick ein und die eigentliche Unit-Bewegung beginnt.

Dadurch fühlt sich der Input unmittelbar angenommen an, obwohl die Simulation noch wartet.

Factorio ging weiter und implementierte einen eigenen „Latency State“. Dieser wird aus dem echten Game State plus noch nicht bestätigten lokalen Inputs erzeugt und ausschließlich für Darstellung und Eingabe verwendet. Er wird ständig aus der autoritativen Simulation neu aufgebaut und korrigiert sich dadurch automatisch.

Das Prinzip ist hervorragend:

```text
Authoritative State
        │
        ├──────────────────────┐
        │                      │
        ▼                      ▼
   Simulation State       Latency State
                               │
                       pending local inputs
                               │
                               ▼
                             UI
```

Für dein RTS würde ich zunächst nur ungefährliche Dinge vorhersagen:

```text
selection
command markers
building ghost
formation preview
movement intent indicators
```

und nicht sofort die komplette Combat-Simulation.

---

# 15. Warum ich kein vollständiges Rollback empfehlen würde

Rollback funktioniert hervorragend bei Spielen mit relativ kleinem Simulation State.

Bei einem großen RTS müsste man eventuell:

```text
World State Tick 5000
World State Tick 5001
World State Tick 5002
...
```

speichern und nach einem verspäteten Input:

```text
restore Tick 5000
resim 5001
resim 5002
...
```

Bei:

```text
1000 Units
Pathfinding
AI
Projectiles
Economy
Fog of War
Triggers
```

kann das teuer werden.

Darum würde ich bei einem klassischen RTS primär:

```text
small command delay
+
latency hiding
+
future execution
```

verwenden.

Rollback kann später für sehr begrenzte Subsysteme hinzukommen.

---

# 16. Determinismus wird zum zentralen Engine-Requirement

Wenn du Commands statt State synchronisierst, muss gelten:

```text
Simulation(initialState, inputs)
```

liefert überall exakt dasselbe Ergebnis.

Nicht:

```text
ungefähr dieselbe Position
```

sondern:

```text
bit-identischer spielrelevanter Zustand
```

Glenn Fiedler beschreibt genau diese Anforderung für Deterministic Lockstep und weist insbesondere auf unterschiedliche Floating-Point-Ergebnisse zwischen Compilern, Betriebssystemen und Instruktionssätzen hin.

Das ist für dein Spiel besonders relevant, weil du wahrscheinlich mindestens:

```text
ARM64 Android
ARM64 iOS
x86-64 Server
```

unterstützen möchtest.

---

# 17. Fixed Point wäre für dein Projekt sehr attraktiv

Ich würde spielrelevante numerische Größen möglichst nicht auf unkontrollierte Floats aufbauen.

Beispielsweise:

```cpp
struct SimPosition
{
    int32_t x;
    int32_t y;
};
```

mit:

```text
1 world unit = 256 simulation units
```

Dann entspricht:

```text
1 integer step = 1/256 world unit
```

Geschwindigkeit:

```text
simulationUnits / tick
```

Winkel:

```cpp
uint16_t angle;
```

mit:

```text
0       = 0°
16384   = 90°
32768   = 180°
49152   = 270°
```

Health:

```cpp
int32_t health;
```

Resources:

```cpp
int64_t credits;
```

Timers:

```cpp
uint32_t remainingTicks;
```

Rendering konvertiert diese Werte anschließend in:

```text
float / Vector3
```

Das Render-Ergebnis muss nicht deterministisch sein.

Die Gameplay-Simulation schon.

---

# 18. Pathfinding muss dann ebenfalls deterministisch werden

Das betrifft direkt dein vorheriges Problem.

Ein A*-Search darf nicht auf Rechner A bei Gleichstand Node 23 auswählen und auf Rechner B Node 24.

Daher beispielsweise:

```text
priority:
1. lowest f
2. lowest h
3. lowest nodeId
```

statt nur:

```text
lowest f
```

Ebenso problematisch:

```cpp
unordered_map
unordered_set
parallel jobs
pointer order
```

wenn deren Iterationsreihenfolge Spielentscheidungen beeinflusst.

Dein Steering muss ebenfalls stabile Nachbarschaftsreihenfolgen verwenden.

Beispielsweise:

```text
query neighboring units

sort by EntityId

calculate avoidance
```

Nicht:

```text
iterate whatever order spatial hash happened to return
```

Dasselbe gilt für:

```text
Collision Pairs
Target Selection
AI Decisions
Formation Assignment
Arrival Slots
Building Updates
Resource processing
```

---

# 19. Multithreading und Determinismus

Multithreading ist nicht verboten.

Aber:

```text
Thread completion order
```

darf nicht:

```text
Gameplay order
```

bestimmen.

Gut:

```text
parallel:
    calculate candidate results

barrier

deterministic merge:
    sort by stable ID
    apply
```

Schlecht:

```text
worker 1 finishes first
    -> damage first

worker 2 finishes first
    -> movement first
```

Der Simulationszustand darf niemals vom OS-Scheduler abhängen.

---

# 20. Zufallszahlen

AoE dokumentiert ausdrücklich, wie problematisch bereits unterschiedliche RNG-Aufrufzahlen waren.

Ich würde deshalb keinen einzigen globalen:

```cpp
Random rng;
```

verwenden.

Besser:

```text
WorldGenerationRng
CombatRng
AIRng
LootRng
```

oder sogar:

```text
EntityRng(entityId)
```

Damit verursacht beispielsweise ein zusätzliches kosmetisches Geräusch nicht plötzlich einen anderen Combat-Random-Wert.

StarCraft II verwendet ebenfalls einen synchronisierten Seed; Blizzards Dokumentation bestätigt, dass die Simulation mit gleichem Seed deterministisch reproduzierbar ist.

Kosmetische Randomness sollte grundsätzlich von Gameplay-Randomness getrennt sein.

---

# 21. State Hashes

Alle Clients und der Server sollten regelmäßig einen Hash des relevanten Simulation State erzeugen.

Beispielsweise alle:

```text
20 ticks = 1 Sekunde
```

Pseudo:

```cpp
Hash64 worldHash;

worldHash.add(currentTick);

for (entity in entitiesSortedById)
{
    worldHash.add(entity.id);
    worldHash.add(entity.position);
    worldHash.add(entity.health);
    worldHash.add(entity.state);
}

worldHash.add(resources);
worldHash.add(rngStates);
worldHash.add(navVersion);
```

Dann:

```text
Server:
Tick 20400
Hash C09A13...

Client:
Tick 20400
Hash C09A13...

OK
```

oder:

```text
Client B:
Hash 96F83...

DESYNC
```

AoE verwendete Checksum-Prüfungen über zahlreiche Game-Systeme; C&C Generals besitzt explizite Logic-CRC-Mechanismen; Factorio erzeugt bei Desyncs komplette Vergleichsdumps zwischen Client- und Serverzustand.

---

# 22. Ein einzelner WorldHash reicht zum Debuggen nicht

Zusätzlich würde ich Subsystem-Hashes erzeugen:

```text
WorldHash
 ├── EntityHash
 ├── EconomyHash
 ├── CombatHash
 ├── NavigationHash
 ├── PlayerHash
 ├── RNGHash
 └── TriggerHash
```

Bei einem Fehler erhältst du dann:

```text
Tick 48,210

World       mismatch
Entities    mismatch
Economy     OK
Combat      OK
Navigation  mismatch
RNG         OK
```

Damit weißt du sofort:

> Navigation hat sich zuerst getrennt.

Noch besser:

```text
EntityHash bucket 0..255
```

nach Entity ID.

Dann lässt sich der Fehler auf eine kleine Objektmenge reduzieren.

---

# 23. Reconnect muss von Anfang an geplant werden

Auf Mobile ist Reconnect kein Edge Case.

Der Nutzer:

```text
Wi-Fi
 ↓
kurzer Verbindungsverlust
 ↓
5G
```

oder:

```text
Spiel
 ↓
Telefonanruf / App-Hintergrund
 ↓
Spiel
```

muss wieder in dasselbe Match gelangen können.

Android stellt ausdrücklich APIs bereit, über die Anwendungen Netzwerkwechsel erkennen können. QUIC besitzt Connection IDs, damit eine Verbindung sogar Änderungen von IP-Adresse und Port überleben kann; dies ist explizit für Network Migration vorgesehen.

Das ist ein massiver Unterschied zu Desktop-RTS der 1990er.

---

# 24. Checkpoint + Command Log

Ich würde nicht versuchen, bei Reconnect das gesamte Match seit Tick 0 zu resimulieren.

Stattdessen:

```text
Checkpoint Tick 10000
Checkpoint Tick 10200
Checkpoint Tick 10400
Checkpoint Tick 10600

Command log:
10601
10602
10603
...
```

Reconnect:

```text
1. Client authentifiziert Session erneut.

2. Server wählt letzten brauchbaren Checkpoint.

3. Snapshot wird übertragen.

4. Command Stream seit dem Checkpoint wird übertragen.

5. Client lädt Snapshot.

6. Client simuliert ohne Rendering schnell vorwärts.

7. Client erreicht Live Tick.

8. normales Rendering startet.
```

Factorio diskutiert exakt diese Grundidee: Save-State übertragen, währenddessen Commands sammeln und den neuen Client anschließend durch schnelle Resimulation aufholen lassen.

Supreme Commander zeigt die Alternative und deren Problem: Ein vollständiger State konnte bei großen Matches sehr groß werden, während das erneute Abspielen aller Inputs zwar wenig Netzwerkverkehr verursachte, aber umfangreiche Resimulation verlangte.

Checkpoint + Command Tail kombiniert beide Vorteile.

---

# 25. Checkpoints sollten Teil des Engine-Designs sein

Deine Simulation sollte daher von Anfang an:

```text
SerializeDeterministicState()
DeserializeDeterministicState()
```

beherrschen.

Nicht lediglich:

```text
Save Game UI
```

sondern ein stabiles binäres Simulationformat.

Ein Snapshot muss beinhalten:

```text
tick
entities
entity ids
players
resources
queues
projectiles
combat state
AI state
RNG states
navigation dynamic state
timers
triggers
production
fog state
```

Nicht enthalten sein müssen:

```text
particle systems
animation frames
camera
audio
UI
screen shake
selection highlights
```

---

# 26. Replays fallen dann fast kostenlos ab

Ein deterministischer Replay besteht konzeptionell aus:

```text
Match Header

gameVersion
mapHash
rulesHash
seed
players

+

Command Stream
```

StarCraft II funktioniert genau nach diesem Grundprinzip: Ein Replay führt die Simulation mit den aufgezeichneten Spielerinputs erneut aus. Deshalb muss dafür die passende Game/Data-Version vorhanden sein.

AoE stellte ebenfalls fest, dass dieselbe Architektur Recorded Games fast automatisch ermöglichte und diese gleichzeitig ein hervorragendes Debugging-Werkzeug wurden.

Für dein Spiel würde ich zusätzlich alle paar Minuten einen optionalen Replay-Checkpoint speichern.

Dann kann der Zuschauer zu Minute 30 springen, ohne 30 Minuten Simulation nachzuholen.

---

# 27. Versionsmanagement wird kritisch

Lockstep zwischen:

```text
Client v1.7.2
```

und:

```text
Server v1.7.3
```

ist gefährlich.

Selbst eine vermeintlich kleine Änderung wie:

```text
Target priority:
distance < threat
```

statt:

```text
threat < distance
```

zerstört Determinismus.

Deshalb sollte ein Match einen festen:

```text
simulationBuildHash
protocolVersion
rulesHash
mapHash
contentHash
```

besitzen.

Der Matchmaker darf nur kompatible Builds zusammenführen.

Ein bereits laufendes Match bleibt auf seiner Version.

Blizzards Replay-System benötigt aus genau diesem Grund eine definierte Binary- und Data-Version.

Factorio prüft bei Multiplayer sogar Mod-Checksums, um unterschiedliche Simulationsdaten zu verhindern.

---

# 28. Transport: UDP oder QUIC?

Die Simulationarchitektur ist wichtiger als der Transport.

Für eine eigene Implementierung sehe ich zwei vernünftige Varianten.

## Variante A: UDP + eigene Reliability

Klassisch:

```text
UDP
+
sequence numbers
+
ACK bitfield
+
retransmit
+
channels
+
encryption
+
connection management
```

Das machen beziehungsweise machten viele Spiele, darunter AoE und Factorio. Factorio verwendet UDP und baut eine eigene Reliable-Delivery-Schicht für Loss und Reordering darauf.

Vorteil:

```text
volle Kontrolle
sehr geringer Overhead
gut verstandenes Game-Networking-Modell
```

Nachteil:

```text
du implementierst einen halben Transportstack selbst
```

---

# 29. QUIC ist für Mobile ungewöhnlich interessant

QUIC läuft über UDP, bietet aber:

```text
verschlüsselte Verbindung
reliable Streams
mehrere unabhängige Streams
connection IDs
network migration
congestion control
```

Zusätzlich definiert RFC 9221 unzuverlässige QUIC-Datagrams für Real-Time-Anwendungen, ausdrücklich unter anderem Gaming.

Für Mobile ist Connection Migration besonders interessant:

```text
192.168.x.x Wi-Fi
       ↓
Verbindung wechselt
       ↓
5G IP
```

QUIC Connection IDs ermöglichen, dass eine bestehende logische Verbindung Änderungen von IP und UDP-Port überlebt.

Apple empfiehlt in seiner aktuellen Network-Framework-Dokumentation für entsprechende moderne Peer-/Client-Server-Fälle sogar QUIC Datagrams als Alternative zu eigenem UDP-Verbindungsmanagement.

Wenn du einen stabilen plattformübergreifenden QUIC-Stack zur Verfügung hast, würde ich ihn deshalb ernsthaft prüfen.

---

# 30. QUIC-Kanäle würde ich ungefähr so verwenden

```text
QUIC Connection
│
├── Reliable Control Stream
│     login
│     handshake
│     session state
│
├── Client → Server Command Stream
│
├── Server → Client Frame Stream
│
├── Snapshot Stream
│
├── Chat Stream
│
└── Datagrams
      ping
      transient metrics
      optional non-critical data
```

Der wichtige Punkt:

Snapshot-Transfers dürfen niemals deinen Gameplay-Command-Stream blockieren.

Ein 5-MB-Reconnect-State gehört auf einen anderen Stream.

---

# 31. Warum nicht einfach TCP?

TCP garantiert:

```text
reliable
ordered
```

Das klingt perfekt.

Bei Packet Loss kann aber ein verlorenes Segment nachfolgende Daten desselben Byte-Streams blockieren.

Für:

```text
Chat
Download
Match commands
Snapshot
```

auf derselben TCP-Verbindung kann das störend sein.

QUIC trennt die zuverlässigen Streams stärker voneinander.

Bei einem Command Stream selbst ist Ordered Delivery dagegen korrekt — Tick 1002 kann ohnehin nicht sinnvoll vor einem fehlenden Tick 1001 verarbeitet werden.

---

# 32. Paketgröße

Falls du direkt mit UDP arbeitest, würde ich normale Real-Time-Pakete bewusst klein halten.

QUIC verlangt, dass ein Netzwerkpfad mindestens UDP-Payloads von 1200 Bytes unterstützt; ohne PMTU-Discovery sollen QUIC-Endpunkte nicht einfach größere Datagramme voraussetzen. IP-Fragmentierung wird dabei ausdrücklich vermieden.

Für einen eigenen UDP-Transport ist deshalb ungefähr:

```text
~1000–1200 Byte maximaler Gameplay-Datagram-Payload
```

ein sinnvoll konservativer Ausgangspunkt.

Große Daten:

```text
maps
snapshots
replays
```

werden fragmentiert beziehungsweise über einen zuverlässigen Stream transportiert.

Interessant ist die historische Parallele: C&C Generals definierte ebenfalls bewusst eine kleine Paketobergrenze, damals 476 Bytes Payload, um unter insgesamt ungefähr 512 Bytes zu bleiben.

---

# 33. Command Reliability

Gameplay-Commands dürfen nicht verloren gehen.

Ein typisches Paketprotokoll könnte beispielsweise enthalten:

```cpp
struct PacketHeader
{
    uint64_t connectionId;

    uint32_t packetSequence;

    uint32_t ackSequence;
    uint64_t ackBits;

    uint32_t serverTick;

    uint16_t protocolVersion;
};
```

Damit weiß der Sender:

```text
Packet 4000 angekommen
3999 angekommen
3998 verloren
3997 angekommen
...
```

Verlorene Commands werden erneut gesendet.

C&C Generals hatte bereits explizite Ack-Stages, Sequencing und Frame-Resend-Requests; AoE implementierte ebenfalls Drop Detection und Retransmission über UDP.

---

# 34. „Kein Command“ muss ebenfalls eindeutig sein

Ein subtile Falle:

```text
Tick 100:
kein Paket angekommen
```

bedeutet nicht automatisch:

```text
Tick 100:
kein Spieler hat etwas getan
```

Vielleicht ging das Paket verloren.

Daher braucht der Client eine autoritative Information:

```text
Frame 100 complete
0 commands
```

beziehungsweise:

```text
confirmedThroughTick = 100
```

Erst dann darf die Simulation Tick 100 sicher abschließen.

Factorios Servermodell sendet deshalb zusammengefasste autoritative Tick-Pakete.

---

# 35. Servervalidierung

Der Client darf niemals entscheiden:

```text
Ich habe 500 Credits.
```

Er darf nur sagen:

```text
Ich möchte Gebäude X bauen.
```

Der Server prüft:

```text
gehört die Builder Unit diesem Spieler?
existiert sie?
ist die Position erlaubt?
sind Ressourcen vorhanden?
ist Tech freigeschaltet?
ist Cooldown beendet?
ist der Command syntaktisch plausibel?
```

Danach gelangt der Command in den autoritativen Stream.

Gameplayvalidierung, deren Ergebnis vom Weltzustand abhängt, sollte deterministisch zum Execution Tick erfolgen.

Beispielsweise:

```text
BuildCommand arrives Tick 1000
Scheduled Tick 1003

Tick 1003:
    player has 900 credits
    cost = 1000

Result:
    rejected deterministically
```

Alle Simulationen erhalten dasselbe Resultat.

---

# 36. Anti-Cheat: der große Nachteil von Lockstep

Ein dedizierter Server löst viele Cheats:

```text
illegal commands
speed hacks
resource injection
fake unit ownership
packet manipulation
```

Aber nicht automatisch Fog-of-War-Hacks.

Warum?

Wenn Client A die komplette Welt simulieren soll, muss er wissen:

```text
EnemyTank 47
position = ...
health = ...
orders = ...
```

selbst wenn der Spieler diesen Tank eigentlich nicht sehen darf.

Die UI versteckt ihn.

Ein manipulierter Client kann diese Information jedoch prinzipiell auslesen.

Bereits Ensemble stellte beim AoE-Modell fest, dass Simulationsmanipulation zwar sehr schwer war, lokale Informationslecks wie Reveal-Cheats aber weiterhin möglich waren.

Das ist ein fundamentaler Trade-off.

---

# 37. Falls Fog-of-War-Cheating absolut verhindert werden soll

Dann brauchst du eine andere Architektur:

```text
Authoritative Server

Player A bekommt nur:
    eigene Units
    sichtbare Gegner
    bekannte Informationen

Player B bekommt anderes State Set
```

Dann können die Clients aber nicht mehr die vollständige Welt deterministisch simulieren.

Du bewegst dich Richtung:

```text
Server State Replication
```

Planetary Annihilation ist ein gutes Beispiel dafür, dass auch ein großes RTS so funktionieren kann. Der Server simuliert vollständig und die Clients erhalten State-Kurven/Keyframes.

Die Entscheidung lautet also:

```text
maximale Bandbreiteneffizienz
         ↕
vollständige Hidden-State-Security
```

Beides gleichzeitig ist schwierig.

---

# 38. Für ein Mobile-RTS würde ich diesen Trade-off bewusst entscheiden

Wenn dein Spiel:

```text
Casual
Co-op
PvE
private Multiplayer
```

ist, halte ich serverautoritativen Command-Lockstep für äußerst attraktiv.

Wenn daraus dagegen ein stark kompetitives Spiel mit:

```text
ranked ladder
esports
valuable economy
hohem Cheating-Anreiz
```

werden soll, würde ich sehr genau prüfen, ob eine serverautoritative State-Replication beziehungsweise ein Hybrid die Mehrkosten wert ist.

---

# 39. Bandbreitenvergleich

Ein grobes Gedankenexperiment zeigt den Unterschied.

Angenommen:

```text
1000 Units
10 State Updates/s
12 Byte relevanter Delta-State pro Unit
```

Dann entstehen bereits ungefähr:

```text
1000 × 10 × 12
= 120,000 Byte/s
≈ 117 KiB/s
≈ 0.96 Mbit/s
```

pro Client — bevor Protokolloverhead, zusätzliche Properties, Projektile usw. berücksichtigt werden.

Das liegt interessanterweise ungefähr in der Größenordnung, auf die Planetary Annihilation 2013 für große Late-Game-Szenarien zielte: etwa 1 Mbit/s pro verbundenem Client.

Beim Command-Modell kann dagegen beispielsweise:

```text
10 Commands/s
×
40 Byte
=
400 Byte/s
```

reichen.

Natürlich gibt es zusätzliche:

```text
ACK
Hashes
Keepalives
Chat
```

aber die Größenordnung bleibt fundamental anders.

---

# 40. Mobile verändert die Architektur erheblich

Im Gegensatz zur Pathfinding-Frage verändert Mobile die Networking-Anforderungen durchaus.

Du musst häufiger mit Folgendem rechnen:

```text
hoher Jitter
kurze Packet-Loss-Bursts
Wi-Fi ↔ Cellular
CGNAT
App Backgrounding
kurze Verbindungsausfälle
wechselnde Bandbreite
```

Android behandelt Netzwerkwechsel ausdrücklich als normalen Anwendungsfall und stellt entsprechende Connectivity Callbacks zur Verfügung.

Darum würde ich **kein Full-Mesh-P2P** für ein neues Mobile-Spiel einsetzen.

Factorios Erfahrung mit NAT und P2P-Komplexität ist hier ausgesprochen lehrreich.

Clients sollten nur kennen:

```text
Match Server Endpoint
```

und niemals gegenseitig voneinander abhängig sein.

---

# 41. Network Migration

Die Session sollte nicht an:

```text
IP + Port
```

gebunden sein.

Sondern an:

```text
sessionId
playerId
connectionId
resumeToken
```

Dadurch kann:

```text
old socket dies
```

und:

```text
new socket authenticates
```

ohne den Player aus dem Match zu entfernen.

QUIC bietet diesen Mechanismus teilweise bereits auf Transportebene über Connection IDs und Path Validation.

---

# 42. App Backgrounding

Wenn der Benutzer beispielsweise 8 Sekunden aus dem Spiel wechselt:

```text
Client simulation stops
Server continues
```

Beim Zurückkehren:

```text
clientTick = 12000
serverTick = 12160
```

Dann muss der Client entscheiden:

```text
160 ticks behind
```

Bei 20 Hz:

```text
8 Sekunden
```

Wenn seine Hardware die Simulation beispielsweise temporär mit:

```text
4× realtime
```

ausführen kann:

```text
80 SimulationTicks/s
```

kann er innerhalb weniger Sekunden wieder aufholen.

Bei längerer Abwesenheit:

```text
neuen Checkpoint laden
```

statt Tausende Ticks nachzusimulieren.

---

# 43. Slow Clients dürfen den Server nicht bremsen

Das ist eine zentrale Abweichung von traditionellem Supreme-Commander-Lockstep.

Der Server läuft:

```text
20 ticks/s
```

Client schafft nur:

```text
16 ticks/s
```

Dann wächst:

```text
serverTick - clientTick
```

kontinuierlich.

Nach einem Schwellwert:

```text
Client enters catch-up mode
```

Rendering kann beispielsweise auf:

```text
30 FPS
```

reduziert werden und Simulationsbudget steigen.

Schafft der Client es dauerhaft nicht:

```text
disconnect:
CLIENT_TOO_SLOW
```

aber:

```text
Server und andere Spieler laufen weiter.
```

Factorio implementierte später ebenfalls, dass ein zu langsamer Client den Server nicht mehr grundsätzlich stoppen muss.

---

# 44. Headless Server

Der Match-Server sollte exakt dieselbe Simulation verwenden wie der Client:

```text
GameSimulation library
```

aber ohne:

```text
Renderer
Audio
UI
Particles
Animation
```

Architektur:

```text
libGameSimulation
    entities
    commands
    combat
    pathfinding
    economy
    AI
    RNG

GameClient
    libGameSimulation
    renderer
    audio
    UI

GameServer
    libGameSimulation
    networking
    persistence
```

Damit vermeidest du zwei unterschiedliche Gameplay-Implementierungen.

---

# 45. AI kann serverseitig Commands erzeugen

Bots müssen nicht zwingend ihre komplette AI auf jedem Client ausführen.

Eine attraktive Variante:

```text
Server AI
    ↓
produces normal commands
    ↓
authoritative command stream
```

Beispielsweise:

```text
AI Player 7:
Move army 12 to X
Build Tank Factory
Attack Player 2
```

Diese Commands werden genauso verarbeitet wie Spielercommands.

Dadurch bleibt:

```text
world simulation deterministic
```

während komplexere strategische AI nur auf dem Server laufen muss.

---

# 46. Pathfinding: zwei Möglichkeiten

Hier verbindet sich die Multiplayer-Frage direkt mit unserer ersten Recherche.

## Möglichkeit A

Pathfinding ist vollständig deterministisch.

Dann reicht:

```text
Move(UnitSet, destination)
```

und alle Simulationen berechnen identische Paths.

Das ist die sauberste Lockstep-Lösung.

## Möglichkeit B

Der Server berechnet den Path.

Dann müsste er beispielsweise übertragen:

```text
Path 927:
Portal 12
Portal 54
Portal 80
...
```

oder zumindest relevante Corridor-Entscheidungen.

Das reduziert die Determinismusanforderungen an Pathfinding, erhöht aber Protokollkomplexität.

Für deine Architektur würde ich A bevorzugen.

---

# 47. Async Pathfinding muss trotzdem deterministisch committen

Du kannst Paths parallel berechnen.

Aber nicht:

```text
PathRequest A finishes first
→ applied

PathRequest B finishes first next device
→ applied first there
```

Besser:

```text
requests:
ID 100
ID 101
ID 102

workers calculate independently

end of tick:
results sorted by RequestId

commit:
100
101
102
```

Damit bleibt Worker-Timing irrelevant.

---

# 48. Spectators

Mit Checkpoints und Command Log fällt auch Spectating fast automatisch ab.

Spectator:

```text
1. bekommt Checkpoint Tick 5000
2. bekommt Command Stream 5001...
3. simuliert bis Tick 5100
4. schaut Match
```

Für Competitive Matches kann der Stream bewusst beispielsweise:

```text
120 Sekunden verzögert
```

werden.

Replay und Spectator sind damit Varianten derselben Infrastruktur.

---

# 49. Server Crash Recovery

Ein echter dedizierter Multiplayer-Service sollte auch Match-Server-Ausfälle überleben können.

Dafür könnten Checkpoints periodisch außerhalb des Match-Prozesses persistiert werden:

```text
Tick 20000 checkpoint
Command log 20001–20482
```

Ersatzserver:

```text
load checkpoint
replay commands
resume tick 20483
```

Für ein erstes Release muss das nicht zwingend vollständig automatisiert sein.

Aber dieselbe Checkpoint-Infrastruktur für Reconnect macht es später überhaupt erst möglich.

---

# 50. Monitoring

Netcode sollte von Beginn an messbar sein.

Pro Client würde ich mindestens sammeln:

```text
RTT
RTT p95
RTT p99
jitter
packet loss
burst loss
packets/s
bytes/s

clientTick
serverTick
tickLag

commandLead
lateCommands
resends
duplicateCommands

simulationMs/tick
catchupRate

hashMismatchCount

snapshotBytes
snapshotLoadTime
reconnectTime
```

AoE betonte bereits sehr stark, wie wichtig kontinuierliche, menschenlesbare Netzwerkmetriken während Entwicklung und Testing waren.

---

# 51. Network Simulation gehört direkt in den Development Build

Du brauchst einen eingebauten Network Emulator:

```text
Latency:
0–1000 ms

Jitter:
0–300 ms

Loss:
0–30 %

Duplication:
0–10 %

Reordering:
0–20 %

Bandwidth:
32 kbit/s – unlimited

Disconnect:
0–60 seconds
```

Dann Szenarien:

```text
80 ms stable

120 ms ±40 ms

250 ms ±150 ms

2 % random loss

10 % burst loss

Wi-Fi → disconnect 2 sec → cellular

client freezes 5 sec

server packet disappears

duplicate command packet

packet arrives out of order
```

AoE hatte dafür mehrere separate Testprogramme und testete schlechte Netzbedingungen bewusst während der Entwicklung.

---

# 52. Noch wichtiger: Determinism Test Harness

Ich würde zusätzlich einen Modus bauen:

```text
Simulation A
Simulation B

same initial state
same commands

for every tick:
    simulate A
    simulate B

    assert(hashA == hashB)
```

Dann absichtlich variieren:

```text
Thread scheduling
Allocator layout
Rendering FPS
Command packet grouping
CPU architecture
Debug/Release build
```

In CI idealerweise:

```text
x86-64 Linux server
ARM64 Android
ARM64 iOS
```

mit demselben Replay.

Wenn Tick 58.917 divergiert:

```text
CI FAIL
```

Das dürfte langfristig eines deiner wertvollsten Testsysteme werden.

---

# 53. Besonders gefährliche Determinismusquellen

| Fehlerquelle                    | Typisches Resultat                  |
| ------------------------------- | ----------------------------------- |
| float math                      | langsam wachsender Positions-Desync |
| unordered_map iteration         | unterschiedliches Targeting         |
| parallel completion order       | unterschiedliche Eventreihenfolge   |
| global RNG                      | später komplett andere Simulation   |
| Systemzeit                      | sofortiger Desync                   |
| pointer address ordering        | plattformabhängiges Verhalten       |
| A* tie handling                 | unterschiedliche Paths              |
| Collision pair order            | unterschiedliche Positionen         |
| unterschiedliche Datenversionen | permanenter Desync                  |
| nicht deterministische Scripts  | schwer reproduzierbare Fehler       |
| clientseitige Simulation-Cheats | Hash mismatch                       |
| async dynamic-nav commit        | Pathfinding-Desync                  |

---

# 54. Desync Recovery

Bei einem Hash-Mismatch würde ich das Match nicht sofort abbrechen.

Stattdessen:

```text
Client detects mismatch
        │
        ▼
pause local advancement
        │
        ▼
request authoritative snapshot
        │
        ▼
load server checkpoint/current snapshot
        │
        ▼
apply command tail
        │
        ▼
resume
```

Zusätzlich:

```text
upload diagnostic report
```

bestehend aus:

```text
last 500 commands
hash history
subsystem hashes
client build
server build
RNG states
relevant entity dumps
```

Factorio macht bei Desyncs etwas Ähnliches und speichert sowohl Client- als auch Server-State zur Analyse.

---

# 55. Command Idempotency

Bei Retransmission darf ein Command niemals doppelt ausgeführt werden.

Deshalb:

```text
(playerId, sequence)
```

muss eindeutig sein.

Server:

```cpp
if (sequence <= lastAcceptedSequence)
    ignoreOrCheckDuplicate();
```

Ein erneut gesendetes:

```text
BuildFactory sequence=982
```

darf niemals eine zweite Factory erzeugen.

---

# 56. Security des Netzwerkprotokolls

Jedes eingehende Feld muss als feindlich betrachtet werden.

Beispielsweise:

```text
numUnits = 4,294,967,295
```

darf keine riesige Allocation erzeugen.

Ebenso:

```text
invalid UnitId
oversized packet
invalid enum
future tick overflow
old tick
duplicate sequence
invalid string length
```

OpenRA musste beispielsweise explizit mit malformed Orders umgehen, die andernfalls andere Clients zum Absturz bringen konnten.

Der Match-Server sollte daher alle Clientdaten streng parsen und begrenzen.

---

# 57. Mein konkreter Netzwerkstack

Für dein RTS würde ich technisch ungefähr folgendes Zielbild verwenden:

```text
────────────────────────────────────
         MATCHMAKING / BACKEND
────────────────────────────────────

Login
Matchmaking
Player profile
Server allocation

               │
               ▼

────────────────────────────────────
          MATCH SERVER
────────────────────────────────────

Transport
   │
   ├─ authentication
   ├─ encryption
   ├─ reconnect
   └─ reliability

Command Sequencer
   │
   ├─ validate
   ├─ deduplicate
   ├─ assign tick
   └─ canonical ordering

Simulation @20 Hz
   │
   ├─ movement
   ├─ deterministic pathfinding
   ├─ combat
   ├─ economy
   ├─ AI
   └─ fog

State Integrity
   │
   ├─ world hash
   ├─ subsystem hashes
   └─ desync report

Persistence
   │
   ├─ command log
   ├─ replay
   └─ checkpoints

               │
               ▼

────────────────────────────────────
             CLIENT
────────────────────────────────────

Transport
       │
Command Buffer
       │
Simulation @20 Hz
       │
       ├───────────────┐
       │               │
       ▼               ▼
Render State      Latency State
       │               │
       └───────┬───────┘
               ▼
            Renderer
          @60/90/120Hz
```

---

# 58. Ausgangswerte, mit denen ich anfangen würde

Für einen ersten belastbaren Multiplayer-Build würde ich ungefähr folgende Parameter testen:

| Parameter             |                       Ausgangswert |
| --------------------- | ---------------------------------: |
| Simulation            |                              20 Hz |
| Render                |              unabhängig, 30–120 Hz |
| Fixed Tick            |                              50 ms |
| normaler Command Lead |                          2–4 Ticks |
| Hash-Intervall        |                           20 Ticks |
| Checkpoint            |                        alle 5–10 s |
| Replay Commands       |                     gesamtes Match |
| Reconnect Grace       |                            30–60 s |
| Gameplay UDP Payload  |                       ≤ ca. 1200 B |
| Entity IDs            |                             32 Bit |
| Tick Counter          |                  mindestens 32 Bit |
| Command Sequence      |                             32 Bit |
| World Hash            |                    64 oder 128 Bit |
| Position              |              Fixed Point / Integer |
| RNG                   | deterministisch, getrennte Streams |

Diese Werte sind Startpunkte zum Messen, keine Spielgenre-Konstanten.

---

# 59. Wann ich stattdessen reine State Replication wählen würde

Ich würde das Lockstep-Konzept verwerfen, wenn sich während der Entwicklung herausstellt, dass:

```text
max Unit Count relativ klein
```

ist und gleichzeitig:

```text
Fog-of-War-Sicherheit extrem wichtig
```

oder:

```text
Determinismus wegen verwendeter Engine/Physics praktisch nicht erreichbar
```

ist.

Bei beispielsweise wenigen hundert relativ einfachen Entities kann ein guter:

```text
authoritative server
+
delta compression
+
interest management
+
interpolation
```

vollkommen ausreichend sein.

Planetary Annihilation zeigt sogar, dass eine entsprechend spezialisierte State-Replication-Architektur auf sehr große RTS-Szenarien skalieren kann. Dabei wurden Eigenschaften separat als Kurven übertragen, sodass unveränderte Eigenschaften keinen Traffic erzeugten.

---

# 60. Was ich ausdrücklich nicht bauen würde

Für ein neues Mobile-RTS würde ich vermeiden:

```text
Full-Mesh P2P
```

wegen NAT, Mobilfunk und Disconnect-Komplexität.

Ebenso:

```text
Unit Transform Replication
für jede Unit jeden Tick
```

wenn große Armeen vorgesehen sind.

Ebenso:

```text
Client-authoritative Gameplay
```

wegen Cheating.

Und:

```text
Netzwerk erst am Ende des Projekts hinzufügen
```

weil Determinismus deine gesamte Simulation betrifft.

Die AoE-Entwickler beschrieben ausdrücklich, dass Entwickler lernen mussten, jeden Gameplay-Code unter der Annahme zu schreiben, dass alle Rechner denselben Codepfad ausführen müssen.

---

# 61. Die wichtigste Verbindung zur Wegfindung

Nach der vorherigen Recherche ergibt sich jetzt eine zusätzliche Anforderung.

Wenn du diese Multiplayer-Architektur verwendest, muss deine Wegfindung nicht nur:

```text
robust
```

sondern zusätzlich:

```text
deterministisch
```

sein.

Das betrifft:

```text
A*
Flow Fields
Steering
Collision
Arrival Slots
Group Movement
Deadlock Resolution
Path Replanning
Spatial Queries
```

Ein einziger unterschiedlicher Collision Pair kann:

```text
Unit A um 1/256 verschieben
```

und 20 Sekunden später:

```text
andere Schussreichweite
anderes Target
anderer Schaden
andere Unit stirbt
andere Formation
anderes Pathfinding
```

verursachen.

Das macht Navigation plötzlich zu einem Teil deines Netzwerkprotokolls — obwohl du keinen einzigen Pfad über das Netzwerk sendest.

---

# 62. Architekturregel: Simulation vs. Presentation

Ich würde diese Grenze extrem streng halten:

```text
SIMULATION
────────────────

Unit position
Unit velocity
health
weapons
target
path
resources
AI
collision
RNG
cooldowns


PRESENTATION
────────────────

animation
particle effects
camera
screen shake
sound
UI
floating numbers
selection circles
interpolation
```

Der untere Bereich darf niemals Rückwirkungen auf den oberen haben.

Also niemals:

```cpp
if (animationFinished)
    fireWeapon();
```

sondern:

```cpp
if (weaponCooldownTick == 0)
{
    simulationFire();
    presentationPlayFireAnimation();
}
```

Das ist sowohl für Networking als auch für Replay, Testing und Serverbetrieb entscheidend.

---

# 63. Das robusteste Gesamtmodell

Die wesentliche Architektur lässt sich damit auf drei Datenarten reduzieren.

```text
1. COMMANDS

Player intentions:
Move
Attack
Build
Stop
Ability


2. SIMULATION STATE

deterministically generated:
positions
health
economy
combat
navigation


3. PRESENTATION STATE

derived locally:
animations
effects
interpolation
UI
```

Über das normale Multiplayer-Netzwerk laufen hauptsächlich:

```text
COMMANDS
```

und nur ausnahmsweise:

```text
SIMULATION STATE
```

für:

```text
initial join
reconnect
desync recovery
spectator join
server recovery
```

Das ist aus meiner Sicht der entscheidende Designpunkt.

---

# 64. Fazit

Aus den untersuchten RTS-Engines ergibt sich ein sehr konsistentes Bild.

Age of Empires zeigt die ursprüngliche Motivation: Bei Hunderten oder Tausenden Entities ist es wesentlich effizienter, Spielerbefehle zu synchronisieren als den vollständigen Weltzustand. Das Spiel arbeitete dafür bereits mit zukünftigen Execution Turns, UDP-Retransmission, Speed Control und umfangreichen Checksums.

Command & Conquer: Generals bestätigt dieses Modell sehr konkret im veröffentlichten Source: framebezogene Command-Pakete, RunAhead, Frame Buffers, Retransmission und Logic CRCs; die eigentliche Simulation wartet auf vollständige Frame-Daten.

Supreme Commander zeigt die notwendige Trennung zwischen einer niedriger getakteten deterministischen Gameplay-Simulation und einer wesentlich schneller laufenden Darstellung.

Blizzard bestätigt für StarCraft II die deterministische Simulation, den festen GameLoop und das Input-basierte Replay-System.

Factorio zeigt die moderne Weiterentwicklung, die ich für dein Mobile-Spiel besonders interessant finde: **Deterministic Lockstep muss nicht P2P bedeuten.** Ein zentraler Server kann Commands autoritativ ordnen und verteilen, während alle Teilnehmer weiterhin dieselbe Simulation ausführen. Dadurch lassen sich NAT-Probleme, Lag-Spikes und langsame Clients wesentlich besser isolieren.

Planetary Annihilation zeigt gleichzeitig die Alternative: Wenn Determinismus oder Hidden-State-Sicherheit wichtiger werden, kann auch ein serverautoritativer State-Replication-Ansatz für ein großes RTS funktionieren, sofern die Replikation sehr gezielt und delta-/keyframeorientiert entworfen wird.

Für dein konkretes Mobile-RTS würde ich daher als technische Default-Architektur nehmen:

```text
DEDICATED AUTHORITATIVE SERVER
            +
DETERMINISTIC FIXED-TICK SIMULATION
            +
SERVER-SEQUENCED COMMAND STREAM
            +
LOCAL CLIENT SIMULATION
            +
20 HZ GAMEPLAY / INDEPENDENT RENDERING
            +
SMALL FUTURE INPUT WINDOW
            +
LATENCY HIDING ON PRESENTATION LEVEL
            +
PERIODIC STATE HASHES
            +
CHECKPOINT + COMMAND-LOG RECONNECT
            +
QUIC OR RELIABLE-UDP TRANSPORT
```

Die wichtigste konzeptionelle Aussage lautet dabei:

> **Synchronisiere in einem RTS möglichst die Ursache einer Zustandsänderung, nicht jede Zustandsänderung selbst.**

Ein Panzer soll über das Netzwerk normalerweise nicht zwanzigmal pro Sekunde mitteilen, wo er steht. Das Netzwerk sollte einmal mitteilen:

```text
Tick 8120:
Panzergruppe 41 bekommt den Befehl,
sich zu Position X zu bewegen.
```

Alles Weitere sollte — sofern du dich für das deterministische Modell entscheidest — aus derselben Simulation entstehen.

Und genau daraus folgt auch die wichtigste technische Konsequenz für deine aktuelle Entwicklung: **Determinismus ist dann kein späteres Multiplayer-Feature, sondern eine Eigenschaft, die Pathfinding, Combat, AI, Physics, RNG, Entity-Verwaltung und selbst Datenstrukturen von Anfang an prägen muss.**
