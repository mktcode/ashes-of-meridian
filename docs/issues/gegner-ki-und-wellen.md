# Regelbasierter KI-Gegner statt Angriffswellen

## Ziel

Das Konzept periodisch direkt erzeugter Angriffswellen wird vollständig entfernt. Der Gegner soll als zweiter RTS-Akteur unter denselben Spielregeln eine Wirtschaft aufbauen, Gebäude errichten, regulär Einheiten produzieren, Fähigkeiten einsetzen, seine Basis verteidigen und selbst entscheiden, wann, womit und gegen welches bekannte Ziel er angreift.

Der erste Stand erhält genau einen KI-Regelsatz ohne einstellbaren Schwierigkeitsgrad. Er soll regelmäßig Druck erzeugen, aber keine Einheiten, Ressourcen, Sicht oder Informationen ercheaten.

## Verbindliche Designentscheidungen

- **Symmetrischer Baseline-Start:** Beide Seiten beginnen mit je einem fertigen HQ, ohne vorgebaute Türme, Produktionsgebäude oder Kampftruppen, und mit demselben regulären Ressourcen-/Worker-Bootstrap. Die dauerhaften Fleet-Upgrades des Spielers bleiben ein bewusster Progressionsvorteil und werden nicht auf die KI gespiegelt; dadurch darf ein aufgewerteter Run numerisch vom Baseline-Start abweichen.
- **Faire Sicht:** Die KI besitzt eigene erkundete und aktuell sichtbare Bereiche. Sie darf verborgene Spielerentitäten weder auswählen noch deren aktuelle Position, Armee, Queues oder Wirtschaft auslesen. Zuvor Gesehenes darf als veraltete Erinnerung gespeichert werden. Allgemeines Szenariowissen wie Kartenrand und gegnerische Startregion ist erlaubt; Navigation darf wie beim Spieler die gemeinsame Terrain-Wegsuche verwenden.
- **Regel- und Kostenparität:** Alloy, Aether, Versorgung, Bau-/Produktionszeiten, Voraussetzungen, Ausgänge, Platzierung, Reparatur, Energie, Cooldowns und fraktionsabhängige Preise/Effekte gelten für beide Teams gleich. Kein `enemyBudget`, keine halben Einheitenkosten, keine Versorgungsausnahme und keine direkten Armeespawns. Nur ausdrücklich für beide Seiten vorhandene Fähigkeiten wie Reinforcements dürfen Einheiten außerhalb einer Produktionsqueue erzeugen.
- **Keine Cheats:** Keine kostenlosen Ressourcen/Einheiten/Gebäude, beschleunigte Produktion, versteckten Werteboni, Sicht durch Fog of War, Teleportation oder illegale Platzierung. Wenn die KI wirtschaftlich oder militärisch geschlagen ist, darf sie verlieren.
- **Regelmäßiger Druck:** Angriffe folgen keinem festen Wellentimer, sollen aber durch wachsende strategische Dringlichkeit nicht dauerhaft ausbleiben. Bereits produzierte Einheiten werden gesammelt und anhand eigener Stärke, bekannter Verteidigung, aktueller Bedrohung und vergangener Wartezeit eingesetzt.
- **Strategische Ziele:** Gesehene Worker, Raffinerien, Depots und Produktionsgebäude sind sinnvolle Angriffsziele; das HQ bleibt Siegziel, ist aber nicht automatisch das einzige Ziel jedes Angriffs. Zielwert, Erreichbarkeit, Verteidigungsrisiko und Aktualität der Information sind zu berücksichtigen.
- **Eine Schwierigkeit:** Zunächst keine Auswahl und kein Profilfeld für Schwierigkeit. Entscheidungsintervalle, Mindestarmeen, Reserven und Dringlichkeit bleiben an einer klaren Stelle abstimmbar, ohne vorsorglich ein allgemeines Schwierigkeitssystem einzuführen.

## Heutiger Zustand, der ersetzt werden soll

