**Der wichtigste Architekturpunkt: Wegsuche, lokales Ausweichen und Zielpositionierung getrennt behandeln.** Ein gültiger Pfad bedeutet noch lange nicht, dass eine ganze Armee vernünftig läuft und ankommt. 

## Bewährte Ansätze und typische Fallstricke

| Bereich                                  | Übliche Implementierungsstrategie                                                                                                                                                                          | Worauf du achten solltest                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grundlegende Wegsuche**                | **A*** auf einem Raster oder NavMesh. Für große Karten hierarchisch suchen: erst Regionen, dann den konkreten Weg darin.                                                                                   | Unerreichbare Ziele früh über zusammenhängende Gebiete erkennen, statt die gesamte Karte erfolglos abzusuchen.                                                                                |
| **Viele Einheiten mit gemeinsamem Ziel** | **Flow Fields:** Eine gemeinsam genutzte Richtungskarte statt eines individuellen Pfades pro Einheit. Größere Felder in Teilbereiche zerlegen und wiederverwenden.                                         | Besonders für gemeinsame Ziele geeignet; **keine automatische Lösung für Kollisionen oder Aufstellung**. ([howtorts.github.io][1])                                                            |
| **Ausweichen und Engstellen**            | Bewegliche Einheiten durch lokale Steuerung behandeln, beispielsweise **RVO** für gegenseitiges Ausweichen. Vorfahrt beziehungsweise Prioritäten vorsehen.                                                 | Gegenverkehr und symmetrische Situationen können trotzdem festhängen. Deshalb zusätzlich Stillstand erkennen und gezielt neu planen oder ausweichen lassen. ([Godot Engine documentation][2]) |
| **Ankommen und Formationen**             | Individuelle **Zielslots** statt derselben Zielkoordinate vergeben. Einheiten und Slots beispielsweise räumlich sortiert zuordnen. Formationen an Engstellen auflockern.                                   | „Jeder nimmt den nächsten freien Platz“ erzeugt teilweise kreuzende Laufwege. Starre Formationen behindern das Durchqueren schmaler Passagen.                                                 |
| **Kampfpositionierung**                  | Mögliche Positionen zunächst nach Erreichbarkeit, Schusslinie und erforderlichem Abstand filtern, anschließend bewerten. Bereits vergebene Positionen reservieren.                                         | Nicht ständig zum minimal besseren Platz wechseln: Die bisherige Position behalten, solange sie gut genug ist. Das verhindert hektisches Hin-und-her-Laufen.                                  |
| **Gebäude und Einheitengrößen**          | Bei Neubauten nur betroffene Navigationsbereiche aktualisieren. Unterschiedliche Bewegungsarten und benötigte Durchgangsbreiten berücksichtigen; Hindernisse rechnerisch um den Einheitenradius erweitern. | Ein Weg für Infanterie ist nicht automatisch für einen Panzer passierbar. Veraltete Navigationsdaten schicken Einheiten durch neue Gebäude.                                                   |
| **Performance und Bewegungsruhe**        | Neuberechnungen ereignisgesteuert auslösen und Arbeit pro Tick begrenzen. Ankunft mit einer Abstandstoleranz erkennen.                                                                                     | Nicht für jede Einheit in jedem Frame neu suchen. Zu häufige Pfadwechsel und zu kleine Toleranzen verursachen auch Zittern und Zurücklaufen.                                                  |

## Was Entwickler besonders unterschätzen

**Das Zusammenspiel, nicht nur den Suchalgorithmus.** Elijah Emerson beschreibt im Entwicklungsbericht zu *Supreme Commander 2*, wie kollidierende Einzelpfade entweder Stillstand oder kostspielige Neuberechnungskaskaden verursachten. Das war ein wesentlicher Anlass für den Wechsel zu Flow Fields. 

**Meine Empfehlung für den Einstieg:** A* beziehungsweise Engine-Navigation, lokale Vermeidung und separate Zielslots. Flow Fields und hierarchische Suche anhand gemessener Engpässe ergänzen.

Als frühe Härtetests würde ich Gegenverkehr auf einer schmalen Brücke, unerreichbare Ziele, Gebäudebau in laufende Routen und gemischte Einheitengrößen verwenden – jeweils mit deiner geplanten maximalen Einheitenzahl.

[1]: https://howtorts.github.io/2014/01/04/basic-flow-fields.html "How to RTS: Basic Flow Fields"
[2]: https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_using_navigationagents.html "Using NavigationAgents — Godot Engine (stable) documentation in English"


## Wichtigste Erkenntnis

**Wegfindung, Ausweichen und Positionierung sind drei unterschiedliche Aufgaben.** Ein korrekter A*-Pfad verhindert weder Staus noch Gedränge am Ziel. Genau diese Trennung betont auch der Entwicklerbericht zu *Age of Empires*. ([gamedeveloper.com][1])

## Übliche Implementierungsstrategien

