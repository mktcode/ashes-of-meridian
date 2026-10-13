# Terrain: Wege, Höhen und Spielabnahme

Generierungs-/Speichergrenzen und gemeinsame CPU-Oberfläche: [Architektur](../architecture.md#weltrezepte-und-feste-designs), [Höhen-/Sichtvertrag](../architecture.md#welt-darstellung-und-zufall), [Spielregeln](../gameplay.md). Größere Karten, native Familienformen einschließlich Plateau-Rezepten und breite Anschlusskorrekturen sind integriert. Geländeform folgt ausschließlich dem Familienrezept beziehungsweise Alien-Rücken-/Kraterachse; Höhe, Biotope, Wirtschaft und Größe bleiben seedabhängig. Keine zusätzliche allgemeine Gelände-Sichtlinie, Schaden-/Reichweitenboni oder generische Plateau-/Massiv-Formauswahl.

Bildwirkung, Materialien, Biotope und Randkulisse zentral unter [Landschaften](landschaften-und-taktische-darstellung.md); technische Start-/KI-Abnahme unter [prozeduralen Gefechten](prozedurale-gefechtsstarts.md). Isolierte Höhenprobe nach Build: `index.html?experiment=height` (Westmark `1409`, zwei Worker, flüchtiges Profil).

## Wege und Höhenregeln

- [ ] Höhen, begehbare Verbindungen und Klippen bei normalem Zoom erkennen; Hochflächen als nutzbare Landschaft statt gleichartiger Rundhügel oder ausgeschnittener Bauplatten beurteilen. Terrassen bleiben familienabhängig; keine vier hohen Basen oder festes tiefes Zentrum voraussetzen.
- [ ] Geländefolgende Wirtschaftswege im [Map Viewer](../scene-capture.md#kartendiagnose) mit ursprünglichen Geraden, Abtrag/Auffüllung und ausgewählten Höhenprofilen beurteilen: verständliche Pässe und Umgehungen statt unnötiger Gräben, künstlicher Aufschüttungen oder zu langer Umwege. Die Gerade-/Datum-Gegenprobe enthält keine Anschlussreparaturen; kein vollständiger Alt-/Neu-Weltvergleich.
- [ ] Breite Auffahrten samt oberem/unterem Anschluss mit echten Gruppen in beide Richtungen prüfen: Picking, Minimap, Fahrzeug-Hanglage, Rampen-Gegenverkehr und Produktionsausgänge. Statische Freiraumprüfung beweist keine dynamische Liveness. Wenige feste CPU-Familien-/Seedfälle sichern Anschlussverträge, keine universelle Seedabnahme.
- [ ] Lokale Plateau-/Passlagen auf verständliche Höhenvorteile, Umgehung und Expansion prüfen. Räumliche Nutzbarkeit beweist weder Startsymmetrie noch Balance oder zwei unabhängige Zugänge zu jeder Hochfläche. Gegenverkehr und Kämpfe hinter Desert-Wänden im Run mitprüfen.
- [ ] Faire Wege, Wirtschaftszugänge und Erweiterungsflächen verschiedener Partei-/Körpergrößen abnehmen. Gebäude/Einheiten dürfen Wege versperren; Walling darf nicht unbeabsichtigt jeden Ausgang schließen. Gewünschte absichtliche Walling-Regel bleibt offen.
- [ ] Abbau/Rücktransport, Raffinerien und stabile Fundamente auf sanften Hängen prüfen: keine Arbeit durch Klippen oder Bau auf steilen Übergängen. Worker-/Originalstillstände nur unter [Navigation](navigation-worker-und-gruppenankunft.md) verfolgen.
- [ ] Sicht von unten/oben, Rampenmitte, Quellenvereinigung/-verlust und Flugzeug/Scan prüfen; lokale Sicht/Effekte und Bodenposen samt Touchbedienung im Spielfluss abnehmen. [Flugfreiraum](landschaften-und-taktische-darstellung.md#flugfreiraum-nach-dem-reliefausbau) separat.
- [ ] Lokale Gebäude-Bodenhaut, Hangneigung und Menü-Bauplätze visuell abnehmen: keine Fremdtextur-Platten, glaubwürdiger Bodenanschluss und erhaltene Menükomposition. CPU-/Browserverträge sichern Stützebene, Materialgewichte, Auslauf und Patch-Lebenszyklus, nicht die Gesamtbildwirkung. Rein visuelle Auffüllung verändert keine Spieloberfläche; [Modellvertrag](../rendering.md#einzeln-wartbare-modelle).
- [ ] Größere Karten auf Erkundungsdauer, Wirtschaftsverteilung und Kamerabedienung beurteilen; feste Rasterauflösung erzeugt mehr Zellen. Startzeit, Speicher und Renderkosten auf Zielgeräten unter [Performance](performance-und-mobilstabilitaet.md) prüfen.

## Terrassenvorschau im Terrainlabor

- [ ] Die [eigenständige Vorschau](../../experiments/map-generation/index.html?seed=2) mit Terrassen visuell abnehmen: unterschiedlich hohe Kronen und Felssimse statt einer einzelnen angehobenen Fläche. Kein produktiver Spielgenerator, keine zusätzlichen begehbaren Hochflächen.
- [ ] An schmalen, sehr steilen Terrassenwänden zeigen sich bei starkem Zoom teilweise rasterartige Hell-/Dunkelstreifen. Gegenproben für Mesh-Auflösung, Normalen und Selbstschatten unterscheiden, bevor weitere globale Verfeinerung oder Shaderänderungen erfolgen. Reproduzierbar an der freistehenden östlichen Mesa von Seed 2: Desert, 16:30, Schatten an, Mikrorelief/Bäume/Gras aus, etwa 900 % Zoom. Auch mit der zusätzlichen lokalen Unterteilung bleibt das Muster stellenweise sichtbar. Der gezielte Chromium-Check bestätigt zusammenhängendes Mesh ohne offene Innenkanten, gültiges GL und unveränderte geschützte Höhen/Spielraumneigung; er ist kein Bildqualitäts- oder Geräteperformancebeleg.

## Reproduzierbarer Generierungsabbruch

- [ ] Seed `16053245` für `alien-planet` und `haven`: Der reine CPU-Geländeaufbau auf Stand `8f4580b` scheitert in `connectBattlefieldTerrain` mit `Cannot connect broad terrain shelf with a safe ramp`, vor Dekor, Rendering oder Simulation. Alien wählt `broken-crater`, Haven `basin`; beide verwenden hier dieselbe Höhenform und Morphologie-RNG-Reihenfolge.
- Die elf Wirtschaftswege, alle Wirtschaftszugänge und HQ-Stützen bestehen ihre anfänglichen Prüfungen. Die breite Hauptkomponente umfasst 10.252 Rasterzellen; eine westliche Hochfläche bei ungefähr `x = -154 … -106`, `z = -4 … 39` bleibt mit 182 Zellen getrennt. Gesamt-/Sektorabdeckung sind ausreichend; die Hochfläche überschreitet aber die Grenze von 64 Zellen für anschlusspflichtige Inseln.
- Die erste Anschlussrunde findet 8.444 Endpunktpaare und prüft ihre begrenzte Auswahl von 48 Alternativen: 22 scheitern am Rampen-Höhenprofil, 22 an der breiten Rampenpassage, vier zunächst breite Rampen würden vorhandene Wirtschaftswege unpassierbar machen. Es gibt keinen akzeptierten Anschluss; der Generator bricht regelkonform ab. Diese Zählung stammt aus einer separaten transienten Instrumentierung des Haven-Falls, nicht aus einer Seed-/KI-Serie.
- Korrekturbedarf: Anschlussauswahl und Rampenprofil müssen die bestehenden Wirtschaftswege gemeinsam berücksichtigen. Nicht durch Ersatzseed, Ausschalten der Insel-/Breitenprüfung oder Lockerung der Klippenschwelle kaschieren. Der lokale Fehlernachweis ist keine universelle Seedabnahme.

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
