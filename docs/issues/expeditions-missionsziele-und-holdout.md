# Expeditionsmissionen: variable Ziele und Holdout-Pilot

## Ziel und Aufwand

Expeditionen sollen außer dem heutigen **„gegnerisches HQ zerstören / letztes eigenes HQ verlieren“** weitere Sieg- und Niederlagebedingungen enthalten können. Erster Pilot ist eine Tower-Defense-artige **Holdout-Mission** auf einer dafür entworfenen Karte: Basis und Wirtschaft aufbauen, das eigene Kommandozentrum gegen angekündigte Angriffswellen halten und nach Ablauf der Einsatzdauer gewinnen.

Das ist ein **großes Feature**, keine reine Kartenvariante. Die heutigen [Spielregeln](../gameplay.md#gefecht-und-fortschritt) setzen zwei HQ-Starts, eine wirtschaftende Standard-KI und fest verdrahtete HQ-Ergebnisregeln voraus; Checkpoint, Briefing und Hilfetexte kennen nur Karte, Gegner und Seed. Eine bloße Sonderabfrage anhand der Karten-ID würde diese Kopplung verschärfen. Zustands-, Karten- und RNG-Grenzen stehen in der [Architektur](../architecture.md#zustands--und-verantwortungsgrenzen).

Grobe Größenordnung für einen belastbaren ersten Piloten: mehrere getrennte Umsetzungspakete bzw. etwa **8–15 Entwicklungstage** für Missionsvertrag, Wellenregie, Kartenrezept, UI und automatisierte Prüfungen, danach zusätzliche menschliche Spiel- und Balance-Runden. Ein deutlich kleinerer Prototyp mit normaler Basisbau-KI und bloßem Überlebenstimer wäre mittlerer Aufwand, aber noch keine echte Tower-Defense-Karte mit lesbaren Wellen und kontrollierter Dramaturgie.

## Produktentscheidungen vor der Umsetzung

- [ ] **Missionskern bestätigen:** Empfohlen ist „halte das letzte eigene HQ für eine feste Dauer“. HQ-Verlust bleibt Niederlage; Zerstörung einzelner Spawnpunkte oder aller gerade lebenden Angreifer ist kein vorzeitiger Sieg.
- [ ] **Bau- und Wirtschaftsphase bestimmen:** Start sofort unter leichtem Druck oder mit kurzer sichtbarer Vorbereitungszeit; Ressourcenvorkommen, Vents, Startmittel und erlaubte Baufläche festlegen.
- [ ] **Wellenmodell bestimmen:** Dauer, Zahl und Takt der Wellen, angekündigte Ankunftsrichtung, Zusammensetzung je Gegnerfraktion sowie Schlusswelle definieren. Keine zufälligen Einheiten unabhängig vom gespeicherten Encounter-Seed.
- [ ] **Gegnerökonomie festlegen:** Empfehlung für den Piloten ist ein eigener, seed- und tiefenabhängiger Wellenetat ohne gegnerischen Basisbau. Das ist transparent zu kommunizieren und darf nicht als normale bezahlte Standard-KI dargestellt werden.
- [ ] **Gegnerische Expeditionsvorteile klären:** Die heutigen Vorteile setzen überwiegend HQ, Worker, Bau und Konten voraus. Entweder für Holdout nachvollziehbare Wirkungen je Vorteil definieren oder Holdout erst zulassen, wenn ein missionsübergreifender Gegnerfortschritt existiert. Vorteile stillschweigend ignorieren oder pauschal in versteckte Kampfbuffs umwandeln ist ausgeschlossen.
- [ ] **Belohnung und Auswahlhäufigkeit bestimmen:** Zählt Holdout wie ein regulärer Sieg genau eine Tiefe und eine Vorteilswahl? Ab welcher Tiefe und mit welchem Gewicht kommt die Mission vor? Unspielbare Folgen gleicher Missionen gegebenenfalls begrenzen, ohne beim Reload neu zu würfeln.
- [ ] **Abbruchfälle festlegen:** Verhalten bei gleichzeitigem Ablauf des Timers und HQ-Zerstörung, bei letzter Welle nach Zeitablauf sowie bei noch lebenden Gegnern. Empfehlung: Niederlage hat im selben Simulationsschritt Vorrang; Sieg beendet und friert das Gefecht eindeutig.

## Technischer Zielvertrag

Mission und Landschaft bleiben getrennte Begriffe. Das gespeicherte Encounter-Rezept erhält neben `map` eine stabile `mission`-ID; zulässige Kombinationen kommen aus einem kleinen Katalog. Die erste Holdout-Mission darf auf genau eine dedizierte Karte begrenzt sein, ohne dass die Simulation anhand des Kartennamens ihre Regeln errät.

- `BattleRules` bzw. ein eigener Einzelspieler-Missionszustand beschreibt Zielart und deterministischen Laufzeitzustand. Ergebnisprüfung delegiert an die Mission statt direkt zwei HQ-Listen zu prüfen.
- Das Kartenrezept deklariert nur räumliche Anker wie Spielerstart, Wellenzugänge, Sammel-/Warnpositionen und zu schützende Bauflächen. Wellentakt, Sieg und Progression gehören nicht in Renderer oder Geländegenerator.
- Der Encounter-Checkpoint speichert weiterhin kein laufendes Gefecht. `mission`, Karte, Gegner, Seed und nötige statische Parameter reichen aus, um denselben Start und dieselbe Wellenfolge wiederherzustellen. Wegen des geänderten Rezepts den Checkpoint bewusst auf eine neue Version heben; alte Runs werden gemäß Prototypregel verworfen, nicht migriert.
- Der Wellenregisseur verwendet einen eigenen, aus Encounter-Seed und Mission abgeleiteten Zufallsstrom. Gelände-, Startplatz-, Kampf- und Effekt-RNG dürfen sich dadurch nicht verschieben. Anzeigen oder erneutes Öffnen des Briefings würfeln keine Welle neu.
- Angreifer werden als reguläre Einheiten derselben Simulation erzeugt und benutzen bestehende Bewegung, Sicht und Kampfregeln. Missionsskripte verursachen keinen direkten unsichtbaren Schaden und umgehen keine Kollisions- oder Zielregeln.
- Der Missionszustand enthält mindestens Phase, nächste Welle, verbleibende Zeit und deterministische Spawnplanung. UI liest diesen Zustand nur; sie entscheidet weder Sieg noch Spawnzeitpunkte.
- Der bestehende generische `BattleResult`- und einmalige Expeditionsfortschritt kann erhalten bleiben. Ergebnistext, Briefing, HUD-Zielanzeige, Warnungen und Feldhandbuch dürfen jedoch nicht weiter überall „enemy HQ“ voraussetzen.

## Umsetzungspakete

### 1. Missionsrahmen ohne Verhaltensänderung

- [ ] Missionstypen und Katalog für zulässige Karten-/Missionskombinationen einführen; alle bisherigen Encounters explizit als Standardangriff erzeugen und normalisieren.
- [ ] HQ-Siegregeln in eine Standardmission verschieben, dabei Gleichzeitigkeit, Score, Aether-Auszahlung und genau einmalige Ergebnisverarbeitung unverändert erhalten.
- [ ] Checkpointformat und Persistenztests auf das neue Encounter-Rezept umstellen. Reload startet weiterhin nur den gesicherten Gefechtsanfang.
- [ ] Briefing, Ergebnisvorschau und Feldhandbuch aus Missionsmetadaten speisen, nicht mit Karten-ID- oder Text-Sonderfällen.

**Zwischenabnahme:** Bestehende Expeditionen spielen sich seed- und RNG-identisch; alle drei heutigen Karten verwenden weiterhin ausschließlich den Standardangriff.

### 2. Deterministische Holdout-Simulation

- [ ] Missionszustand und Phasenmodell implementieren: Vorbereitung, aktive Wellen, Abschluss, Ergebnis.
- [ ] Wellenplan deterministisch aus Tiefe, Gegnerfraktion und separatem Missions-RNG erzeugen. Spawnversuche brauchen begrenzte, reproduzierbare Ausweichregeln; kein unendliches Wiederholen bei blockiertem Eingang.
- [ ] Reguläre Angriffsaufträge auf das eigene HQ bzw. sichtbare Verteidiger erteilen. Klären und testen, wie Einheiten bei zerstörtem Zwischenziel, blockiertem Pfad und leeren Wellen weiterlaufen.
- [ ] Niederlage und Timer-Sieg mit festgelegter Priorität prüfen. Nach Ergebnis weder weitere Wellen noch weitere Missionsmutationen ausführen.
- [ ] Wellenstärke getrennt von den allgemeinen KI-Druckstufen balancieren; keine Änderung an Einheitspreisen, Kampfwerten, Kollisionsradien oder Standard-KI als Nebenwirkung.

### 3. Dedizierte Holdout-Karte

- [ ] Neues Kartenrezept mit einem verteidigbaren Startbereich und mindestens zwei klar lesbaren, navigierbaren Angriffszugängen erstellen. Zugänge dürfen durch regelgerechtes Bauen erschwert, aber nicht vollständig und folgenlos versiegelt werden; die gewünschte Gegenregel vorher festlegen.
- [ ] Ressourcen so platzieren, dass Ausbau eine Risikoentscheidung bleibt und mindestens ein sinnvoller früher Bauplan existiert. Terrain, statische Blocker, Sicht und Minimap müssen dieselben Anker verwenden.
- [ ] Spawn- und Warnbereiche außerhalb der unmittelbaren Bauzone markieren, ohne verborgene Gegnerpositionen vor ihrer regelgerechten Sichtbarkeit offenzulegen.
- [ ] Eigene Rendergestaltung nur als separates Karten-/Assetpaket planen. Bestehende Landschaften, Texturen und seedbasierte Hindernisfolgen nicht für den Piloten umbauen.

### 4. Verständlichkeit und Expeditionseinbindung

- [ ] Vor Start Missionsname, Ziel, Dauer, Gegnerfraktion und relevante Gegnermodifikatoren anzeigen. Die normale Doktrin-/Basisbau-Beschreibung nicht irreführend wiederverwenden.
- [ ] Im HUD verbleibende Zeit, Vorbereitungsphase, nächste Welle und Richtung auch ohne Farbe verständlich anzeigen; Warnungen begrenzen, damit Audio und Meldungen nicht pro Einheit auslösen.
- [ ] Ergebnis-, Vorteilswahl-, Neustart-, Abbruch- und Reloadpfad mit Holdout verbinden. Sieg schreibt genau einen Checkpoint fort, Niederlage löscht den Run wie bisher.
- [ ] Encounter-Auswahl seedfest machen und Auswahlgewicht/Minimaltiefe an einer Stelle konfigurieren. Ein Reload oder Öffnen des Menüs ändert Mission und Karte nicht.
- [ ] Spielregeln und Feldhandbuch erst mit dem tatsächlich implementierten Piloten aktualisieren.

## Abnahmekriterien

- Ein Standardgefecht behält unverändert die heutigen HQ-Siegregeln und seine bisherige Expeditionsprogression.
- Derselbe Holdout-Checkpoint erzeugt nach Neustart dieselbe Karte, Eingänge, Wellenfolge und Spawnreihenfolge; er speichert keine laufenden Entitäten oder Timerstände.
- Holdout gewinnt ausschließlich nach erfüllter Haltebedingung und verliert beim festgelegten Schutzobjektverlust. Gleichzeitige Grenzfälle liefern genau ein reproduzierbares Ergebnisereignis.
- Wellen laufen über reguläre Navigation und Kampfregeln. Blockierte oder unbrauchbare Eingänge führen weder zu Hängen noch zu Teleports oder direkten Schadensskripten.
- Briefing und HUD erklären vor und während des Gefechts klar, was geschützt werden muss, wann die nächste Welle kommt und wodurch gewonnen wird.
- Aether-Auszahlung, Tiefenfortschritt, Vorteilsangebote, gegnerischer Fortschritt und Fraktionsfreischaltung werden pro Ergebnis höchstens einmal verarbeitet.
- Standardkarten und ihre RNG-Referenzen werden nicht neu erzeugt oder zur Reparatur angepasst.
- Die Mission ist mit allen drei spielbaren Fraktionen technisch möglich; Schwierigkeit und Spielspaß bleiben menschliche Abnahme.

## Prüfplan

Die Auswahl folgt den [Prüfverfahren](../testing.md#prüfwahl).

- Build und gezielte Persistenz-/UI-Tests für Missions-ID, ungültige Kartenkombinationen, Checkpoint-Neustart und einmalige Ergebnisverarbeitung.
- Kleine deterministische Simulationstests für Standardmission, Wellenplan, Spawnfehler, Timer/HQ-Gleichzeitigkeit und Stillstand nach Ergebnis. Keine großflächigen Seed-Sollwerte neu erzeugen.
- Kartenprüfungen für freie Start-/Spawnflächen, erreichbare Wege mit Einheitenfreiraum, Ressourcenanschluss und korrekte Minimap-/Sichtgrenzen.
- Wegen des Eingriffs in gemeinsame Simulation, RNG und Ladeverträge abschließend `npm test`.
- Umfangreiche KI-/Simulationsläufe nur nach ausdrücklicher aktueller Freigabe. Sie können später mehrere Seeds, Tiefen und Fraktionen auf abgeschlossene Wellen und festgefahrene Angreifer prüfen, ersetzen aber kein Balancing.
- Menschlicher Playtest für Vorbereitungszeit, Wellenlesbarkeit, Bauflächen, Engstellenmissbrauch, Dauer, Schwierigkeitskurve sowie visuelle und akustische Warnungen.

## Nicht-Ziele des Piloten

- Keine generische Skriptsprache oder frei kombinierbarer Missionseditor.
- Kein Escort, Capture Point, Sammelquote oder Bosskampf im selben Paket; der Rahmen soll sie später ermöglichen, aber nicht vorweg implementieren.
- Keine Multiplayer-Missionen, Koop-Wellen oder Änderung des Netzwerkprototyps.
- Kein Speichern oder Wiederherstellen eines laufenden Gefechts.
- Keine heimlichen Kampfwertboni, Sichtcheats oder Änderungen an Standard-KI, Terrain-RNG und bestehenden Kartenlayouts.
