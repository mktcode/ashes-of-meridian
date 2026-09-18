# Technischer Bericht: robuste Wegfindung für ein RTS

Die zentrale Erkenntnis aus der Recherche ist: Ein robustes RTS braucht nicht „einen besseren Pathfinding-Algorithmus“. Es braucht eine komplette Navigation-Pipeline.

Genau das ist auch die interessante Lehre aus StarCraft II. Blizzard behandelte Navigation in einem eigenen GDC-Vortrag mit dem bezeichnenden Titel „AI Navigation: It's Not a Solved Problem – Yet“. Für StarCraft II wird die Architektur als drei getrennte Stufen beschrieben:

**Planning → Steering → Collision**

A* löst damit nur einen Teil des Problems. Die typischen Fehlerbilder „Einheit bleibt hängen“, „Einheiten zittern“, „zwei Einheiten blockieren sich gegenseitig“, „Gruppe kommt am Ziel nicht zur Ruhe“ oder „Einheit läuft merkwürdige Bögen“ entstehen sehr häufig gar nicht im eigentlichen A*. ([GDC Vault][1])

Das ist für dein RTS die wichtigste Designentscheidung: Wegfindung sollte als eigenes Subsystem mit klar getrennten Verantwortlichkeiten entworfen werden.

---

## 1. Was „funktionierende Wegfindung“ in einem RTS überhaupt bedeutet

Bei einem klassischen Single-Agent-Problem ist Pathfinding relativ sauber definiert:

> Finde einen kollisionsfreien Weg von A nach B.

Bei einem RTS ist das falsche Problem.

Das tatsächliche Problem lautet eher:

> Bewege gleichzeitig N Einheiten mit unterschiedlichen Radien, Geschwindigkeiten und Bewegungsregeln durch eine teilweise dynamische Welt zu einem semantischen Zielgebiet, ohne Kollisionen, Deadlocks, störende Oszillationen oder sichtbare Fehlentscheidungen, und halte dabei ein hartes CPU-Budget ein.

Dabei verändern sich während der Bewegung:

* andere Einheiten,
* Formationen,
* Gebäude,
* Engstellen,
* Ziele,
* Kampfzustände,
* Bewegungsgeschwindigkeiten,
* Prioritäten,
* eventuell Terrain oder Brücken.

Außerdem ist „am Ziel angekommen“ nicht trivial. Wenn 30 Einheiten denselben Punkt als Ziel erhalten, können physikalisch nicht 30 Einheiten diesen Punkt besetzen.

Das ist einer der häufigsten konzeptionellen Fehler in RTS-Navigation.

---

# 2. Was Blizzard bei StarCraft II gemacht hat

Die öffentlich zugängliche GDC-Seite bestätigt den Vortrag von Blizzard-Engineer James Anhalt auf der GDC 2011. Eine detaillierte Zusammenfassung des StarCraft-II-Teils beschreibt die Navigation als Planning, Steering und Collision. ([GDC Vault][1])

### Planning

StarCraft II verwendet demnach einen triangulierten Navigationsraum, genauer eine constrained Delaunay triangulation, auf der mit A* gesucht wird; anschließend wird der resultierende Korridor mit einem Funnel-Verfahren verarbeitet. Bewegliche Einheiten werden dabei nicht einfach als globale Hindernisse in jeden A*-Search eingebaut. ([Game Development Stack Exchange][2])

Das ist ein wichtiger Punkt.

Wenn 500 Einheiten sich bewegen und jede Einheit jede andere Einheit als Hindernis für A* betrachtet, entsteht ein katastrophales Rückkopplungsproblem:

Einheit A blockiert B → B replanned → C bewegt sich → neuer Replan → A bewegt sich wieder → Pfad wieder ungültig.

Der globale Planner sollte daher überwiegend die **Topologie der Welt** beantworten:

> Durch welche Regionen/Korridore muss ich grundsätzlich?

Nicht:

> Wo stehen in diesem exakten Moment alle anderen Soldaten?

---

### Steering

Der überraschend interessante Teil ist, dass laut der Zusammenfassung des Blizzard-Vortrags gerade das Steering sehr viel Entwicklungsarbeit erforderte.

Genannt werden unter anderem:

Following, Flocking, Grouping, Separation, Avoidance und Arrival.

Besonders aufwendig war Avoidance. Ein explizit genanntes Problem ist der klassische „hallway dance“: Zwei entgegenkommende Einheiten entscheiden unabhängig, nach links auszuweichen, korrigieren beide, wechseln dann beide nach rechts usw. Deshalb wurde auch die **Steering-Absicht der anderen Einheit** berücksichtigt. ([Game Development Stack Exchange][2])

Das ist ein sehr wertvolles Detail.

Viele RTS-Implementierungen berechnen ungefähr:

```text
desiredVelocity =
    directionToWaypoint
  + separationForce
  + obstacleAvoidance
```

Mathematisch sieht das vernünftig aus. Praktisch erzeugt es aber instabile Feedback-Loops.

Was fehlt, ist **zeitliche Konsistenz**.

Wenn eine Einheit entschieden hat:

> „An diesem Hindernis gehe ich links vorbei.“

sollte sie diese Entscheidung für kurze Zeit beibehalten, sofern nichts Wesentliches dagegen spricht.

Sonst bekommt man:

```text
links
rechts
links
rechts
links
rechts
```

und visuell zitternde Einheiten.

---

### Arrival

Noch wichtiger: Beim Erreichen des Ziels bekommt laut der Zusammenfassung nicht jede StarCraft-II-Einheit einfach denselben Endpunkt. Einheiten erhalten individuelle Zielpositionen; zwei Einheiten sollen nicht denselben finalen Platz beanspruchen. ([Game Development Stack Exchange][2])

Das ist aus meiner Sicht eine der wichtigsten Anforderungen für dein System.

Ein Befehl

```text
move(selection, position)
```

sollte intern daher nicht bedeuten:

```text
for unit:
    unit.destination = position
```

sondern eher:

```text
MoveOrder
    targetRegion
    groupCorridor
    arrivalLayout

Unit 1 -> slot A
Unit 2 -> slot B
Unit 3 -> slot C
...
```