Aktuell ist nur die lokale Einheitenautomatik nennenswert ausgebaut: Beide Teams verwenden Wegfindung, Abstand/Ausweichen, Zielerfassung, Waffenlogik, Artillerie-Mindestreichweite und Medic-Heilung. Gegnerische Starttruppen bewachen feste Punkte.

Die strategische Steuerung besteht dagegen aus `wave()` in `src/simulation/runtime.ts`:

- erste Welle nach 95 Sekunden, danach fest berechnete Intervalle und Größen;
- zufällige Zusammensetzung aus festen Schwellwerten;
- direkte Spawns nahe dem gegnerischen HQ mit `attackMove` zum Spieler-HQ;
- künstliches Start-/Passivbudget aus HQ und Barracks, halbe Alloy-Kosten, kein Aether und keine Versorgung;
- kein gegnerischer Worker, Abbau, Basisbau, reguläre Produktion, Reparatur, Fähigkeitsgebrauch, Aufklärung oder strategisches Neuformieren.

Mehrere Simulations-APIs und der Run-Zustand sind ausdrücklich spielerseitig: `alloy`, `gas`, `energy`, `abilities`, `cap()`, `supply()`, `train()`, `build()`, Workerlieferung, Raffinerieeinkommen und `command()` setzen Team 0 voraus. Gegnerische Nahzielsuche darf derzeit Sichtbarkeit ignorieren. Ein Austausch nur der Funktion `wave()` genügt daher nicht.

## Fachliches Zielverhalten

### Wirtschaft und Wiederaufbau

Die KI soll in kleinen, deterministischen Entscheidungsintervallen Prioritäten neu bewerten:

1. Einen funktionsfähigen Wirtschafts-Bootstrap sicherstellen und verlorene Worker ersetzen.
2. Worker auf erreichbare Alloy-Vorkommen verteilen und Ladungen an ein eigenes HQ liefern.
3. Versorgung mit Depots rechtzeitig erweitern.
4. Eine Raffinerie legal an einem erkundeten, freien Aether-Vent errichten.
5. Voraussetzungen in normaler Reihenfolge aufbauen: Barracks → Factory → Hangar.
6. Verlorene Schlüsselinfrastruktur bei ausreichenden Mitteln ersetzen.
7. Beschädigte wertvolle Gebäude oder Einheiten mit realen Workern und Alloy reparieren, wenn dies gegenüber Ausbau/Produktion sinnvoll ist.

Bauplätze müssen dieselben Terrain-, Abstands-, Sicht-, Vent- und Erreichbarkeitsregeln wie Spielerplätze erfüllen. Die KI darf nicht auf Einheiten bauen; das bestehende allgemeine Platzierungsissue wird nicht innerhalb dieses Auftrags stillschweigend gelöst, muss für KI-Plätze aber durch eine legale Kandidatenwahl vermieden werden. Fehlgeschlagene Platzierungen müssen zu einem späteren neuen Kandidaten führen und dürfen den Planer nicht blockieren.

### Produktion und Zusammensetzung

- Rekrutierung erfolgt ausschließlich über ein passendes fertiges Produktionsgebäude und dessen normale Queue/Ausfahrt.
- Die KI reserviert und bezahlt normale Versorgung sowie Alloy/Aether gemäß ihrer gewählten Fraktion.
- Sie erhält keine Einheiten, für die Voraussetzung, Gebäude, Ressourcen oder Ausgang fehlen.
- Die Zusammenstellung soll eine robuste Grundmischung bilden und auf **gesehene** gegnerische Kräfte reagieren, beispielsweise Luftabwehr gegen bekannte Air-Einheiten, mobile Kräfte gegen Artillerie und Medics für größere Verbände.
- Hero-Limit, Queue-Limit, Boden-/Luftebene und alle bestehenden Einheitenregeln gelten unverändert.
- Ein Produktionsstau oder zerstörter Ausgang darf keine kostenlosen Ersatzspawns auslösen.

### Verteidigen, sammeln, angreifen

Ein kleiner expliziter Strategieautomat genügt; keine lernende KI und kein aufwendiger Behavior-Tree erforderlich. Sinnvolle Zustände sind beispielsweise `bootstrap`, `defend`, `assemble`, `attack` und `recover`.

