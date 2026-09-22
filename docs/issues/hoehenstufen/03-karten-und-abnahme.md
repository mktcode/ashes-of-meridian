# Höhenstufen 3: Kartenlayouts, Integration und Abnahme

Abhängigkeiten: [Welt/Navigation](01-welt-und-navigation.md) und [Darstellung/Bedienung](02-darstellung-und-bedienung.md). [Ziel, Parameter und Entscheidungen](README.md) sind maßgeblich; dieses Paket kopiert keine zweite Regeltabelle.

## Kartenplan

### Mothership: überarbeiteter Abnahmekandidat

**Technisch umgesetzt, menschliche Abnahme ausstehend:** [Teststart und offene Grenzen](README.md#jetzt-manuell-testen). Die [asymmetrische Höhensicht](04-hoehenabhaengige-sicht.md) ist integriert. Die übrigen Karten bleiben bis zu einem neuen Auftrag unverändert.

Der aktuelle Kandidat vergrößert die spielbare Ausdehnung von 90 auf 120. Vier abgerundete, weiterhin sechs Meter hohe Basisdecks umschließen eine große abgesenkte Gefechtsfläche; jede Basis besitzt eine breite Hauptrampe und einen getrennten Flankenzugang. Hangars und Maschineninseln verwenden angeschrägte sichtbare wie spielmechanische Umrisse. Eine kreuzförmig fortgeführte Außenhülle, detailliertere Fassaden und Dächer, Deckmarkierungen sowie zurückhaltende Signalleuchten sollen die Arena als Ausschnitt eines größeren Trägers lesbar machen.

Anzahl und Ertrag der Anfangsvorkommen bleiben unverändert; ihre Positionen wurden auf die größeren Decks verteilt und ihre Primärdistanzen zwischen den vier Starts angeglichen. Deckmarkierungen, Cargo-Pads und Vent-Docks folgen derselben Höhe wie das Nutzterrain; Außenhülle, Brücke und Hangardächer bleiben nicht spielbarer Boden. Die Höhenmechanik selbst bleibt unverändert.

- [x] Vier vollständige Basispolygone mit ebener Wirtschafts-/Baufläche und reservierten Ausgängen entwerfen.
- [x] Hauptrampen, alternative Zugänge, Ressourcenflächen und angeschrägte Architekturblocker technisch prüfen.
- [ ] Verdeckung durch die vorderen Plateauränder bei fester Kamerarichtung abnehmen, nicht nur den Blick von einer bevorzugten Seite.
- [ ] Atmosphäre, Orientierung, faire reale Laufwege und Kosten der höheren Geometriedichte in vollständigen Partien und auf Mobilgeräten menschlich abnehmen.

### Alien Planet: natürliche Terrassen

Erhöhte bewachsene Randplateaus mit einer großen tieferen Lichtung als Schlachtfeld. Die Karte hat eine größere Ausdehnung als die anderen beiden; gleiche absolute Plateau-/Rampenmaße erzeugen deshalb nicht automatisch vergleichbare Wege. Bestehende durchlässige Wälder erhalten, keine geschlossenen Waldwälle als Ersatz für ehrliche Klippen.

- [ ] Anfangswirtschaft aller vier Ecken in den Plateaus unterbringen; tiefere Ressourcenfelder und Flankenwege anbinden.
- [ ] Baumstämme, Wurzelkolonien und Dekoration erden; Bodenblocker nicht auf Rampen oder geschützte Ausfahrten versetzen.
- [ ] Wald-/Reliefverdeckung zusammen beurteilen. Bestehende Baum-/Dekor-RNG-Ströme nicht beiläufig neu ordnen; neue Layout-Ausschlüsse können bewusste lokale Platzierungsänderungen verursachen und sind gesondert zu prüfen.

### Desert: Canyonlandschaft mit erhöhten Basisflächen

Heute reserviert `desertCanyonPlan` tiefe flache Startbecken und verbindet Ressourcen/Starts durch seedabhängige Täler; jedes erhöhte Relief wird konservativ blockiert. Das gewünschte Leitbild kehrt damit gerade die bisherige Basistopologie um. Dies ist die anspruchsvollste Kartenadaption, kein Höhenoffset über dem alten Canyon.

- [ ] Begehbare Basisplateaus und Rampen zuerst definieren, Canyon-/Felsrelief anschließend darum formen. Mittlere Kampfzone gegenüber dem heutigen verzweigten Talnetz bewusst verbreitern, ohne die warme Canyonästhetik zu verwerfen.
- [ ] Begehbare Hochfläche, gesperrte Klippe und dekoratives Bergrelief getrennt klassifizieren. Die derzeitige Regel „Höhensample über Schwelle = Blocker“ ersetzen, nicht die komplette Höhe freischalten.
- [ ] Plateauzugänge, Ressourcen und Vent-Flächen vor Fels-/Geröllplatzierung schützen. Geröllhöhe weiter aus tatsächlich gezeichneten Dreiecken abfragen, ohne eine zweite Landschaft nachzubauen.
- [ ] Außenrelief und technische Kartengrenze nahtlos halten. Vorhandenes großes Relief-/GPU-Budget nicht durch eine zweite vollständige Höhenmesh-Schicht verdoppeln.

## Gemeinsame Layout-Akzeptanz

- [ ] Alle vier Kandidaten sind unabhängig von der späteren Parteienzuordnung hochgelegen und besitzen nutzbare Baufläche. HQ-Suche kann die Höhenvorgabe nicht umgehen.
- [ ] Eine große zusammenhängende tiefe Kampfzone ist von jedem Start erreichbar; Rampen haben Körperfreiraum auch nach Rasterung. Umwege zwischen benachbarten und diagonal gegenüberliegenden Starts vergleichen, nicht nur Entfernung zur Mitte.
- [ ] Anfangs-Alloy, Vent, Abbau-/Abladeseiten und Produktionsausgänge sind erreichbar. Mengen/Anzahl bleiben unverändert; notwendige Umplatzierung separat prüfen und als Layoutänderung behandeln.
- [ ] Dekoration kann keine neuen Passagen sperren. Kein Terrainunterschied aufgrund aktiver Parteien, Perspektive oder privatem Multiplayer-Startseed.
- [ ] Rampen dürfen nicht unbeabsichtigt durch ein einzelnes legales Fundament sämtliche Basiszugänge verlieren. Ob absichtliches Walling erlaubt sein soll, bleibt eine Designentscheidung, keine stillschweigende globale Bausperre.

## Prüf- und Integrationsplan

1. Pakete 1/2 und die Sichtregel sind an synthetischen Verträgen und dem Mothership-Durchstich technisch geprüft. Bestehende feste Referenzen nicht zur Reparatur überschreiben.
2. Mothership einschließlich der [höhenabhängigen Sicht](04-hoehenabhaengige-sicht.md) gezielt menschlich begutachten. Alien Planet und Desert nur nach neuem Auftrag übertragen.
3. Kleine gezielte Terrain-/Zugangsprüfungen auf ausgewählten Seeds und allen vier Startkandidaten. Umfang vorab begrenzen; kein versteckter KI-/Simulations-Langlauf.
4. Netzwerk: gleicher öffentlicher Seed erzeugt gleiche Höhen/Übergänge auf Host und Client; Interpolation/Ereignisse auf Rampe, Sichtverlust und Session-/Kartenwechsel prüfen. Zwei-Client-Kurzcheck bei konkretem Bedarf gemäß [Prüfverfahren](../../testing.md).
5. Hauptagent führt ganz zum Schluss nach Integration die Standardtestsuite aus. `test:ai` und `test:simulation` einschließlich gefilterter Fälle nur nach ausdrücklicher aktueller Freigabe. Bei Bedarf gezielt Rampen-Gegenverkehr, produktive Worker und Angriffs-KI vorschlagen; keine Laufzeit-/Referenzanpassung zum Grünmachen.
6. Menschliche vollständige Partien, Touch-Bedienung und Mobilkosten separat abnehmen. Technische Erreichbarkeit belegt weder gutes Rampenspiel noch faire Startchancen.

## Bestehende offene Arbeit

[Worker-Navigation](../worker-bauwegfindung/issue.md) enthält bereits Liveness-/Crowd-Grenzen, die Rampen verschärfen können. [Desert-Abnahme](../desert-map.md), [Mothership-Abnahme](../terrain.md) und [Multiplayer-Kartenfragen](../multiplayer-karten-und-darstellung.md) behalten ihre eigenen Prüfkontexte; frühere Flachkartenbefunde sind kein Nachweis für das neue Höhenlayout. Die heutigen Issues nicht aufgrund des neuen Plans als erledigt behandeln.