Das allein eliminiert eine große Klasse von Staus und „Twitching“ am Ziel.

---

### Collision

StarCraft II trennt außerdem Steering von tatsächlicher Kollisionsauflösung. Mobile Einheiten werden vereinfacht als Kreise behandelt. Freundliche untätige Einheiten können teilweise zur Seite gedrückt werden; Hold-Position- oder kämpfende Einheiten folgen anderen Regeln. Die Collision-Simulation selbst besitzt Grenzen, damit sie nicht unkontrolliert CPU verbraucht. ([Game Development Stack Exchange][2])

Das ist ebenfalls ein wichtiges Architekturprinzip:

**Collision Avoidance darf nicht die letzte Garantie sein.**

Steering versucht Kollisionen zu verhindern.

Collision Resolution löst die verbleibenden Fälle auf.

Sonst kann ein mathematisch kleiner Steering-Fehler zu einem permanenten Deadlock werden.

---

# 3. Command & Conquer: überraschend interessant

Bei Command & Conquer können wir inzwischen sogar den Originalcode untersuchen, weil EA den Code der Remastered Collection veröffentlicht hat.

Der Pathfinding-Code des ursprünglichen C&C von 1995 dokumentiert seinen Algorithmus ungewöhnlich klar:

Er versucht zunächst eine direkte Line-of-Sight-Linie zum Ziel. Trifft diese auf ein unpassierbares Gebiet, folgt der Algorithmus der Hinderniskante. Das geschieht sowohl im Uhrzeigersinn als auch gegen den Uhrzeigersinn; anschließend wird der kürzere Umweg verwendet. ([GitHub][3])

Sinngemäß arbeitet der Algorithmus:

```text
Versuche gerade zum Ziel zu laufen.

Hindernis?
    Suche auf beiden Seiten einen Weg darum herum.
    Wähle den kürzeren.
    Fahre von dort wieder direkt Richtung Ziel.

Wiederholen.
```

Das ist konzeptionell weit simpler als modernes A* + NavMesh + Crowd Steering.

Aber darin steckt eine relevante Lektion: Das System versucht ständig, den **einfachsten verständlichen Weg** wiederherzustellen.

Außerdem enthält der Code explizite Mechanismen gegen Schleifen und Sonderfälle sowie Begrenzungen der erzeugten Bewegungskommandos. Schon die Kommentare von 1995 zeigen, dass Pathfinding keineswegs nur aus „finde den kürzesten Pfad“ bestand. ([GitHub][3])

Für ein modernes RTS würde ich diesen Algorithmus nicht übernehmen. Als Designlektion ist er aber wertvoll:

> Ein robuster Fallback ist oft wichtiger als algorithmische Eleganz.

---

# 4. Command & Conquer: Generals ist wesentlich moderner

Noch interessanter ist der inzwischen ebenfalls veröffentlichte Code von Command & Conquer: Generals / Zero Hour.

Dort erkennt man deutlich eine zusätzliche Ebene für **Group Pathfinding**. Im Code existieren unter anderem Parameter für:

* Mindestanzahl Infanteristen für Gruppenbewegung,
* Mindestanzahl Fahrzeuge,
* Mindestbewegungsdistanz,
* Gruppendichte,
* Pfadbreite für Infanterie,
* Pfadbreite für Fahrzeuge. ([GitHub][4])

Insbesondere `InfantryPathfindDiameter` und `VehiclePathfindDiameter` sind interessant.

Das System fragt also nicht lediglich:

> Kann eine Einheit hier durch?

sondern kann für Gruppen einen Korridor mit einer bestimmten benötigten Breite berücksichtigen. ([GitHub][4])

Das ist für RTS extrem sinnvoll.

Ein theoretisch passierbarer 1,5-Meter-Durchgang kann für einen einzelnen Infanteristen ein guter Weg sein und für 30 Panzer eine katastrophale Route.

Generals besitzt außerdem explizite Pfadoptimierung. Der Code sucht entlang eines gefundenen Paths nach möglichst weit entfernten Nodes, zu denen direkte Line-of-Sight-Passierbarkeit besteht, und überspringt damit unnötige Zwischenpunkte. Die Ground-Path-Variante berücksichtigt dabei auch eine `pathDiameter`-Breite. ([GitHub][5])

Und der Path-Follower besitzt eine weitere wichtige Eigenschaft: Entfernt sich eine Einheit vom geplanten Weg, wird nicht stumpf immer der nächste ursprüngliche Waypoint angesteuert. Je weiter die Einheit vom Pfad abkommt, desto stärker verschiebt sich ihr Bewegungsziel Richtung nächstgelegener Projektion auf den Path. ([GitHub][5])

Das verhindert viele merkwürdige Situationen dieser Art:

```text
       waypoint
          X
         /
        /
 unit X
     |
     | eigentlich sinnvoller Weg
```

Ein naiver Follower versucht immer wieder, zum alten Waypoint zurückzukehren. Ein guter Follower fragt stattdessen:

> Wo sollte ich sinnvoll wieder in meinen Korridor einsteigen?

---

# 5. Age of Empires II: mehrere Pathfinder statt eines Universalalgorithmus

Auch Ensemble Studios ist hier sehr aufschlussreich.

Bei Age of Empires II stellte das Team fest, dass der allgemeine Pathfinding-Algorithmus aus Age of Empires unter den neuen Anforderungen nicht mehr genügte. Größere Maps und mehr Einheiten änderten das Performanceprofil.

Statt den einen Algorithmus immer weiter zu optimieren, verwendete AoE II unterschiedliche Systeme für unterschiedliche Probleme: unter anderem schnelle Bewegung über große Entfernungen, präzisere Navigation auf kurze Distanz und zusätzlich einen Unit-Obstruction-Manager für Kollisionsfragen. 

Genau das bestätigt wieder:

> Long-range planning und short-range movement sind unterschiedliche Probleme.

Noch interessanter für dein Mobile-Ziel: Ensemble begrenzte explizit die Zahl der Pathfinding-Versuche pro Unit und Update. In Playtests waren fünf oder mehr zu teuer für die minimale Hardware, zwei führten zu unbefriedigendem Verhalten; AoE II landete deshalb bei drei Versuchen. Das ist keine magische Zahl für heutige Spiele, sondern ein gutes Beispiel für ein **festes CPU-Budget statt unkontrollierter Berechnung**. 