- Ein Teil geeigneter Kräfte bleibt als Basisreserve, insbesondere solange eine sichtbare Bedrohung besteht.
- Auf sichtbare Angriffe reagiert die KI mit erreichbaren Einheiten, ohne die genaue Zusammensetzung verborgener Verstärkung zu kennen.
- Angriffsverbände sammeln sich an einem legalen Rallypunkt. Es werden keine neuen Einheiten für den Angriff erzeugt.
- Angriffbereitschaft ergibt sich aus eigener Kampfkraft, geschätzter bekannter Verteidigung, verfügbarer Reserve und einer mit der Wartezeit steigenden Dringlichkeit. Es gibt keine angekündigte Welle, feste Wellengröße oder garantierte Gratisverstärkung.
- Angriffe priorisieren erreichbare, bekannte Wirtschafts-/Produktionsziele und können anschließend zum HQ fortgesetzt werden. Ist ein Ziel zerstört oder nicht mehr bestätigt, wird anhand fairer Information neu entschieden.
- Deutlich unterlegene oder zerschlagene Verbände dürfen sich zu einem bekannten eigenen Sammelpunkt zurückziehen beziehungsweise in `recover` wechseln. Aufwendige Einzelmikro ist für den ersten Stand nicht erforderlich.
- Die gleiche Startkonfiguration und derselbe Seed müssen zu denselben KI-Entscheidungen führen. Keine Wandzeit, DOM-/Rendererwerte oder ungesicherte Zufallsquelle im Planer.

### Aufklärung und Information

- Sicht/Erkundung werden pro Team geführt; die bestehende Spielersicht und Darstellung dürfen sich dadurch nicht ändern.
- Kampfzielerfassung der KI unterliegt derselben aktuellen Sichtregel wie beim Spieler.
- Scouts beziehungsweise kleine Verbände können unbekannte Korridore, Ressourcenorte und die gegnerische Startregion untersuchen.
- Strategische Bewertungen verwenden nur eigene Entitäten, aktuell sichtbare Gegner sowie ausdrücklich gespeicherte Last-Seen-Daten. Beim Verschwinden eines Ziels darf dessen Zustand nicht heimlich weiter aktualisiert werden.
- `Recon scan` darf regelkonform noch unbekanntes Gelände aufdecken; die übrigen Fähigkeiten benötigen dieselbe zulässige Zielinformation wie beim Spieler.

### Fähigkeiten

Die KI erhält ein eigenes Energiekonto und eigene Cooldowns und verwendet die vorhandenen Fähigkeiten mit denselben Kosten und Wirkungen:

- **Orbital strike:** gegen eine wertvolle sichtbare Zielgruppe, ohne bekannte eigene Einheiten unnötig zu treffen.
- **Repair field:** bei ausreichend beschädigten eigenen Einheiten/Gebäuden.
- **Recon scan:** zur Aufklärung einer strategisch relevanten unbekannten oder veralteten Region.
- **Reinforcements:** nur bei freier eigener Versorgung und sinnvoller Verteidigungs-/Angriffsposition.

Fähigkeitsziele und fraktionsspezifische Effekte müssen das ausführende Team beziehungsweise dessen Fraktion verwenden; sie dürfen nicht auf `s.faction` oder Team 0 fest verdrahtet bleiben.

## Technische Leitplanken

### Teamneutrale Simulation

Vor dem neuen Verhalten werden die betroffenen Regeln mechanisch teamneutral gemacht. Sinnvolle Grenzen sind unter anderem:

- Ressourcen, Energie, Cooldowns und gegebenenfalls Statistik pro Team statt eines impliziten einzelnen Kontos;
- teamparametrisierte Versorgung, Produktionssuche, Kosten, Voraussetzungen, Bau, Reparatur und Fähigkeiten;
- eine gemeinsame validierende Simulationsschnittstelle für Spieler- und KI-Aktionen statt duplizierter Sonderlogik;
- dünne spielerseitige Wrapper dürfen UI-Meldungen weiter auslösen, während die KI strukturierte Fehlschläge ohne Toasts verarbeitet;
- KI als Simulationsbestandteil, vorzugsweise in einer eigenen Datei wie `src/simulation/ai.ts`, ohne Renderer-, UI-, DOM- oder Browserzugriff;
- begrenzte Entscheidungsfrequenz und wiederverwendete räumliche Abfragen statt vollständiger strategischer Scans in jedem 0,05-s-Schritt.

