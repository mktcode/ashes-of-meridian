# Markus:

[https://github.com/mktcode/ashes-of-meridian](https://github.com/mktcode/ashes-of-meridian)Schau dir mal bitte dieses Repository eines browserbasierten Real-Time-Strategy-Spiel an. Analysiere den Code auf Performance-Probleme beziehungsweise identifiziere Wege, um die Performance, also die Frames pro Sekunde oder in bestimmten Situationen, zu optimieren und sei dabei bitte kreativ, think out of the box. Oder anders ausgedrückt: Was würde John Carmack tun?

# Auditer:

**Mein Befund: Die interessantesten Hebel liegen nicht bei „weniger Grafik“, sondern bei zu großen Suchräumen, globalen Invalidierungen und Arbeit, deren Ergebnis sich seit dem letzten Frame kaum verändert hat.** Besonders auffällig sind die Geländeabfragen, die Kollisionsprüfung dichter Armeen und der wiederholte Aufbau von Modelldaten.

Ich habe die zentralen Simulations-, Rendering-, Navigations- und UI-Pfade sowie eure Performance-Dokumentation am Stand **`d83d79a9` vom 11. Oktober 2026** untersucht. Zusätzlich habe ich einen isolierten Geometrietest ausgeführt. Das ist ein Code-Review mit einem überprüften Optimierungsansatz, **kein gemessener FPS-Benchmark des vollständigen Spiels auf deiner Hardware**. 

Vorweg: Instancing, feste Simulationsticks, wiederverwendbare A*-Arbeitsfelder, statisches Chunk-Culling und ein Thumbnail-Cache sind bereits vorhanden. „Nimm Instancing und Object Pooling“ wäre hier keine hilfreiche Analyse. Außerdem zielt die Renderplanung bewusst auf 60 FPS; zunächst geht es also um stabile Framezeiten und Reserven, nicht um eine höhere angezeigte Maximalzahl.    

## 1. Geländeabfragen: Ihr untersucht Flächen, obwohl ihr Linien sucht

**Fundstelle:** `src/battlefields/surface.ts`, insbesondere `ray()` und `segment()`.

Das ist für mich der interessanteste konkrete Fund.

`ray()` grenzt den Strahl zunächst anhand der Geländehöhe ein. Anschließend bildet es das X/Z-Begrenzungsrechteck dieses Strahlabschnitts und untersucht **jede Rasterzelle innerhalb dieses Rechtecks**, jeweils mit zwei Dreieckstests. Bei einem diagonalen Strahl liegen viele dieser Zellen weit neben dem tatsächlichen Strahl. 

Das bedeutet: Durchquert ein Strahl diagonal ungefähr *k* Rasterzellen je Achse, untersucht der aktuelle Ansatz größenordnungsmäßig *k²* Zellen. Eine Rastertraversierung müsste dagegen nur die tatsächlich durchquerten Zellen samt konservativer Randbehandlung besuchen.

**Mein Vorschlag:** Die Kandidatensuche durch eine DDA-/Supercover-Traversierung ersetzen und die bestehenden exakten Dreieckstests beibehalten. Nicht die Kollisionsmathematik vereinfachen, sondern ihr weniger irrelevante Kandidaten vorlegen.

Das ist besonders für gedrehte Kameras über höherem Terrain interessant. Bei einer achsenparallelen Projektion oder sehr flachem Gelände fällt der Unterschied deutlich kleiner aus. Der Picking-Pfad ruft diese Funktion über `MeridianRenderer.ground()` auf.  

### Isolierte Gegenprobe

Ich habe die Dreieckstests aus dem untersuchten Code nachgebildet und nur die Auswahl der Kandidatenzellen geändert. Die Gegenprobe verwendet synthetische Höhenfelder, deterministische Zufallsdaten sowie zusätzliche Rand-, Achsen- und Diagonalfälle.

| Messgröße | Rechtecksuche | Konservative DDA-Variante |
|---|---:|---:|
| Kandidatenzellen einer diagonalen Stressabfrage | 3.249 | 279 |
| Median der Laufzeit dieser Abfrage | 0,240 ms | 0,047 ms |
| Abweichende Treffer in 5.780 Vergleichsfällen | — | 0 |

Das sind **rund 91 % weniger Kandidaten und etwa Faktor 5,1 für diesen isolierten Rechenkern**. Gemessen unter Node 22, nicht im Browser. Die Treffer waren in allen Vergleichsfällen identisch; das ersetzt keine vollständige Korrektheitsprüfung und bedeutet ausdrücklich nicht fünfmal so viele Spiel-FPS.

Der reproduzierbare ray-probe.cjs[Testcode](sandbox:/mnt/data/aom-audit/ray-probe.cjs) und die ray-probe-results.json[Messdaten](sandbox:/mnt/data/aom-audit/ray-probe-results.json) liegen bei. Der Code ist ein Demonstrator, kein einbaufertiger Repository-Patch.

**Noch wichtiger könnte derselbe Befund bei `segment()` sein:** Dort werden ebenfalls ganze Rechtecke zwischen Start und Ziel abgesucht. Diese Funktion prüft Gelände-Clearance und wird über `terrainFree()` auch innerhalb der Navigation verwendet. Die Wegglättung in `world.ts` stellt wiederholt solche Segmentanfragen. Lange diagonale Wege können dadurch unnötig teuer werden.   

Hier wäre eine **um den Körperradius erweiterte Rastertraversierung** der Kandidat. Wichtig: Die bestehenden Tests gegen radiusvergrößerte Klippenzellen und ihre Grenzfälle müssen erhalten bleiben. Einfach nur die Mittellinie abzulaufen wäre falsch. Diese Segmentoptimierung habe ich noch nicht gegengetestet.

## 2. Dichte Armeen: Ein räumliches Problem wird wiederholt global gelöst

**Fundstelle:** `src/simulation/movement.ts`, `unitFits()`, `yieldUnitSpace()` und `move()`.

`unitFits()` durchsucht mit `entities.some()` die gesamte Entitätenliste nach kollidierenden Einheiten. `move()` kann mehrere Lenkwinkel ausprobieren; jeder Versuch landet wieder in dieser Prüfung. Scheitert das, kann `yieldUnitSpace()` zusätzliche vollständige Scans und rekursive Prüfungen auslösen.  

Das Problem ist deshalb nicht nur ein einzelner linearer Scan. Es ist ungefähr:

> bewegte Einheiten × Ausweichversuche × durchsuchte Entitäten

Dichte erhöht dabei gerade die Anzahl der Ausweichversuche. Eure Performance-Dokumentation bestätigt diesen Verstärker bereits durch eine frühere isolierte Probe: 1.953 `unitFits`-Aufrufe bei 300 dicht stehenden Infanteristen gegenüber 300 Aufrufen in verteilter Aufstellung. Das ist eine bestehende Repository-Messung, nicht mein eigener Gefechtsbenchmark. 

**Mein erster Eingriff wäre ein dedizierter, live aktualisierter Kollisionsindex**, beispielsweise ein feines Uniform Grid.

Nicht einfach den vorhandenen Kampf-Hash verwenden: Der wird nur einmal pro Tick aufgebaut. Die Bewegungsprüfung muss dagegen die Positionen berücksichtigen, die vorherige Einheiten innerhalb desselben Ticks bereits verändert haben. Der Code weist ausdrücklich auf diesen Unterschied hin.  

Der Index müsste deshalb Positionsänderungen unmittelbar übernehmen und neben aktuellen Körperpositionen auch reservierte Produktionsausgänge berücksichtigen. Boden- und Flugeinheiten lassen sich getrennt führen. Für `yieldUnitSpace()` muss die ursprüngliche Entitätenreihenfolge erhalten bleiben, weil das Verfahren Zustände verändert und Prioritäten berücksichtigt.

**Der zusätzliche Hebel:** Nicht für jeden Lenkwinkel eine neue Nachbarsuche starten. Für ein lokales Bewegungsmanöver zunächst alle möglichen Blocker in einem konservativen Bereich sammeln und diese Kandidaten für die Winkelprüfungen wiederverwenden. Die exakte Kreisprüfung bleibt unverändert.

Damit werden nicht bloß dieselben Schleifen schneller. Einheiten am anderen Ende der Karte verschwinden vollständig aus der Fragestellung.

Ich würde dafür zunächst weder das ganze Spiel auf ein ECS umstellen noch sämtliche Entitäten in Typed Arrays zerlegen. Ein kleiner, abgeleiteter Spatial Index ist der wesentlich begrenztere Eingriff.

## 3. Navigation: Ein neues Gebäude kann eine gemeinsame Neuberechnung auslösen

**Fundstellen:** `src/world.ts: rebuild()` und `src/simulation/movement.ts: move()`.

`rebuild()` aktualisiert die Belegung und erhöht die globale `pathVersion`. In `move()` führt eine abweichende Version dazu, dass `nextPath` auf null gesetzt und der Weg erneut gesucht wird. Damit kann eine lokale Belegungsänderung viele bewegte Einheiten im nächsten Tick gleichzeitig zur Wegsuche bringen — auch räumlich weit entfernte.  

Das ist ein plausibler **Lastspitzen-Auslöser**, nicht zwingend ein dauerhaft dominanter Durchschnittsverbrauch.

Ich würde zwei unterschiedlich invasive Verbesserungen unterscheiden.

**Verhaltensnah: Unveränderliche Navigationsprüfungen wiederverwenden.** Der bestehende A*-Code hat bereits einen Direktweg-Schnellpfad, einen Heap und wiederverwendbare Arbeitsfelder. Wiederholt werden aber weiterhin Terrain-Fit- und Terrain-Segmentprüfungen für Rasterknoten und Nachbarkanten ausgeführt.  

Für die tatsächlich vorkommenden Körperradien lassen sich diese unveränderlichen Ergebnisse begrenzt vorhalten: Knoten-Clearance und gerichtete Nachbarkanten. Dynamische Gebäude-/Einheitenbelegung bleibt aktuell; ebenso müssen exakte, nicht rasterzentrierte Start- und Zielsegmente separat geprüft werden. Damit kann dieselbe Suche mit denselben Gleichständen und derselben Reihenfolge weniger kosten.

**Architektonisch: Lokale statt globale Weginvalidierung.** Ein Weg könnte speichern, welche Navigationsregionen sein verbleibender Korridor berührt. Ändert sich die Belegung anderswo, bleibt er zunächst gültig.

Hier liegt allerdings eine wichtige Grenze: **„weiterhin begehbar“ ist nicht dasselbe wie „würde bei erneuter Suche wieder gewählt“.** Ein abgerissenes Gebäude kann eine kürzere Route öffnen. Auch Wiederholungsfristen und Recovery-Verhalten können sich ändern. Lokale Invalidierung ist deshalb eine bewusste Verhaltensentscheidung, nicht automatisch eine semantisch neutrale Optimierung.

Die größere RTS-Variante wäre ein gemeinsamer grober Korridor oder ein Flowfield für Gruppen mit ähnlichem Ziel, mit individuellen Formationsplätzen und lokaler Vermeidung. Das ist interessant, aber erst nach der Bereinigung der unnötigen Terrain- und Kollisionsarbeit: Sonst verdeckt ein aufwendigerer Algorithmus nur die vorhandenen Kosten.

## 4. Modelle: Die Beschreibung einmal auswerten, nicht jedes Bild neu

**Fundstellen:** `src/world-view.ts: renderEntity()` und `src/renderer/runtime.ts: begin()`, `add()`, `upload()`.

Die Mesh-Geometrie wird bereits wiederverwendet. Auch einige Modellrezepte und Geländeauflagen sind gecacht. Trotzdem leert `begin()` jedes Renderframe die dynamischen Batches; sichtbare Entitäten durchlaufen erneut ihren Modellaufbau. `add()` berechnet Transformationen und schreibt pro Modellteil **22 Floats beziehungsweise 88 Bytes**. Die veränderten Batches werden anschließend erneut hochgeladen.    

Die entscheidende Unterscheidung lautet:

> Ein Gebäude gehört zur dynamischen Spielwelt. Seine tragenden Modellteile müssen deshalb noch lange nicht dynamische Renderdaten sein.

**Mein Vorschlag wäre eine zusätzliche Trennung zwischen unveränderlichen Modellteilen und tatsächlich veränderlichen Teilen.**

Der Gebäudekörper könnte fertige Transform-/Instanzblöcke behalten. Turmrotation, Baufortschritt, Animation, Nachtakzente, Teamfarbe und andere tatsächlich veränderte Werte aktualisieren nur ihre jeweiligen Bereiche. Ein bereits vorhandener Cache lokaler Bauteilbeschreibungen spart noch nicht automatisch die anschließende Transformations- und Uploadarbeit.  

Ich würde Gebäude dafür nicht blind in die vorhandene `static`-Liste verschieben: Sichtbarkeit, Schatten, Konturpass und Lebenszyklus müssen weiter stimmen. Gemeint ist persistente Instanzhaltung, nicht „Gebäude sind ab jetzt Landschaft“.

**Die kreativere Weiterentwicklung wäre ein kleiner Modell-Compiler:** Unveränderliche lokale Teiltransformationen werden einmal erzeugt. Pro Entität ändern sich anschließend vor allem Root-Transform und wenige Animationsparameter. Der Vertexshader kombiniert Root- und Teiltransformation.

Das verschiebt Arbeit von vielen CPU-seitigen Bauteilaufrufen zu kompakteren Zustandsupdates. Der Preis sind zusätzliche Shaderarbeit und ein komplexerer Datenpfad; auf bereits vertexlimitierten Geräten könnte das die falsche Verschiebung sein.

Eine kleinere Variante ist ein gepacktes affines Transformationsformat mit zwölf statt sechzehn Matrixwerten. Bei unveränderten restlichen Attributen würde der Instanzdatensatz von 88 auf 72 Bytes sinken. **Die größere Einsparung bleibt aber der vermiedene Upload**, nicht nur dessen kleinere Verpackung. Grundlage dieser Rechnung ist das aktuelle Attributlayout. 

## 5. Nachtbeleuchtung: Erst feststellen, ob das Ergebnis überhaupt verwendet wird

**Fundstellen:** `src/renderer/shaders.ts: localLighting()` und `src/renderer/runtime.ts: preparePointLights()`.

Ein räumliches Lichtgitter ist bereits vorhanden; die feinere Unterteilung wurde laut Dokumentation schon gezielt optimiert. „Clustered Lighting einführen“ wäre daher zu unspezifisch. Ich sehe im bestehenden Verfahren aber drei konkrete Ansatzpunkte.  

**Erstens: Die Nebelmaske wird erst nach der Lichtschleife angewendet.**

`localLighting()` berechnet die lokalen Beiträge und multipliziert sie anschließend mit dem Sichtbarkeitsfaktor. Ist dieser exakt null, war die vorangegangene Lichtarbeit für dieses Fragment nutzlos. 

Ich würde den Faktor vorziehen und bei null früh aus dieser Funktion zurückkehren. Diffus- und Specular-Ausgabe müssen dabei beide korrekt null sein. Das ist ausdrücklich kein Vorschlag, den gesamten Terrainshader oder das Fragment zu verwerfen: Das Terrain hat weiterhin seine eigene Darstellung.

Innerhalb der Schleife gibt es einen weiteren Kandidaten: Bei `diffuse <= 0` tragen weder der diffuse Term noch der bereits daran gekoppelte Specular-Term bei. Dann können weitere Farbdaten und Berechnungen möglicherweise entfallen. Ob sich die zusätzlichen Branches lohnen, muss ein GPU-A/B zeigen. Für vollständig sichtbare, stark überlappende Lampen ist die frühe Nebelprüfung naturgemäß keine Lösung. 

**Zweitens: Kapazität und tatsächlich verwendete Daten werden beim Upload nicht getrennt.**

Die Lampentextur behält ihre einmal gewachsene Höhe. Anschließend lädt `preparePointLights()` die volle Breite und Höhe dieser Kapazität hoch, auch wenn momentan deutlich weniger Datensätze benötigt werden. 

Die Speicherreserve beizubehalten ist sinnvoll. Sie vollständig zu übertragen ist nicht zwingend nötig. Mein erster Versuch wäre, nur die tatsächlich belegten Zeilen zu aktualisieren; die Zellreferenzen bestimmen ohnehin, welche Einträge gelesen werden.

**Drittens: Lichtdatensätze werden für jede überlappte Rasterzelle dupliziert.**

Pro Lampen-/Zellkombination stehen zwei RGBA32F-Texel, rechnerisch 32 Bytes. Die Zuordnung verwendet das rechteckige X/Z-Begrenzungsgebiet der Einflusskugel. Eine konservative Kreis-/Zellprüfung könnte Eckzellen aussortieren, die garantiert keinen Beitrag erhalten. Die Reihenfolge innerhalb der verbleibenden Zellen sollte erhalten bleiben, damit die Gleitkomma-Summation nicht unnötig verändert wird. 

Eine weitergehende Alternative wäre eine zentrale Lampentabelle mit kompakten Zellindizes statt duplizierter Datensätze. Das spart potenziell Transfers, kostet aber eine zusätzliche Indirektion im Shader.

**Für wirklich viele gleichzeitig wirksame Lampen braucht es eine andere Darstellung.** Ein Experiment wäre, diffuse Beleuchtung statischer Siedlungslampen in einem räumlichen Lichtfeld vorzuhalten und nahe beziehungsweise spekulare Beiträge weiterhin exakt auszuwerten. Das wäre keine pixelidentische Optimierung, sondern ein gezielter Qualitäts-/Leistungskompromiss. Ich würde ihn getrennt von den obigen, deutlich weniger invasiven Änderungen behandeln.

## 6. Auswahlhänger: Den kalten Portrait-Pfad aus dem Klick entfernen

**Fundstelle:** `src/renderer/model-thumbnails.ts`.

Hier ist bereits viel richtig umgesetzt: gemeinsamer WebGL-Kontext, geteilte Meshes, Cache mit 96 Einträgen und höchstens eine kalte Aufnahme pro Frame. Unveränderte Portraits werden nicht ständig neu gerendert. 

Der kalte Pfad bleibt trotzdem beträchtlich: Modell aufbauen, Bounds ermitteln, rendern, gegebenenfalls MSAA auflösen und anschließend das WebGL-Canvas mit `CanvasRenderingContext2D.drawImage()` in ein 2D-Canvas kopieren. Dieser Übergang ist ein Kandidat für zusätzliche Kopier- oder Synchronisationskosten; aus dem Code allein ist nicht bewiesen, dass er deine konkreten Auswahlhänger verursacht. 

**Mein bevorzugter Ansatz wäre, die Aufnahme gar nicht erst im Auswahlmoment entstehen zu lassen.** Für die begrenzte Menge verwendeter Modelle bieten sich beim Build erzeugte Portraits oder ein kleines, gezielt während der Ladephase vorbereites Set an. Varianten wie Teamfarbe, Ausschnitt und Größe müssen dabei sauber abgedeckt werden; nicht pauschal alle möglichen Kombinationen vorladen.

Zusätzlich liest `update()` die Rechtecke der Kacheln, und `draw()` liest das jeweilige Rechteck erneut. Selbst der Unverändert-Pfad kommt erst nach diesen Abfragen. Hier würde ich Größen-/Sichtbarkeitsänderungen dirty-getrieben behandeln und bereits ermittelte Rechtecke weiterreichen. Mehrere Rechteckabfragen beweisen noch keinen teuren Layout-Flush, sind aber vermeidbare Arbeit. 

Bei Auswahlproblemen würde ich deshalb **kalte Erstwahl, warme Wiederwahl und Picking** getrennt betrachten — nicht automatisch Wegsuche verantwortlich machen.

## 7. Mobile Bandbreite und Autosaves: Zwei andere Arten von Frameverlust

**Mobile Rendering:** Der Renderer verwendet bei entsprechender Qualität multisampled Farb- und Tiefenpuffer. Nach dem Resolve wird nur die Farbe in das normale Szenenziel übertragen. Im untersuchten Renderablauf werden anschließend nicht mehr benötigte MSAA-Anhänge nicht explizit invalidiert.  

`invalidateFramebuffer()` nach der jeweils letzten Verwendung wäre deshalb ein gezielter Versuch. Gerade auf mobilen Tile-Renderern kann das unnötiges Zurückschreiben von Tiefen- und Multisample-Daten vermeiden. Das ist eine etablierte WebGL-Empfehlung, keine Garantie für einen konkreten Gewinn auf dem betroffenen Gerät. [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

Außerdem wird ein zusätzlicher Single-Sample-Tiefenpuffer angelegt, obwohl der normale MSAA-Resolve nur Farbe überträgt. Dessen Notwendigkeit würde ich für jeden Renderer-/Environment-Pfad prüfen. Fallbacks müssen erhalten bleiben; weiterverwendete Szenen-, Bloom- oder Schattendaten dürfen natürlich nicht verworfen werden.  

**Autosaves:** Die Architektur beschreibt synchrone Snapshotarbeit, Kompression und Gesamtserialisierung sowie einen gemeinsamen `localStorage`-Schreibvorgang. Unveränderte archivierte Snapshots werden bereits teilweise wiederverwendet; trotzdem wächst die gesamte Serialisierungs-/Schreibarbeit mit dem Archiv. 

Das ist ein eigener Typ von Problem: Ein Spiel kann zwischen Saves schnell sein und regelmäßig einen einzelnen langen Frame produzieren. `setTimeout()` verschiebt diese Arbeit nur.

Ich würde zuerst redundante Kopien und Kodierungen am sicheren Snapshot-Zeitpunkt reduzieren. Ein Worker für Kompression/Serialisierung wäre erst der nächste Schritt: Auch die Übergabe eines großen Objektgraphen kostet, und der abschließende `localStorage`-Write bleibt synchron. Ein Wechsel des Speichermodells wäre eine Architekturentscheidung und müsste insbesondere den vorhandenen gemeinsamen Speichervorgang und die Offline-Verträge erhalten.

## Was ich mit der „Carmack-Frage“ anfangen würde

Meine Interpretation wäre hier: **Zuerst die Repräsentation und die Menge der notwendigen Arbeit ändern — erst danach einzelne Operationen beschleunigen.**

Die Reihenfolge meiner technischen Prioritäten wäre:

1. **Live-Kollisionsindex plus Wiederverwendung lokaler Kandidaten**, weil das direkt auf das dokumentierte Problem dichter Armeen zielt.
2. **Terrain-Traversierung und gecachte unveränderliche Navigationsprüfungen**, weil hier konkrete unnötige Arbeit sichtbar ist und der Ray-Ansatz bereits einen positiven isolierten Test hat.
3. **Persistente Modell-/Instanzdaten**, wenn der Szenenaufbau auf Zielhardware einen relevanten Frameanteil einnimmt.

Die kleinen Lichtshader-/Uploadänderungen und das Entfernen kalter Portraitaufnahmen aus Interaktionen sind gute separat messbare Ergänzungen. Globale Weginvalidierung, Flowfields und Lichtfelder würde ich dagegen ausdrücklich als unterschiedlich weitreichende Verhaltens- beziehungsweise Darstellungsentscheidungen behandeln.

Für die Abnahme wären nicht nur FPS interessant, sondern **Kandidaten pro Kollisionsprüfung, besuchte Terrainzellen, Suchstarts pro Tick, hochgeladene Bytes sowie p95/p99 der Framezeit und Eingabelatenz**. Eure vorhandene Diagnose bietet dafür bereits eine Grundlage; die Dokumentation weist allerdings darauf hin, dass Eingabehandler außerhalb von rAF noch nicht vollständig zeitlich zugeordnet werden. 

**Mein stärkster Gesamtbefund lautet: Nicht die sichtbare Komplexität des Spiels ist überall das Problem. Mehrere Pfade berechnen ihre Relevanz noch zu grob — räumlich, zeitlich oder über globale Versionsnummern. Genau dort würde ich ansetzen, bevor Auflösung, Details oder Spielverhalten reduziert werden.**