# Fraktionsdoktrinen, Expeditionsschwierigkeit und neue Upgrades

Die Gegner-KI verwendet derzeit unabhängig von Fraktion und Expeditionstiefe dieselben Wirtschafts-, Produktions- und Angriffsregeln. Gleichzeitig wächst die Spielerseite durch Expeditionsvorteile. Die Expedition braucht deshalb unterscheidbare Gegner und einen begrenzten, nachvollziehbaren Anstieg des Gegnerdrucks.

## Festgelegte Richtung

- Die **gegnerische Fraktion ist der einzige Encounter-Modifikator**. Ein Encounter speichert weiterhin nur Gegnerfraktion, Karte und Seed; es gibt keine zusätzliche Modifikator-ID und keine zufällige Doktrin.
- Die Gegnerfraktion bestimmt die **Doktrin**: Aufbauplan, bevorzugte Armee, Angriffsmuster und Zielgewichtung. Die Expeditionstiefe bestimmt nur, wie konsequent und schnell diese Doktrin ausgeführt wird.
- Die KI bleibt ein regulärer Akteur mit bezahlter Wirtschaft, eigener Sicht und gemeinsamen Kampfregeln. Keine Startarmeen, Gratisressourcen, Sichtcheats oder pauschalen HP-/Schadensmultiplikatoren als Schwierigkeitsstufen.
- Karte und Seed bleiben Variation, aber keine implizite Schwierigkeitsstufe. Strategische Auswertungen bleiben deterministisch und verbrauchen keinen RNG.
- Die erste Umsetzung bleibt bei einer Hauptkampfgruppe. Mehrere koordinierte Verbände sind eine spätere Erweiterung, nicht Voraussetzung für die Doktrinen.

## Fraktionsdoktrinen

### Free Marches: befestigter Vormarsch

Die Fraktion nutzt ihren reparierenden Kommandoposten und die robusteren schweren Fahrzeuge.

- Solider, eher langsamer Wirtschafts- und Techaufbau.
- Früher Turm, danach zusätzliche Raffinerie und bevorzugt Factory-Kapazität.
- Schwerpunkt auf Tanks und Artillerie; Rifle-Einheiten bleiben notwendige Luftabwehr und Eskorte.
- Spätere, größere Angriffe mit höherer Heimatreserve als bei den anderen Fraktionen.
- Reparatur wichtiger Gebäude und Sammeln nahe der Basis haben hohe Priorität.
- Produktionsgebäude und Verteidigung werden vor einem direkten HQ-Angriff geschwächt.

### Verdant Choir: regenerierender Schwarm

Günstige, schnelle und außerhalb des Kampfes regenerierende Einheiten sollen in häufigen Angriffen sichtbar werden.

- Höheres Workerziel und frühe zweite Barracks statt schnellem Hangar-Tech.
- Schwerpunkt auf Rifle-/Medic-Gruppen; schwere Einheiten ergänzen, dominieren aber nicht.
- Frühere Angriffe mit kleinerer Reserve und kürzerer Erholungszeit.
- Hohe Zielgewichte für Worker und Raffinerien; dadurch bedroht die Doktrin ungeschützte Expansionen.
- Beschädigte Gruppen dürfen sich zur Regeneration lösen und anschließend erneut angreifen. Diese Rückzugsregel folgt erst nach dem einfachen Doktrin-MVP.

### Veiled Court: präzise Überlegenheit

Teure, schadensstarke Schildtruppen sollen über Tech, Aufklärung und gezielte Schläge wirken.

- Aether- und Techaufbau bis Factory/Hangar haben Vorrang vor zusätzlicher Massenproduktion.
- Schwerpunkt auf Aircraft sowie ausgewählten Tanks/Artillery; weniger reine Rifle-Masse.
- Scan und offensive Fraktionsfähigkeit werden früher für hochwertige bekannte Ziele eingesetzt.
- Hohe Zielgewichte für Raffinerien, Artillerie und Produktionsgebäude.
- Angriffe benötigen weniger Einheiten als bei den Free Marches, sollen bei gebrochenen Schilden aber eher lösen und nach Schildregeneration zurückkehren. Der gezielte Schildrückzug folgt nach dem Doktrin-MVP.

Beobachtete harte Konter gehen vor Fraktionsstil: Eine Luftbedrohung darf keine Doktrin dazu bringen, ausschließlich bodengebundene schwere Einheiten zu produzieren.

## Technischer Zuschnitt der KI

### Zustandsfluss

`MeridianExpedition.depth` ist bereits Teil des Checkpoints. `startExpeditionBattle()` reicht ihn zusätzlich zu Fraktion, Encounter und Vorteilen als `BattleOptions.depth` weiter. `MeridianGame.start()` normalisiert den Wert, legt ihn als `RunState.depth` ab und verwendet bei direkten Test-/Entwicklungsstarts weiterhin `0`.