Mechanische Teamneutralisierung, faire Sicht, Wirtschaftsverhalten und Entfernung der Wellen sind getrennte, prüfbare Änderungen. Während der mechanischen Phase bleibt das bestehende Spieler- und Wellenverhalten nachweislich erhalten. Keine beiläufige Änderung an Einheitenwerten, Navigation, Kollisionsradien, Terrain oder Fraktionsboni.

### Determinismus und RNG

KI-Entscheidungen müssen seedbasiert reproduzierbar sein. Zufällige Variation darf nicht pro Frame konsumiert werden und soll einen eigenen klaren deterministischen Entscheidungsstrom verwenden oder vollständig aus stabilem Zustand abgeleitet werden. Terrain-RNG, kosmetische Effekte und bestehende Spawn-/Kampfaufrufe dürfen nicht versehentlich durch reine Planerabfragen verschoben werden.

Das Entfernen der Wellen ändert kontrollierte Gefechtsverläufe absichtlich. Historische Fixtures werden nicht zur Reparatur überschrieben; stattdessen werden vorherige Schutzwerte für unbeteiligte Terrain-, Bewegungs-, Kampf-, Rendering- und Contentverträge beibehalten und neue fokussierte KI-Szenarien ergänzt.

## Bezug zu einem späteren Multiplayer

Multiplayer ist **nicht Teil dieses Auftrags** und bleibt in weiter Ferne. Die hierfür nötige Teamneutralisierung ist trotzdem sinnvoll und soll so erfolgen, dass sie einen späteren zweiten menschlichen Controller nicht verbaut:

- Simulation und Rendering/UI bleiben strikt getrennt; `MeridianGame` kennt weiterhin keinen Renderer.
- Spielregeln validieren Aktionen unabhängig davon, ob sie von UI oder KI stammen.
- Teamzustände und Sicht sind nicht implizit an „Spieler = Team 0“ beziehungsweise „Gegner = Team 1“ gekoppelt.
- KI erzeugt normale deterministische Simulationsbefehle statt Entitäten oder Zustand außerhalb der Regeln direkt zu manipulieren.
- Keine Wandzeit oder Browserzustände in der Simulation.

Nicht vorsorglich umgesetzt werden Netzwerktransport, Lobby, Autorität, Replays, Befehlsserialisierung, Snapshots, Lockstep, Rollback, Desync-Erkennung oder Run-Speicherung. Diese Themen benötigen später ein eigenes Multiplayer-Konzept. Insbesondere garantiert die heutige Seed-Reproduzierbarkeit noch keinen plattformübergreifenden Lockstep.

## Empfohlene Umsetzungsschritte

1. **Vorherige Verträge fixieren:** aktuelle Start-, Kampf-, Bewegungs-, Terrain-, UI- und RNG-Grenzen gezielt sichern; keine neue Referenzdatei aus dem späteren Ergebnis ableiten.
2. **Teamneutralisierung:** Konten, Versorgung, Kosten, Produktion, Workerarbeit, Bau/Reparatur und Fähigkeiten für einen angegebenen Akteur nutzbar machen. Bestehendes Wellenverhalten zunächst erhalten.
3. **Sicht pro Team:** eigene Sicht-/Erkundungsdaten und Last-Seen-Information einführen; bestehende Spielerdarstellung bleibt identisch, Gegnerzielsuche verliert den Sicht-Cheat.
4. **Symmetrischer KI-Start und Wirtschaft:** alte gegnerische Festungsaufstellung entfernen; KI bootstrapped Worker, Einkommen, Versorgung und Tech über normale Regeln.
5. **Produktion und Basisplanung:** legale Gebäudekandidaten, Queueprioritäten, Wiederaufbau und fraktionsgerechte Armeemischung.
6. **Strategieautomat:** Verteidigung, Sammlung, zustandsabhängige Angriffe auf bekannte strategische Ziele, Rückzug/Erholung und regelmäßiger Druck.
7. **Fähigkeitsplaner:** eigene Energie/Cooldowns und faire Zielheuristiken für alle vier Fähigkeiten.
8. **Wellen vollständig entfernen:** `wave`, `nextWave`, `enemyBudget`, Direktspawns, Warnungen, Events, Dokumentation und wellenspezifische Tests löschen; keine Legacy-Adapter im flüchtigen Run-Zustand.
9. **Gesamtvalidierung und Balancing:** mehrere vollständige deterministische Runs je Fraktionspaar und repräsentative Seeds/Biome, anschließend echte Geräte und längere Partien.