Ein weiterer Fund ist fast noch lehrreicher: Der Obstruction Manager nutzte einen Quadtree, war aber überraschend teuer, weil viele Einheiten genau auf Tile-Grenzen lagen und dadurch in höheren Baumebenen landeten. Eine vergleichsweise kleine Änderung brachte laut Ensemble rund 300 % Performanceverbesserung. 

Die Lehre daraus:

**Pathfinding optimiert man anhand realer Laufzeitdaten, nicht allein anhand asymptotischer Komplexität.**

---

# 6. Supreme Commander 2: der andere große Ansatz

Supreme Commander 2 ist für ein RTS mit vielen Einheiten besonders relevant.

Gas Powered Games hatte mit klassischen Individualpfaden genau das Problem, das du beschreibst: Einheiten liefen auf festen A*-Pfaden, kollidierten miteinander und blieben stehen. Replanning bei jeder Kollision war ebenfalls keine Lösung, weil ein neuer Pfad unmittelbar zur nächsten Kollision führen konnte. Der Entwickler Elijah Emerson beschreibt sogar, dass Spieler ihre Einheiten dadurch ständig „babysitten“ und erneut anklicken mussten. 

Die Lösung war ein tiled **Flow-Field-System**.

Die Welt wird in Sektoren aufgeteilt. Ein Sektor enthält:

```text
Cost Field
    ↓
Integration Field
    ↓
Flow Field
```

Das Cost Field beschreibt Traversierungskosten.

Das Integration Field beschreibt ungefähr die Kosten bis zum Ziel.

Das Flow Field speichert an jeder Zelle die bevorzugte Bewegungsrichtung.

Supreme Commander 2 verwendete 10×10-Sektoren und einen darüberliegenden Portalgraphen. Zunächst läuft A* nur über diesen gröberen Portalgraphen. Anschließend werden für die benötigten Bereiche Flow Fields erzeugt. Mehrere Einheiten können dieselben Ergebnisse gemeinsam verwenden. 

Damit geht man von:

```text
500 Einheiten
×
500 eigene lange Pfade
```

eher zu:

```text
1 gemeinsamer grober Korridor
+
gemeinsam verwendete Richtungsfelder
+
lokales Steering pro Einheit
```

über.

Das skaliert bei großen Verbänden erheblich besser.

Das Kapitel beschreibt die Methode explizit als Lösung für Hunderte bis Tausende Agenten. 

---

## 7. Flow Fields sind aber nicht automatisch die Antwort

Flow Fields haben große Vorteile, wenn viele Einheiten dasselbe oder ähnliche Ziele haben.

Sie lösen aber nicht automatisch:

* Unit-vs-Unit-Kollisionen,
* Arrival,
* Formationsslots,
* Deadlocks,
* Prioritätsregeln,
* unterschiedliche Radien,
* Gegenverkehr in Engstellen.

Auch Supreme Commander kombiniert die Felder daher mit Steering und Physics. Einheiten können sich gegenseitig verschieben und an Wänden entlanggleiten. 

Interessant ist außerdem die Behandlung dynamischer Karten.

Verändert sich ein Gebäude oder eine Wand, wird nicht die komplette Navigation neu erzeugt. Betroffene Sektoren und Portale werden als dirty markiert. Nur der relevante Teil des Graphen und die davon betroffenen Pfade werden rekonstruiert. Diese Arbeit wird über eine Prioritätswarteschlange in feste Zeitbudgets aufgeteilt. 

Das ist fast exakt die Architektur, die ich für ein Mobile-RTS ebenfalls verwenden würde.

---

# 8. Die fundamentalen Fehlerklassen

Wenn ein RTS heute Einheiten besitzt, die regelmäßig „komisch“ reagieren, würde ich die Fehler nicht zuerst im A*-Code suchen. Ich würde sie in folgende Kategorien einteilen.

| Symptom                                                 | Typische eigentliche Ursache                                  |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| Einheit findet keinen vorhandenen Weg                   | falsche Topologie, Clearance/Radiustest, veralteter Nav-State |
| Einheit hängt an Ecke                                   | Pfad gilt für Punkt statt für Unit-Radius; Corner Cutting     |
| Zwei Einheiten zittern voreinander                      | symmetrisches Avoidance ohne Hysterese                        |
| Gruppe verstopft Chokepoint                             | individueller Planner versteht Gruppenbreite nicht            |
| Einheiten verklumpen am Ziel                            | alle erhalten denselben Zielpunkt                             |
| Einheit dreht kurz vor Ziel Kreise                      | Arrival Radius / Overshoot / Velocity Control                 |
| Einheit will ständig zum alten Waypoint zurück          | schlechter Path Follower                                      |
| Einheiten bleiben hinter stehenden Freunden             | keine Push-/Priority-Regeln                                   |
| Tausende Replans                                        | bewegliche Units im globalen Obstacle Graph                   |
| Einheit läuft riesigen Umweg                            | falsche Abstraktion oder überhöhte dynamische Costs           |
| Formation zerreißt vollständig                          | individuelle globale Paths statt Gruppenroute                 |
| Einheit läuft durch Engstelle, bleibt dann stecken      | Pathfinder und Collision verwenden unterschiedliche Radien    |
| Performance-Spike nach Move-Command                     | jede Unit startet synchron einen vollständigen Search         |
| Pfad funktioniert vor Gebäudebau, danach nicht          | inkorrekte/incomplete Nav-Invalidierung                       |
| Einheiten wechseln ständig die Seite eines Hindernisses | keine persistente Passage-/Steering-Entscheidung              |

Das Entscheidende ist, diese Fehlerklassen im Code ebenfalls getrennt sichtbar zu machen.

---

# 9. Meine Zielarchitektur für dein RTS

Ich würde die Navigation in sieben Schichten aufteilen.

### 9.1 Static Navigation Topology

Die unterste Schicht kennt ausschließlich grundsätzlich begehbare Weltgeometrie.

Sie sollte liefern können:

```text
isTraversable(position, movementClass)
clearance(position)
connectedComponent(position, movementClass)
```

Zusätzlich würde ich pro Zelle oder Nav-Region eine **Clearance** speichern: Wie weit ist das nächste unpassierbare Terrain entfernt?

Damit kann dieselbe Navigation für unterschiedliche Unit-Radien verwendet werden:

```text
passable =
    clearance >= unit.radius + safetyMargin
```

Das verhindert, dass der Planner Wege erzeugt, durch die die Unit physikalisch überhaupt nicht passt.

Supreme Commander 2 löste dasselbe Grundproblem über unterschiedliche Movement Types und eine künstliche Ausweitung von Wänden für große Einheiten, wodurch zu kleine Lücken automatisch geschlossen wurden. 

---

### 9.2 Connectivity / Islands

Noch bevor irgendein A* läuft:

```text
if island(start) != island(destination):
    noPath
```

Supreme Commander 2 verwendete genau solche Island IDs. Damit ließ sich sofort erkennen, ob Start und Ziel überhaupt verbunden waren; selbst die UI konnte entsprechend anzeigen, dass ein Ziel nicht erreichbar war. 

Das ist für Mobile besonders interessant.

Bei einem Touch auf einen unerreichbaren Bereich brauchst du nicht erst:

```text
A* -> 80.000 nodes -> failed
```

sondern vielleicht:

```text
integer comparison -> failed
```

---

### 9.3 Global Planner

Der Global Planner sollte ausschließlich beantworten:

> Durch welchen groben Korridor komme ich zum Ziel?

Für ein gridbasiertes RTS wäre meine bevorzugte Lösung:

**hierarchischer Grid-Graph / HPA*-ähnliche Struktur.**

HPA* abstrahiert eine große Map in Cluster und Übergänge. Der ursprüngliche HPA*-Paper beschreibt erhebliche Reduktionen des Suchaufwands; die gefundenen Routen lagen in den dortigen Experimenten sehr nahe am Optimum. ([Webdocs][6])

Wenn deine Maps dagegen sehr freie, polygonale Geometrie besitzen, ist ein NavMesh wie bei StarCraft II attraktiver.

Für ein klassisches RTS mit platzierbaren Gebäuden, rasterartigem Terrain und Mobile-Zielplattform würde ich allerdings einen hierarchischen Grid-/Portalgraphen wahrscheinlich bevorzugen:

* einfacher deterministisch zu halten,
* einfacher partiell zu invalidieren,
* einfache Clearance Maps,
* einfache Building Stamps,
* günstige Speicherlayouts,
* einfache Flow Fields,
* gute Debugbarkeit.

---

### 9.4 Path Corridor statt Waypoint-Liste

Ein häufiger Architekturfehler besteht darin, einen Pfad nur als

```text
P0, P1, P2, P3, P4
```

zu verstehen.

Besser ist:

```text
Region A
 -> Portal 1
 -> Region B
 -> Portal 2
 -> Region C
 -> Destination Area
```

Die Einheit darf sich innerhalb dieses Korridors frei bewegen.

Das ist entscheidend, weil Local Avoidance die Einheit zwangsläufig vom mathematisch idealen Pfad abweichen lässt.

Der globale Pfad sollte also eher eine **Leitplanke** als eine Schiene sein.

Genau das sieht man sowohl bei NavMesh/Funnel-Ansätzen als auch bei Supreme Commanders Portal-/Flow-System und beim Path-Follower von Generals. ([Game Development Stack Exchange][2])

---

# 10. Local Steering: hier entscheidet sich die wahrgenommene Qualität

Pro Simulation Tick bekommt die Unit zunächst eine Preferred Velocity:

```text
vPreferred = directionAlongCorridor * preferredSpeed
```

Anschließend wird diese aufgrund lokaler Umgebung angepasst:

```text
vFinal =
    pathFollowing
  + unitAvoidance
  + wallAvoidance
  + separation
  + formationInfluence
  + arrivalInfluence
```

Ich würde aber ausdrücklich **nicht** einfach beliebig gewichtete Steering Forces addieren.

Das führt schnell zu instabilen Systemen.

Besser ist eine Priorisierung:

```text
1. nicht in statische Wand laufen
2. unmittelbar bevorstehende Unit Collision vermeiden
3. im gültigen Corridor bleiben
4. Formation bevorzugen
5. Zielrichtung bevorzugen
```

Eine sicherheitskritische Constraint sollte nicht dadurch aufgehoben werden können, dass drei andere Steering-Vektoren zufällig in Gegenrichtung zeigen.

---

# 11. ORCA/RVO: interessant, aber nicht als Komplettlösung

Ein moderner Ansatz für Multi-Agent Collision Avoidance ist ORCA, Optimal Reciprocal Collision Avoidance.

Dabei übernehmen zwei kollidierende Agenten mathematisch jeweils einen Teil der Verantwortung für die Kollisionsvermeidung. Die Autoren zeigen das Verfahren auch für sehr große Agentenmengen. ([Gamma Web][7])

ORCA kann als Grundlage für Local Avoidance sehr interessant sein.

Für ein RTS würde ich es aber nicht ungeändert als vollständiges Bewegungssystem einsetzen.

Denn ein RTS hat asymmetrische Regeln:

```text
Tank > Infantry
moving > idle
retreating > formation preference
Hold Position = immovable
attacking unit perhaps harder to push
large unit > small unit
```

Das sind keine rein geometrischen Regeln.

StarCraft II macht genau solche gameplayabhängigen Unterschiede bei der Kollisionsauflösung. ([Game Development Stack Exchange][2])

Darum ist ein RTS-spezifischer Priority-/Push-Layer weiterhin notwendig.

---

# 12. Der unterschätzte Schlüssel: Deadlock Detection

Selbst mit hervorragendem Steering würde ich **niemals davon ausgehen, dass Local Avoidance garantiert Fortschritt macht**.

Jede bewegte Unit sollte einen Liveness-Watchdog besitzen.

Beispielsweise:

```text
lastProgressDistance
lastProgressTime
stuckLevel
```

Fortschritt sollte nicht einfach anhand der Geschwindigkeit gemessen werden.

