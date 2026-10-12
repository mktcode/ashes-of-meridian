# Terrain: Wege, Höhen und Spielabnahme

Generierungs-/Speichergrenzen und gemeinsame CPU-Oberfläche: [Architektur](../architecture.md#weltrezepte-und-feste-designs), [Höhen-/Sichtvertrag](../architecture.md#welt-darstellung-und-zufall), [Spielregeln](../gameplay.md). Größere Karten, native Familienformen einschließlich Plateau-Rezepten und breite Anschlusskorrekturen sind integriert. Geländeform folgt ausschließlich dem Familienrezept beziehungsweise Alien-Rücken-/Kraterachse; Höhe, Biotope, Wirtschaft und Größe bleiben seedabhängig. Keine zusätzliche allgemeine Gelände-Sichtlinie, Schaden-/Reichweitenboni oder generische Plateau-/Massiv-Formauswahl.

Bildwirkung, Materialien, Biotope und Randkulisse zentral unter [Landschaften](project-tomorrow.md); technische Start-/KI-Abnahme unter [prozeduralen Gefechten](procedural-battlefields.md). Isolierte Höhenprobe nach Build: `index.html?experiment=height` (Westmark `1409`, zwei Worker, flüchtiges Profil).

## Wege und Höhenregeln

- [ ] Höhen, begehbare Verbindungen und Klippen bei normalem Zoom erkennen; Hochflächen als nutzbare Landschaft statt gleichartiger Rundhügel oder ausgeschnittener Bauplatten beurteilen. Terrassen bleiben familienabhängig; keine vier hohen Basen oder festes tiefes Zentrum voraussetzen.
- [ ] Breite Auffahrten samt oberem/unterem Anschluss mit echten Gruppen in beide Richtungen prüfen: Picking, Minimap, Fahrzeug-Hanglage, Rampen-Gegenverkehr und Produktionsausgänge. Statische Freiraumprüfung beweist keine dynamische Liveness. Westmark `1409` besitzt eine gezielt korrigierte Randfläche, keine universelle Seedabnahme.
- [ ] Lokale Plateau-/Passlagen auf verständliche Höhenvorteile, Umgehung und Expansion prüfen. Räumliche Nutzbarkeit beweist weder Startsymmetrie noch Balance oder zwei unabhängige Zugänge zu jeder Hochfläche. Gegenverkehr und Kämpfe hinter Desert-Wänden im Run mitprüfen.
- [ ] Faire Wege, Wirtschaftszugänge und Erweiterungsflächen verschiedener Partei-/Körpergrößen abnehmen. Gebäude/Einheiten dürfen Wege versperren; Walling darf nicht unbeabsichtigt jeden Ausgang schließen. Gewünschte absichtliche Walling-Regel bleibt offen.
- [ ] Abbau/Rücktransport, Raffinerien und stabile Fundamente auf sanften Hängen prüfen: keine Arbeit durch Klippen oder Bau auf steilen Übergängen. Worker-/Originalstillstände nur unter [Navigation](worker-bauwegfindung/issue.md) verfolgen.
- [ ] Sicht von unten/oben, Rampenmitte, Quellenvereinigung/-verlust und Flugzeug/Scan prüfen; lokale Sicht/Effekte und Bodenposen samt Touchbedienung im Spielfluss abnehmen. [Flugfreiraum](project-tomorrow.md#flugfreiraum-nach-dem-reliefausbau) separat.
- [ ] Lokale Gebäude-Bodenhaut, Hangneigung und Menü-Bauplätze visuell abnehmen: keine Fremdtextur-Platten, glaubwürdiger Bodenanschluss und erhaltene Menükomposition. CPU-/Browserverträge sichern Stützebene, Materialgewichte, Auslauf und Patch-Lebenszyklus, nicht die Gesamtbildwirkung. Rein visuelle Auffüllung verändert keine Spieloberfläche; [Modellvertrag](../rendering.md#einzeln-wartbare-modelle).
- [ ] Größere Karten auf Erkundungsdauer, Wirtschaftsverteilung und Kamerabedienung beurteilen; feste Rasterauflösung erzeugt mehr Zellen. Startzeit, Speicher und Renderkosten auf Zielgeräten unter [Performance](performance/README.md) prüfen.

## Interessante Vergleichsseeds

Vom Nutzer im Map Viewer auf unterschiedlichen Familien als interessant bewertet:

- `30227062`
- `39095729`
- `69454296`
- `62745379`
- `8115531`
- `19763024`

- [ ] Wünschenswerte Komposition, Höhenkontraste, Teilregionen, Freiflächen/Engstellen und Biotopwechsel beschreiben. Subjektive Auswahl ist keine Spielbarkeits-/Balanceabnahme.
- [ ] Familienzuordnung und Viewer-Rezept/Build ergänzen; bisher sind nur familienübergreifende Betrachtungen bekannt. Seeds allein konservieren Landschaften nicht über Generatoränderungen hinweg.

Die als langweilig gemeldeten Beispiele werden auf Nutzerwunsch nicht weiter geführt. Keine Seed-Whitelist. Gezielte CPU-Fälle sichern Komponenten, Mindestnutzung, Anschlussbreite, Wirtschaftsfundamente und unterschiedliche Morphologie; pausierte Browseraufnahmen zeigen nur ausgewählte Seeds ohne Simulationsfortschritt. Vollständige Partien gemeinsam mit [Run-Abnahme](playtest-validation.md). Breite Seed-/KI-/Simulationsläufe benötigen eigene Freigabe; Referenzen nicht zum Grünmachen regenerieren.
