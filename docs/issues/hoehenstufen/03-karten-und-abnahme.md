# Höhenstufen 3: Kartenlayouts, Integration und Abnahme

Abhängigkeiten: der integrierte [Welt-, Navigations- und Darstellungsvertrag](../../architecture.md#welt-darstellung-und-zufall) sowie [Ziel, Parameter und Entscheidungen](README.md). Dieses Paket kopiert keine zweite Regeltabelle.

## Kartenplan

### Mothership: überarbeiteter Abnahmekandidat

**Technisch umgesetzt, menschliche Abnahme ausstehend:** [Teststart und offene Grenzen](README.md#jetzt-manuell-testen). Die [asymmetrische Höhensicht](04-hoehenabhaengige-sicht.md) ist integriert. Der anschließende [Alle-Karten-Auftrag](../project-tomorrow.md) überträgt inzwischen den gemeinsamen technischen Oberflächenvertrag auf alle Karten. Natürliche Landschaftsfamilien behalten eigene Formen; die unten vorgeschlagene Vereinheitlichung auf erhöhte Randbasen ist keine automatische Folge davon.

Der aktuelle Kandidat vergrößert die spielbare Ausdehnung von 90 auf 120. Vier abgerundete, je Trägerfassung unterschiedlich hohe Basisdecks umschließen eine große abgesenkte Gefechtsfläche; jede Basis besitzt eine breite Hauptrampe und einen getrennten Flankenzugang. Hangars und Maschineninseln verwenden angeschrägte sichtbare wie spielmechanische Umrisse. Eine kreuzförmig fortgeführte Außenhülle, detailliertere Fassaden und Dächer, Deckmarkierungen sowie zurückhaltende Signalleuchten sollen die Arena als Ausschnitt eines größeren Trägers lesbar machen.

Anzahl und Ertrag der Anfangsvorkommen bleiben unverändert; ihre Positionen wurden auf die größeren Decks verteilt und ihre Primärdistanzen zwischen den vier Starts angeglichen. Deckmarkierungen, Cargo-Pads und Vent-Docks folgen derselben Höhe wie das Nutzterrain; Außenhülle, Brücke und Hangardächer bleiben nicht spielbarer Boden. Die Höhenmechanik selbst bleibt unverändert.

- [x] Vier vollständige Basispolygone mit ebener Wirtschafts-/Baufläche und reservierten Ausgängen entwerfen.
- [x] Hauptrampen, alternative Zugänge, Ressourcenflächen und angeschrägte Architekturblocker technisch prüfen.
- [ ] Verdeckung durch die vorderen Plateauränder bei fester Kamerarichtung abnehmen, nicht nur den Blick von einer bevorzugten Seite.
- [ ] Atmosphäre, Orientierung, faire reale Laufwege und Kosten der höheren Geometriedichte in vollständigen Partien und auf Mobilgeräten menschlich abnehmen.

### Alien Planet: natürliche Terrassen

**Aktuell integriert:** Acht Landschaftsfamilien mit echten sanften Wellen, Becken, Falten, Krater- und Terrassenformen; ursprüngliche geschützte Wirtschaftsflächen und Waldblocker bleiben erhalten. Die folgende spezifische Grundrissidee bleibt eine offene Alternative: erhöhte bewachsene Randplateaus mit einer großen tieferen Lichtung als Schlachtfeld. Die Karte hat eine größere Ausdehnung als die anderen beiden; gleiche absolute Plateau-/Rampenmaße erzeugen deshalb nicht automatisch vergleichbare Wege. Bestehende durchlässige Wälder erhalten, keine geschlossenen Waldwälle als Ersatz für ehrliche Klippen.

- [ ] Anfangswirtschaft aller vier Ecken in den Plateaus unterbringen; tiefere Ressourcenfelder und Flankenwege anbinden.
- [ ] Die technisch geerdeten Baum-/Korallen-/Bogenformen, Wurzelkolonien und Dekoration auf allen Reliefvarianten menschlich beurteilen; ursprüngliche Bodenblocker und neue Formen müssen zusammenpassen.
- [ ] Wald-/Reliefverdeckung zusammen beurteilen. Bestehende Baum-/Dekor-RNG-Ströme nicht beiläufig neu ordnen; neue Layout-Ausschlüsse können bewusste lokale Platzierungsänderungen verursachen und sind gesondert zu prüfen.

### Desert: Canyonlandschaft mit erhöhten Basisflächen

**Aktuell integriert:** Das Canyonrezept erhält begehbares Talrelief mit geschützten Wirtschaftsbecken, gemeinsamer CPU-Innenhaut und geerdetem Geröll. Ursprüngliche Canyonwände bleiben gesperrt, neue sanfte Unebenheiten sind begehbar. Die folgende ältere Grundrissidee würde die Basistopologie zusätzlich umkehren und bleibt eine separate Entscheidung, nicht Voraussetzung des inzwischen integrierten technischen Höhenvertrags.

- [ ] Begehbare Basisplateaus und Rampen zuerst definieren, Canyon-/Felsrelief anschließend darum formen. Mittlere Kampfzone gegenüber dem heutigen verzweigten Talnetz bewusst verbreitern, ohne die warme Canyonästhetik zu verwerfen.
- [ ] Begehbare Hochfläche, gesperrte Klippe und dekoratives Bergrelief getrennt klassifizieren. Die derzeitige Regel „Höhensample über Schwelle = Blocker“ ersetzen, nicht die komplette Höhe freischalten.
- [ ] Plateauzugänge, Ressourcen und Vent-Flächen vor Fels-/Geröllplatzierung schützen. Geröllhöhe weiter aus tatsächlich gezeichneten Dreiecken abfragen, ohne eine zweite Landschaft nachzubauen.
- [ ] Außenrelief und technische Kartengrenze nahtlos halten. Vorhandenes großes Relief-/GPU-Budget nicht durch eine zweite vollständige Höhenmesh-Schicht verdoppeln.

## Gemeinsame Layout-Akzeptanz

- [ ] Alle vier Kandidaten besitzen unabhängig von der späteren Parteienzuordnung nutzbare örtlich ebene Baufläche. Auf Schiff/Stadt sind sie hochgelegen; ob dies auch auf jeder Naturkarte gewünscht ist, bleibt eine Layoutentscheidung. HQ-Suche darf die örtliche Höhenvorgabe nicht umgehen.
- [ ] Die gemeinsamen Kampfzonen sind von jedem Start erreichbar; Rampen haben Körperfreiraum auch nach Rasterung. Umwege zwischen benachbarten und diagonal gegenüberliegenden Starts vergleichen, nicht nur Entfernung zur Mitte.
- [ ] Anfangs-Sternenschlacke, Vent, Abbau-/Abladeseiten und Produktionsausgänge sind erreichbar. Mengen/Anzahl bleiben unverändert; notwendige Umplatzierung separat prüfen und als Layoutänderung behandeln.
- [ ] Dekoration kann keine neuen Passagen sperren. Kein Terrainunterschied aufgrund aktiver Parteien, Perspektive oder privatem Multiplayer-Startseed.
- [ ] Rampen dürfen nicht unbeabsichtigt durch ein einzelnes legales Fundament sämtliche Basiszugänge verlieren. Ob absichtliches Walling erlaubt sein soll, bleibt eine Designentscheidung, keine stillschweigende globale Bausperre.

## Prüf- und Integrationsplan

1. Pakete 1/2 und die Sichtregel sind an synthetischen Verträgen und dem Mothership-Durchstich technisch geprüft. Bestehende feste Referenzen nicht zur Reparatur überschreiben.
2. Mothership einschließlich der [höhenabhängigen Sicht](04-hoehenabhaengige-sicht.md) gezielt menschlich begutachten. Die inzwischen übertragenen Alien-/Desert-Familien auf natürlichen Hängen ohne zusätzliche Sichtboni prüfen.
3. Kleine gezielte Terrain-/Zugangsprüfungen auf ausgewählten Seeds und allen vier Startkandidaten. Umfang vorab begrenzen; kein versteckter KI-/Simulations-Langlauf.
4. Netzwerk: gleicher öffentlicher Seed erzeugt gleiche Höhen/Übergänge auf Host und Client; Interpolation/Ereignisse auf Rampe, Sichtverlust und Session-/Kartenwechsel prüfen. Zwei-Client-Kurzcheck bei konkretem Bedarf gemäß [Prüfverfahren](../../testing.md).
5. Hauptagent führt ganz zum Schluss nach Integration die Standardtestsuite aus. `test:ai` und `test:simulation` einschließlich gefilterter Fälle nur nach ausdrücklicher aktueller Freigabe. Bei Bedarf gezielt Rampen-Gegenverkehr, produktive Worker und Angriffs-KI vorschlagen; keine Laufzeit-/Referenzanpassung zum Grünmachen.
6. Menschliche vollständige Partien, Touch-Bedienung und Mobilkosten separat abnehmen. Technische Erreichbarkeit belegt weder gutes Rampenspiel noch faire Startchancen.

## Bestehende offene Arbeit

[Worker-Navigation](../worker-bauwegfindung/issue.md) enthält bereits Liveness-/Crowd-Grenzen, die Rampen verschärfen können. [Desert-Abnahme](../desert-map.md), [Mothership-Abnahme](../terrain.md) und [Multiplayer-Kartenfragen](../multiplayer-karten-und-darstellung.md) behalten ihre eigenen Prüfkontexte; frühere Flachkartenbefunde sind kein Nachweis für das neue Höhenlayout. Die heutigen Issues nicht aufgrund des neuen Plans als erledigt behandeln.