Eine Einheit kann sich hektisch bewegen und trotzdem keinen Fortschritt machen.

Sinnvoller ist etwa:

```text
progress =
    previousDistanceAlongPath
  - currentDistanceAlongPath
```

oder die Verringerung der verbleibenden Corridor-Distanz.

Wenn eine Einheit über eine gewisse Zeit keinen signifikanten Fortschritt macht, sollte die Recovery eskalieren:

1. lokale Avoidance neu bewerten,
2. Passage-Seite wechseln,
3. Push-Priorität erhöhen,
4. Arrival Slot neu vergeben,
5. lokalen Umweg berechnen,
6. globalen Corridor neu berechnen,
7. Ziel auf nächstgelegene erreichbare Position korrigieren.

Wichtig ist die Eskalation.

Nicht:

```text
if stuck:
    AStarAgain()
```

jede Sekunde.

Das produziert Replan Storms.

---

# 13. Hysterese gegen „komisches Verhalten“

Navigation benötigt Gedächtnis.

Einheiten sollten sich beispielsweise merken:

```text
obstacleSide = LEFT
obstacleSideUntil = t + ...
```

oder:

```text
yieldingTo = unit42
passSide = RIGHT
```

Solange kein starker Grund für eine Änderung besteht, bleibt diese Entscheidung bestehen.

Dasselbe gilt für:

* Formation Slot,
* Chokepoint Lane,
* Overtake Side,
* Arrival Slot,
* Local Detour,
* Unit Priority.

Das ist eine allgemeine Regel:

> Ein etwas suboptimaler, aber konsistenter Pfad sieht intelligenter aus als ein mathematisch ständig neu optimierter Pfad.

StarCraft IIs expliziter Umgang mit dem „hallway dance“ ist ein konkretes Beispiel dieses Problems. ([Game Development Stack Exchange][2])

---

# 14. Zielbehandlung: nicht „Point“, sondern „Goal Region“

Für dein RTS würde ich einen Move-Befehl niemals intern als exakten Punkt modellieren.

Sondern als:

```text
Goal {
    center
    acceptableRadius
    facing?
    formation?
    tacticalRange?
}
```

Einzelne Units erhalten anschließend Slots innerhalb dieser Region.

Bei 40 ausgewählten Units entstehen also beispielsweise 40 erreichbare Zielpositionen um den Touch-Punkt herum.

Das hat mehrere positive Effekte gleichzeitig:

* keine identischen Zielpunkte,
* weniger gegenseitiges Wegdrücken,
* weniger Replanning,
* bessere Formationen,
* geringere Präzisionsanforderung an Touch-Steuerung,
* natürliches Arrival.

Für Attack-Move oder Angriff auf ein Objekt kann das noch besser werden.

Dann ist nicht die Position des Gegners das Ziel, sondern beispielsweise:

```text
distance(target, unit) <= weaponRangeOptimal
AND
lineOfFireAvailable
```

Der eigentliche Navigationsendpunkt ist also eine Menge gültiger Positionen.

---

# 15. Gruppenbewegung sollte wirklich Gruppenbewegung sein

Ein typisches schlechtes RTS macht:

```text
for each selectedUnit:
    path = AStar(unit.position, clickPosition)
```

Damit erhältst du 100 individuelle Lösungen für dasselbe semantische Problem.

Außerdem wählen Units eventuell verschiedene Engstellen und kreuzen sich gegenseitig.

Besser:

```text
MoveGroup
    members
    destinationRegion
    sharedRoute
    formation
    slots
```

Der Gruppe gehört zunächst ein gemeinsamer Corridor.

Die Units folgen diesem Corridor mit individuellen lokalen Bewegungen.

Erst wenn ein Mitglied deutlich vom Corridor getrennt wird, braucht es eventuell eine eigene Rejoin-Route.

Generals besitzt explizite Group-Pathfinding-Parameter und sogar unterschiedliche Gruppenkorridorbreiten für Infanterie und Fahrzeuge. Supreme Commander 2 versucht über „merging A*“ und wiederverwendete Flow Fields ebenfalls, mehrere Quellen gemeinsam auf eine Route zum selben Ziel zu bringen. ([GitHub][4])

---

# 16. Chokepoints brauchen Sonderbehandlung

Chokepoints sind der Härtetest jedes RTS.

Angenommen:

```text
<<<<<<<<
<<<<<<<<
    ||
    ||
>>>>>>>>
>>>>>>>>
```

Zwei Armeen wollen gleichzeitig durch eine schmale Passage.

Eine rein lokale Collision-Avoidance kann dort mathematisch in eine Pattsituation geraten.

Deshalb würde ich wichtige Portale implizit als Ressourcen behandeln.

Der globale Corridor weiß bereits:

```text
Portal P:
    width = 4.3 m
```

Daraus können lokale Regeln entstehen:

```text
capacity ≈ portalWidth / typicalUnitDiameter
```

Bei starker Belegung kann die Bewegung vor dem Portal organisiert werden, statt alle Units gleichzeitig in den Eingang zu drücken.

Man muss daraus kein komplexes Reservierungssystem wie bei Multi-Agent Path Finding bauen. Schon ein lokales „queue / yield / lane“-Konzept kann massiv helfen.

---

# 17. Einheitengröße muss Teil der Navigation sein

Eine der schlimmsten Fehlerquellen ist:

```text
A* sagt: passierbar
Physics sagt: passt nicht
```

Das darf architektonisch nicht möglich sein.

Path Planner und Collision System müssen dieselbe Vorstellung vom effektiven Unit-Radius haben.

Für jede Unit beziehungsweise Movement Class brauchst du:

```text
navigationRadius
physicalRadius
personalSpaceRadius
```

Die müssen nicht identisch sein.

Beispielsweise:

```text
physicalRadius   = 0.45
navigationRadius = 0.50
avoidanceRadius  = 0.75
```

Aber ihre Beziehung muss bewusst definiert sein.

Supreme Commander 2 vergrößerte Hindernisse für große Unit-Klassen künstlich, um zu schmale Durchgänge bereits aus deren Navigation zu entfernen. Generals berücksichtigt beim Ground-Path-Check eine Pfadbreite. 

---