Dafür ist keine neue Persistenzversion nötig. Neustart und Reload leiten Doktrin und Stufe erneut ausschließlich aus dem gesicherten `depth` und `encounter.enemy` ab. Weder Doktrin noch Schwierigkeitsstufe werden redundant im Checkpoint gespeichert.

### Regelauflösung

In `src/simulation/ai.ts` werden drei Ebenen getrennt:

1. gemeinsame technische Sicherheitswerte wie Denkintervall, Bauwiederholung und Kontaktlebensdauer,
2. eine nach `factionFor(team)` aufgelöste Fraktionsdoktrin,
3. eine aus `RunState.depth` abgeleitete Ausführungsstufe.

Ein zentraler Resolver liefert der vorhandenen Economy-, Production-, Strategy- und Ability-Logik unter anderem:

- Workerziel und gewünschte Gebäudeanzahlen,
- geordneten Tech-/Ausbauplan,
- Produktionspräferenzen und Grenzen je Einheitentyp,
- Heimatreserve, frühesten Angriffszeitpunkt und erforderliches Kräfteverhältnis,
- Scout- und Erholungsintervall,
- Zielgewichte sowie Schwellen für Reparatur und Fähigkeiten.

Die Regeln werden abgeleitet, nicht als veränderliche Objektreferenz in `AIState` gespeichert. Zufallsentscheidungen werden dafür nicht eingeführt.

Dynamische Pflichten bleiben vor dem Doktrinplan: fehlende Versorgung, verlorene Worker, nicht fertiggestellte Gebäude und beobachtete Konter müssen weiterhin behandelt werden. Der heutige starre `next`-Ausdruck für Gebäude und die allgemeine `choices`-Liste für Einheiten werden durch kleine priorisierte Kandidatenlisten ersetzt; Bau, Rekrutierung und Fähigkeiten laufen weiterhin ausschließlich über die gemeinsamen Aktionen.

### Tiefenstufen

Für den ersten Pilot werden wenige begrenzte Stufen statt einer unbeschränkten Formel verwendet:

- Tiefe 0–3: heutiges Ausführungsniveau mit bereits sichtbarer Fraktionsidentität,
- Tiefe 4–7: etwas höheres Workerziel, häufigere Aufklärung und kürzere Angriffswarten,
- Tiefe 8–11: zusätzliche doktrintypische Produktionskapazität und sicherere Konterproduktion,
- Tiefe 12–15: geringere Erholung zwischen Angriffen und strengere Zielauswahl,
- Tiefe 16+: letzte begrenzte Stufe mit ausgebauter Wirtschaft und konsequenten Angriffen.

Konkrete Zahlen gehören in die zentrale Regeldefinition und werden mit Langzeitsimulationen und menschlichen Runs abgestimmt. Denkfrequenz, Kollisionsradien und Simulationswerte sind keine Skalierungshebel. Die begrenzte Kurve soll zunächst Runs bis zu den bestehenden Freischaltungen abdecken; ob sehr tiefe Endlosruns weitere Regeln benötigen, bleibt von Playtests abhängig.

## Erste neue Expeditionsvorteile

Die erste Erweiterung ergänzt drei voneinander verschiedene, begrenzte Vorteile:

- **Survey drones**: erkundet zu Gefechtsbeginn deterministisch den nächsten Ressourcenbereich, ohne dort dauerhafte Sicht oder geheime Entitätsinformationen zu geben. Dafür erhält `Battlefield` einen gemeinsamen `explore(team, position, radius)`-Helfer, der Sichtpuffer und `fogVersion` korrekt aktualisiert und keinen RNG nutzt.
- **Field workshop**: beschleunigt das erste nach dem HQ platzierte Spielerfundament eines Gefechts. Die erfolgreiche Platzierung markiert `RunTriggers`; das Fundament speichert seinen festen Baugeschwindigkeitsfaktor, damit Abbruch, Wiederzuweisung und Reparatur ihn nicht erneut auslösen. Nur ein Worker baut weiter gleichzeitig.
- **Command capacitor**: erhöht die Startenergie des Spielers bis zum bestehenden Maximum. Das wirkt beim Gefechtsstart und weder auf Aether noch auf den Gegner.

Definition, Stapelgrenze und Beschreibung liegen wie bisher in `EXPEDITION_BENEFITS`. Die vorhandene Persistenznormalisierung und Angebotserzeugung übernehmen neue Schlüssel automatisch; die eigentlichen Effekte werden beim Start beziehungsweise beim erfolgreichen Bau angewendet. Bonusspawns werden in diesem ersten Paket vermieden, damit die Simulations-RNG-Reihenfolge unangetastet bleibt.

Weitere Kandidaten wie Fortification kit, Veteran cadre, Emergency logistics, Salvage protocol und Commander recovery werden erst nach Bewertung dieses Pakets konkretisiert. Jeder davon benötigt eine eindeutige Verbrauchsregel pro Gefecht und darf Bezahlung, Erstattung oder Versorgung nicht umgehen.