| Aufgabe                          | Bewährter Ansatz                                                                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route finden**                 | **A*** auf einem Grid oder Navmesh. Das Grid beschreibt begehbare Zellen, das Navmesh begehbare Flächen. Einheiten folgen anschließend den Wegpunkten. ([redblobgames.com][2])                                                                        |
| **Anderen Einheiten ausweichen** | Eine separate lokale Bewegungslogik, beispielsweise **RVO**, passt Geschwindigkeiten zur Kollisionsvermeidung an. Sie ersetzt weder die globale Wegfindung noch die Kollision mit der Spielwelt. ([Godot Engine documentation][3])                    |
| **Gruppe positionieren**         | **Individuelle Zielplätze („Slots“)** vergeben, statt alle zum gleichen Punkt zu schicken. Bei der Zuordnung Weglänge und gegenseitige Behinderung berücksichtigen. Formationen an Engstellen auflösen und dahinter neu bilden. ([Game Developer][4]) |

**Für größere Dimensionen:** Flow Fields berechnen eine gemeinsame Richtungsinformation für viele Einheiten mit demselben Ziel. Bei vielen unterschiedlichen Zielen ist dieser Vorteil weniger ausgeprägt. Hierarchische Wegfindung vereinfacht dagegen große Karten durch Regionen. *Factorio* beschreibt beispielsweise, wie lange Umwege um Seen eine zusätzliche abstrakte Suche notwendig machten. **Beides sind Optimierungen, keine automatischen Lösungen für Gedränge.** ([redblobgames.com][5])

## Typische Fallstricke – und Gegenmaßnahmen

| Fallstrick                                        | Was du früh berücksichtigen solltest                                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Einheiten bleiben an Ecken hängen**             | Bereits die Wegfindung muss den **Einheitenradius** berücksichtigen. Ein für einen Punkt gültiger Weg ist nicht unbedingt breit genug für einen Panzer. Bei Navmeshes werden begehbare Flächen dafür von Hindernissen zurückgesetzt. ([Godot Engine documentation][6])     |
| **Einheiten zittern oder laufen hin und her**     | Nicht jeden Frame neu planen. Ausweichentscheidungen kurzzeitig beibehalten und eine sinnvolle Ankunftstoleranz verwenden. *Age of Empires* berichtet ausdrücklich von Bewegungsschleifen durch Entscheidungen ohne Gedächtnis über mehrere Updates. ([Game Developer][1]) |
| **Stau und gegenseitiges Blockieren**             | Klare Vorfahrtsregeln, Warten und gegebenenfalls Wegschieben vorsehen. Reines Ausweichen löst nicht jeden Konflikt. Früh entscheiden, wie viel Überlappung erlaubt ist – besonders im Nahkampf. ([Game Developer][1])                                                      |
| **Neue Gebäude machen Wege ungültig**             | Änderungen müssen die Navigationsdaten erreichen; betroffene Wege müssen geprüft beziehungsweise neu geplant werden. Bewegliche Einheiten dagegen nicht pauschal wie dauerhaftes Gelände behandeln. ([Factorio][7])                                                        |
| **Unerreichbare Ziele kosten viel Rechenzeit**    | Zusammenhängende begehbare Gebiete markieren, um unmögliche Suchen früh abzulehnen. „Kein Weg“ muss ein regulärer Ergebniszustand sein. ([redblobgames.com][2])                                                                                                            |
| **Mit wenigen Einheiten gut, mit vielen langsam** | Nachbarschaftsprüfungen räumlich begrenzen, statt jede Einheit mit jeder zu vergleichen. Neuberechnungen vermeiden, solange der bestehende Weg beziehungsweise Ausweichplan brauchbar bleibt. ([Game Developer][1])                                                        |

**Meine Empfehlung für deinen Einstieg:** A* + lokale Ausweichlogik + individuelle Zielplätze. Für Kampfpositionen würde ich zusätzlich freie Plätze nach Erreichbarkeit, Waffenreichweite und Sichtlinie bewerten, statt einfach zur Gegnerposition zu laufen.

**Frühester sinnvoller Stresstest:** Zwei Gruppen durch eine schmale Passage, unterschiedlich große Einheiten, ein nachträglich blockierter Weg und ein bereits voll besetztes Zielgebiet. Dazu Pfade, Kollisionsradien und Zielplätze als Debug-Overlay anzeigen.

[1]: https://www.gamedeveloper.com/programming/coordinated-unit-movement "Coordinated Unit Movement"
[2]: https://www.redblobgames.com/pathfinding/a-star/implementation.html "Implementation of A*"
[3]: https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_using_navigationagents.html "Using NavigationAgents — Godot Engine (stable) documentation in English"
[4]: https://www.gamedeveloper.com/programming/implementing-coordinated-movement "Implementing Coordinated Movement"
[5]: https://www.redblobgames.com/pathfinding/tower-defense/ "Flow Field Pathfinding for Tower Defense"
[6]: https://docs.godotengine.org/en/stable/classes/class_navigationmesh.html "NavigationMesh — Godot Engine (stable) documentation in English"
[7]: https://factorio.com/blog/post/fff-317 "Friday Facts #317 - New pathfinding algorithm | Factorio"