# 18. Dynamische Hindernisse: Gebäude und Units sind nicht dasselbe

Ich würde drei Kategorien unterscheiden.

**Static:** Terrain, Cliff, Wasser, feste Wände.

Diese gehören vollständig in die globale Navigation.

**Semi-static:** Gebäude, zerstörbare Wände, Brücken.

Diese ändern den Nav-Graph, aber selten. Sie sollten betroffene Chunks/Cluster dirty markieren.

**Dynamic:** Units.

Diese sollten normalerweise **nicht** den globalen Graph permanent verändern.

Sie gehören primär in:

```text
local occupancy
steering
collision
congestion
```

Erst wenn eine dynamische Blockade länger besteht, kann sie indirekt in den globalen Planner einfließen, zum Beispiel über temporäre Congestion Costs.

Supreme Commander 2 verwendete für Gebäudeveränderungen genau ein Dirty-System auf Sektor-/Portalebene und budgetierte die Rebuild-Arbeit über mehrere Updates. 

---

# 19. Path Smoothing ist nicht kosmetisch

Grid-A* produziert häufig:

```text
↗ → → ↘ → ↗
```

obwohl tatsächlich:

```text
────────────>
```

möglich wäre.

Generals optimiert deshalb Pfade explizit durch Line-of-Sight-Tests und überspringt unnötige Nodes. StarCraft II verwendet nach dem NavMesh-Planning einen Funnel-artigen Ansatz. ([GitHub][5])

Wichtig ist aber:

Der Smoothing-Test muss den Unit-Radius berücksichtigen.

Ein einfacher Point-RayCast erzeugt sonst:

```text
#############
        /
       /
      O
#############
```

wobei die Mittellinie frei ist, der Unit-Kreis aber an der Ecke kollidiert.

Du brauchst daher eher einen:

```text
swept circle / capsule traversal test
```

als einen reinen Raycast.

---

# 20. Mobile verändert das Problem doch etwas

Algorithmisch hast du recht: Die fundamentale Navigationsaufgabe ist dieselbe.

Architektonisch verschiebt Mobile aber einige Prioritäten deutlich.

### CPU-Spikes sind problematischer

Wenn der Spieler 80 Units selektiert und auf die andere Seite der Map tippt, dürfen nicht im selben Frame 80 große Searches entstehen.

Stattdessen:

```text
1 Group Request
 -> global route
 -> shared corridor
 -> local per-unit work
```

oder bei großen Verbänden:

```text
shared flow fields
```

Die Arbeit sollte außerdem über mehrere Simulation-Ticks budgetierbar sein.

Genau dieses Prinzip findet man sowohl bei AoE II als auch bei Supreme Commander 2: CPU-Arbeit wird explizit begrenzt beziehungsweise über Zeit verteilt. 

---

### Speicherbandbreite zählt

Auf Mobile ist nicht nur Big-O interessant.

Ein Cache-freundliches:

```cpp
uint8_t cost[N];
uint16_t integration[N];
uint8_t direction[N];
```

kann besser sein als große objektorientierte Graphstrukturen mit Zeigern:

```cpp
Node {
    Vector3 position;
    vector<Edge*>
    ...
}
```

Flow Fields, Clearance Maps und Uniform Spatial Hashes passen deshalb grundsätzlich gut zu Mobile.

---

### Touch-Ziele sind unpräzise

Desktop:

```text
Mouse cursor = sehr genauer World Point
```

Mobile:

```text
Finger = relativ große Fläche
```

Deshalb ist ein Goal Region Modell auf Mobile sogar noch wertvoller.

Der Finger definiert die **Absicht**, nicht notwendigerweise den millimetergenauen Endpunkt.

Das System darf intelligent eine erreichbare Position in der Umgebung wählen.

---

### Das UI sollte Unreachability früh erkennen

Supreme Commander 2 konnte anhand seiner Island IDs bereits vor dem eigentlichen Movement erkennen, dass ein Ziel nicht erreichbar ist. 

Für Touch-Steuerung würde ich das besonders konsequent umsetzen.

Ein Tap in Wasser mit reinen Ground Units sollte nicht:

```text
tap
...
units twitch
...
nothing happens
```

erzeugen.

Der Command Resolver sollte unmittelbar entscheiden:

```text
exact target unreachable
nearest suitable reachable target = ...
```

oder den Befehl eindeutig ablehnen.

---

# 21. Spatial Queries: nicht jede Unit gegen jede Unit

Bei 500 Einheiten sind naive Nachbarschaftstests:

```text
500 × 500
```

unnötig.

Für Unit-Steering würde ich einen Uniform Spatial Hash / Grid verwenden.

Pro Unit:

```text
query cells overlapping avoidanceRadius
```

und nur die dort liegenden Units berücksichtigen.

Für typische RTS-Karten ist ein Uniform Grid oft sinnvoller und vorhersehbarer als komplexere Raumstrukturen.

AoE IIs Quadtree-Erfahrung zeigt zudem sehr schön, dass eine theoretisch elegante Datenstruktur wegen der tatsächlichen Datenverteilung überraschend schlecht performen kann. 

---

# 22. Determinismus

Falls dein RTS Multiplayer mit deterministischer Simulation / Lockstep verwenden soll, gehört Determinismus von Anfang an in diese Architektur.

Problematisch sind unter anderem:

```text
unordered iteration
unstable sorting
equal-cost A* ties
floating-point divergence
parallel race ordering
physics resolution order
```

Beispielsweise müssen zwei gleichwertige A*-Nodes immer deterministisch ausgewählt werden:

```text
fCost
then hCost
then stableNodeId
```

Dasselbe gilt für Collision Pairs.

Auf heterogener Mobile-Hardware ist das besonders relevant, wenn mehrere Geräte tatsächlich dieselbe Simulation reproduzieren sollen.

---

# 23. Flow Field oder normales Pathfinding?

Für dein Spiel würde ich das nicht dogmatisch entscheiden.

Wenn normalerweise nur 10–100 Units gleichzeitig unterwegs sind:

```text
Hierarchical A*
+ shared group corridor
+ local steering
```

dürfte einfacher und völlig ausreichend sein.