## Erste neue permanente Flottenupgrades

Permanente Boni bleiben kleiner als Expeditionsvorteile und wirken wie bestehende Upgrades erst beim nächsten Gefechtsstart:

- **Construction protocols**: geringe, gestaffelte Beschleunigung regulärer Spielerfundamente. Der Faktor wird mit Field workshop an einer zentralen Stelle kombiniert.
- **Logistics frame**: zusätzliche anfängliche Versorgungskapazität ohne kostenloses Gebäude; `cap(team)` berücksichtigt den normalisierten Metawert nur für Team 0 und behält das globale Limit von 180.
- **Repair logistics**: reduziert die Alloy-Kosten pro repariertem Hüllenpunkt, nicht die Reparaturgeschwindigkeit.

Ein permanentes Upgrade für **Starting aether** wird vorerst nicht umgesetzt: Ungenutzter Start-Aether wird nach der heutigen Regel wieder evakuiert und könnte das Upgrade ohne eigene Förderung dauerhaft neue Metawährung erzeugen. Das wäre erst nach einer eigenen Entscheidung über förderungsgebundenen beziehungsweise nicht evakuierbaren Start-Aether sauber möglich. Startenergie hat dieses Problem nicht.

Die neuen Definitionen werden in `META` ergänzt. Persistenz und Armory bleiben datengetrieben; Anzeige, Kostenstaffeln und Maximalstufen benötigen dennoch gezielte UI-/Persistenztests.

## Umsetzung in getrennten Schritten

1. **Tiefe durchreichen und Regeln auflösen:** Typen, normalisierte `RunState.depth`, zentraler Doktrin-/Stufenresolver und RNG-Invarianztests; noch keine breite Taktikänderung.
2. **Doktrin-MVP:** fraktionsabhängige Worker-, Bau-, Produktions-, Angriffs- und Zielprioritäten innerhalb der bestehenden Ein-Gruppen-KI.
3. **Doktrintaktiken:** regenerations-/schildorientierter Rückzug und angepasste Fähigkeitsnutzung, sofern das MVP stabil navigiert und Gefechte zuverlässig beendet.
4. **Expeditionsvorteile:** die drei festgelegten Vorteile einzeln implementieren und prüfen.
5. **Flottenupgrades:** Construction protocols, Logistics frame und Repair logistics als separates Balancingpaket.
6. **Darstellung und Regeln:** Gegnerfraktion/Doktrin am gesicherten Übergang verständlich benennen sowie `docs/gameplay.md` und Field Manual erst mit tatsächlich implementierten Regeln aktualisieren.

Die Pakete sollen getrennte Commits bleiben; insbesondere KI-Verhalten, Vorteilsmechanik und Metaprogression nicht in einer einzigen Änderung vermischen.

## Automatische Prüfung

- Controllernahe Tests prüfen pro Fraktion je einen charakteristischen Bau-, Produktions- und Zielentscheid ohne vollständiges Karten-/Tiefen-Kreuzprodukt.
- Eine fokussierte Tiefenprüfung belegt Grenzwerte, Standardtiefe und monotonen Druck der aufgelösten Regeln.
- Gleicher Seed und gleiche Eingaben müssen unabhängig von der Tiefe vor den ersten KI-Aktionen identische Karte, Startentitäten und denselben nächsten Simulations-RNG-Wert erzeugen.
- Bestehende autonome Partien müssen weiterhin ausschließlich bezahlte Aktionen verwenden, mindestens einen Angriff ausführen und innerhalb ihrer Grenzen enden. Für hohe Tiefe genügen zunächst repräsentative Szenarien pro Doktrin statt aller Fraktions-/Kartenkombinationen.
- Vorteile und Upgrades prüfen Teamgrenze, Stapelgrenze, Wirkung erst beim nächsten Start, Restart-Reproduzierbarkeit sowie korrekte Bau-, Versorgungs-, Reparatur- und Persistenzverträge.
- Wegen gemeinsamer KI-, Wirtschafts- und Startverträge nach den gezielten Tests die Gesamtsuite ausführen. Automatische Partien ersetzen keine menschliche Bewertung der Schwierigkeit.

## Menschliche Abnahme

In vollständigen Runs beobachten:

- Sind die drei Gegner allein durch ihr Verhalten erkennbar?
- Bleiben frühe Encounter lesbar und abwehrbar, während ab Tiefe 4/8/12 tatsächlich mehr Druck entsteht?
- Bleiben große Karten und Mothership trotz unterschiedlicher Laufwege fair?
- Entsteht eine dominante Bonus-/Upgrade-Kombination, besonders bei Baugeschwindigkeit und zusätzlicher Versorgung?
- Kann eine Doktrin nach Verlust von Worker, Builder oder Techgebäude noch sinnvoll wiederaufbauen?

Messwerte und konkrete Balancingkorrekturen gehören nach der Implementierung in die bestehende Run-Validierung, nicht als fortlaufendes Testprotokoll in diese Planung.