## Abnahmekriterien

- Im aktiven Run existiert kein Wellenzähler, nächster Wellentermin oder künstliches Gegnerbudget mehr; keine Wellenwarnung/-meldung wird angezeigt oder emittiert.
- Beide Seiten starten in der Baseline nur mit HQ und identischem regulärem Wirtschafts-Bootstrap; keine gegnerische Fertigbasis oder Startarmee.
- Die KI kann ohne direkte Spawns Alloy abbauen, Aether erzeugen, Versorgung erweitern, alle Voraussetzungen bauen und Einheiten über echte Queues/Ausgänge produzieren.
- Ressourcen-, Kosten-, Zeit-, Versorgungs-, Platzierungs-, Reparatur-, Sicht- und Fähigkeitsregeln sind für beide Teams gleich und fraktionskorrekt.
- Tests beweisen, dass verborgene oder nach Sichtkontakt versetzte Spielerziele nicht mit aktuellem Geheimwissen bewertet oder direkt angegriffen werden.
- Die KI verteidigt sichtbare Basisangriffe, bildet reale Angriffsgruppen, erzeugt regelmäßig zustandsabhängigen Druck und kann bekannte Worker, Raffinerien, Depots sowie Produktionsgebäude priorisieren.
- Die KI kann alle vier Fähigkeiten regelkonform und mit eigenem Energie-/Cooldownzustand einsetzen.
- Zerstörte Worker/Produktion, Ressourcenmangel, belegte Ausgänge und fehlgeschlagene Baukandidaten führen nicht zu kostenlosen Einheiten oder einem dauerhaft blockierten Planer.
- Gleicher Seed und gleiche Eingaben ergeben denselben Verlauf; keine ungeprüfte Zufalls- oder Rendererabhängigkeit.
- Bestehende Einheitenwerte, Fraktionsboni, Bewegung, Kollision, Projektil-/Schadensregeln, Sieg/Niederlage, Core Loop und direkte `file://`-Auslieferung bleiben erhalten.
- Automatisierte Langlaufszenarien decken alle Fraktionspaarungen, Wirtschaft, Produktion, Fähigkeiten, Angriff/Verteidigung, Sieg/Niederlage sowie Einheitenabstand ab. Browserchecks prüfen entfernte Warnungen, Fog of War und sichtbare KI-Aktionen; echte Mobilgeräte und vollständige Runs bleiben für abschließendes Balancing erforderlich.

## Nicht Teil dieses Auftrags

- einstellbare Schwierigkeit oder Profilmigration dafür;
- lernende/adaptive KI über mehrere Runs;
- geheime Ressourcen-/Sichtboni oder andere Schwierigkeitscheats;
- neue Einheiten, Gebäude, Fähigkeiten, Fraktionsboni oder Balancingwerte ohne gesonderte Entscheidung;
- Kampagne, Diplomatie, mehrere Gegner oder Teamallianzen;
- Multiplayer-, Netzwerk-, Replay-, Snapshot-/Restore- oder Run-Speicherfunktionen;
- Rendering-/Modelländerungen;
- allgemeine Behebung bestehender Platzierungs- oder Crowd-Issues außerhalb konkret benötigter legaler KI-Kandidaten.