Wenn regelmäßig mehrere Hundert Einheiten gemeinsam über größere Karten bewegt werden:

```text
Portal Graph
+ tiled Flow Fields
+ Steering
```

wird zunehmend attraktiv.

Supreme Commander 2 ist genau für diesen zweiten Fall gebaut worden und beschreibt die Technik explizit für Hunderte bis Tausende Agenten. 

Ich würde Flow Fields deshalb nicht als Ersatz für A* sehen.

Sondern:

```text
Hierarchical A*       = Welche Regionen?
Flow Field / Corridor = Wie durch die Region?
Steering              = Wie jetzt gerade bewegen?
Collision             = Was, wenn es trotzdem kracht?
```

---

# 24. Die Architektur, die ich tatsächlich implementieren würde

Für ein neues Mobile-RTS würde mein Navigationsstack ungefähr so aussehen:

```text
                    PLAYER COMMAND
                          │
                          ▼
                   Command Resolver
                  "Was meint der Tap?"
                          │
                          ▼
                Goal Region / Formation
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
         Connectivity Test      Arrival Slots
          / Island IDs
                │
                ▼
             Group Planner
       Hierarchical A* / Portals
                │
                ▼
            Path Corridor
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
 Flow Field optional   Path Follower
       │                 │
       └────────┬────────┘
                ▼
         Preferred Velocity
                │
                ▼
          Local Avoidance
     units + walls + priorities
                │
                ▼
        Collision Resolution
                │
                ▼
             Movement
                │
                ▼
         Progress Watchdog
                │
        stuck? ─┴── no ──────>
          │
         yes
          ▼
     Recovery Escalation
```

Dieser letzte Rückkopplungspfad ist entscheidend.

Navigation ist kein einmaliger Search.

Sie ist ein laufender Regelkreis.

---

# 25. Konkrete Anforderungen an das System

Ich würde die Navigation erst dann als technisch belastbar betrachten, wenn sie folgende Eigenschaften besitzt:

| Requirement                                                                      | Konsequenz                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| Jeder gültige Move endet entweder erfolgreich oder explizit als nicht erreichbar | Kein permanentes „Versuchen“                 |
| Jede bewegte Unit besitzt Progress Detection                                     | Deadlocks werden erkannt                     |
| Pathfinder berücksichtigt Unit Clearance                                         | Keine physikalisch unmöglichen Pfade         |
| Gruppen verwenden gemeinsame globale Routen                                      | Keine A*-Explosion                           |
| Jede Unit bekommt einen eigenen Arrival Slot                                     | Kein Goal Pile-up                            |
| Dynamic Units sind keine normalen globalen Obstacles                             | Keine Replan-Stürme                          |
| Local Avoidance besitzt Hysterese                                                | Kein Links-Rechts-Zittern                    |
| Collision hat Push-/Priority-Regeln                                              | Blockaden sind auflösbar                     |
| Path Follower kann auf einen Corridor zurückfinden                               | Keine alten Waypoint-Schleifen               |
| Building Changes invalidieren Navigation lokal                                   | Keine Full-Map-Rebuilds                      |
| Pathfinding besitzt ein Frame-/Tick-Budget                                       | Keine Mobile-Framedrops                      |
| Connectivity kann O(1)-artig vorgeprüft werden                                   | Unreachable Requests werden billig erkannt   |
| Alle Entscheidungen sind visualisierbar                                          | Debugging wird möglich                       |
| Search und Movement benutzen konsistente Radien                                  | Keine „A* sagt ja, Physics sagt nein“-Fehler |

---

# 26. Debugging: vermutlich der wichtigste praktische Schritt

Eine gute Navigation braucht eine sehr aggressive Debug-Visualisierung.

Für eine selektierte Unit würde ich mindestens anzeigen:

```text
● final command point
○ assigned arrival slot

════ global corridor
---- current optimized segment

→ desired velocity
→ avoidance velocity
→ actual velocity

circle: physical radius
circle: avoidance radius

neighbors considered: [...]
current island
current portal
current path id

STUCK LEVEL: 0/1/2/3
last progress: 0.42 s
replan reason: NONE
```

Zusätzlich global:

```text
path requests/frame
nodes expanded/frame
active flow tiles
dirty nav chunks
replans/sec
local avoidance queries
average neighbors/unit
stalled units
```

Blizzards SC2-Zusammenfassung erwähnt ebenfalls die Bedeutung ausführlicher Steering-Debugvisualisierung; bei einem System aus mehreren sich gegenseitig beeinflussenden Kräften ist das praktisch unverzichtbar. ([Game Development Stack Exchange][2])

Ohne diese Instrumentierung sieht ein Fehler einfach so aus:

> „Der Panzer hängt manchmal.“

Mit Instrumentierung sieht er so aus:

> „Unit 172 befindet sich seit 1,43 s 0,18 m vor Portal 54, `desiredVelocity` zeigt vorwärts, aber LocalAvoidance produziert alternierend ±78° wegen Units 170/174.“

Das ist plötzlich ein lösbares Engineering-Problem.

---

# 27. Welche Testfälle ich zwingend automatisieren würde

Pathfinding lässt sich erstaunlich gut über reproduzierbare Szenarien testen.

Meine kritischen Fälle wären unter anderem:

```text
1 Unit       -> lange freie Strecke
1 Unit       -> U-förmiges Hindernis
1 Unit       -> unerreichbares Ziel
1 große Unit -> gerade noch zu schmale Passage

50 Units -> ein Ziel
200 Units -> ein Ziel

100 Units -> schmaler Chokepoint
100 Units ↔ 100 Units -> Gegenverkehr

schnelle Units hinter langsamen Units
große Units zusammen mit kleinen Units

Formation -> breite Fläche -> enger Durchgang -> breite Fläche

Gebäude wird während Movement gebaut
Gebäude wird während Movement zerstört

Ziel bewegt sich
Ziel wird unerreichbar

Unit wird physikalisch weit vom Corridor weggeschoben

zwei identische Units frontal gegeneinander
vier Gruppen kreuzen gleichzeitig denselben Punkt
```

Diese Tests sollten nicht nur „crasht nicht“ prüfen.

Messbare Invarianten wären beispielsweise:

```text
reachable unit eventually arrives

no unit overlaps static world

no permanent oscillation

no unit remains stalled indefinitely

path computation never exceeds allocated budget

no two group members own the same exclusive arrival slot
```

Damit wird „Einheiten bleiben manchmal hängen“ von einem subjektiven QA-Problem zu einem automatisierbaren Systemtest.

---

# 28. Was ich ausdrücklich nicht machen würde

Ich würde vier verbreitete Ansätze vermeiden.

**A* pro Einheit und bei jeder Blockade neu ausführen.** Das skaliert schlecht und führt bei dynamischen Crowds zu Replan-Kaskaden.

**Alle anderen Einheiten permanent in den globalen Navigation-Graph schreiben.** Bewegliche Hindernisse gehören primär in die lokale Navigation.

**Steering nur als Summe verschiedener Forces implementieren.** Ohne Prioritäten, Persistenz und Deadlock Recovery entstehen Oszillationen.

**Alle ausgewählten Units auf exakt denselben Zielpunkt schicken.** Das erzeugt zwangsläufig Konkurrenz um denselben Raum.

Die historischen Beispiele zeigen interessanterweise alle Varianten derselben Erkenntnis: C&C besitzt lokale Umgehungs- und Recovery-Logik, AoE II trennte Pathing-Aufgaben in mehrere Systeme, StarCraft II trennt Planning/Steering/Collision, Generals besitzt Group Pathfinding, und Supreme Commander 2 geht für große Crowds zu gemeinsam nutzbaren Feldinformationen über. ([GitHub][3])

---

# 29. Was „ein für alle Mal beheben“ realistisch bedeutet

Eine mathematische Garantie, dass eine beliebige Menge dynamischer Units bei beliebigen widersprüchlichen Befehlen niemals in eine problematische Situation gerät, wirst du in einem praktischen RTS nicht erreichen.

Du kannst aber eine wichtigere Engineering-Garantie herstellen:

> **Keine Unit darf unbegrenzt in einem undefinierten Navigationszustand verbleiben.**

Also:

```text
Moving
  ↓
MakingProgress
  ↓
Arrived
```

oder:

```text
Moving
  ↓
NoProgress
  ↓
Recovery 1
  ↓
Recovery 2
  ↓
Replan
  ↓
NearestReachableGoal / ExplicitFailure
```

aber niemals:

```text
Moving
  ↓
twitch twitch twitch twitch twitch...
```

Das ist für mich die eigentliche Definition eines robusten RTS-Navigationssystems.

---

# Fazit

Aus den verschiedenen RTS-Implementierungen ergibt sich ein erstaunlich konsistentes Bild.

**StarCraft II** zeigt, dass Planning, Steering und Collision getrennte Probleme sein müssen und dass Arrival sowie gegenseitige Steering-Absichten entscheidend sind. ([Game Development Stack Exchange][2])

**Command & Conquer** zeigt schon 1995 eine pragmatische Kombination aus direktem Weg, Hindernisumgehung und Recovery; **Generals** erweitert das deutlich um Gruppenpfade, Pfadbreiten, LOS-Optimierung und robustes Zurückfinden auf bestehende Paths. ([GitHub][3])

**Age of Empires II** zeigt, dass verschiedene Entfernungsskalen und Kollisionen unterschiedliche Algorithmen benötigen und dass Pathfinding ein festes CPU-Budget braucht. 

**Supreme Commander 2** zeigt schließlich, wie man bei wirklich großen Unit-Mengen individuelle Langstreckenpfade durch Portalgraphen, gemeinsam nutzbare Flow Fields, Dirty-Regionen und budgetierte Updates ersetzt. 

Für dein Mobile-RTS wäre deshalb meine technische Zielarchitektur klar:

**hierarchische globale Navigation + gemeinsame Gruppen-Corridors + Clearance + individuelle Arrival Slots + deterministisches Local Steering + explizite Collision/Push-Regeln + Deadlock-Watchdog + lokale Replans + streng budgetierte Berechnung.**

Der entscheidende Paradigmenwechsel ist dabei: **A* soll nicht dafür sorgen, dass eine Unit ihr Ziel erreicht. A* soll nur einen brauchbaren Korridor liefern. Dass die Unit tatsächlich zuverlässig ankommt, ist Aufgabe des gesamten Movement-Systems.**

[1]: https://gdcvault.com/play/1014514/AI-Navigation-It-s-Not "GDC Vault - AI Navigation: It's Not a Solved Problem - Yet"
[2]: https://gamedev.stackexchange.com/questions/191954/how-can-i-create-the-arriving-engaging-in-combat-movement-like-in-starcraft-2 "algorithm - How can I create the arriving/ engaging in combat movement like in StarCraft 2? - Game Development Stack Exchange"
[3]: https://github.com/electronicarts/CnC_Remastered_Collection/blob/master/TIBERIANDAWN/FINDPATH.CPP "CnC_Remastered_Collection/TIBERIANDAWN/FINDPATH.CPP at master · electronicarts/CnC_Remastered_Collection · GitHub"
[4]: https://github.com/electronicarts/CnC_Generals_Zero_Hour/blob/main/GeneralsMD/Code/GameEngine/Include/GameLogic/AI.h "CnC_Generals_Zero_Hour/GeneralsMD/Code/GameEngine/Include/GameLogic/AI.h at main · electronicarts/CnC_Generals_Zero_Hour · GitHub"
[5]: https://github.com/electronicarts/CnC_Generals_Zero_Hour/blob/main/GeneralsMD/Code/GameEngine/Source/GameLogic/AI/AIPathfind.cpp "CnC_Generals_Zero_Hour/GeneralsMD/Code/GameEngine/Source/GameLogic/AI/AIPathfind.cpp at main · electronicarts/CnC_Generals_Zero_Hour · GitHub"
[6]: https://webdocs.cs.ualberta.ca/~mmueller/ps/2004/hpastar.pdf?utm_source=chatgpt.com "Near Optimal Hierarchical Path-Finding"
[7]: https://gamma-web.iacs.umd.edu/ORCA/?utm_source=chatgpt.com "Optimal Reciprocal Collision Avoidance (ORCA)"
