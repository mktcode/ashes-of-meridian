# Landschaften und taktische Darstellung: offene Abnahme

Zentrale menschliche Bildabnahme aller fünf natürlichen Landschaftsfamilien. Welt-/Materialrezepte sind integriert; [Weltgrenzen](../architecture.md#weltrezepte-und-feste-designs) und [Grafikpflege](../rendering.md) bleiben maßgeblich. Geländewege, Höhen-/Sichtregeln und Walling unter [Terrain](terrain-generation.md), Start-/KI-Abnahme unter [prozeduralen Gefechten](procedural-battlefields.md). Kein weiterer Engineumbau aus dieser Liste.

## Familiencharakter und Materialien

- [ ] **Alien Planet:** Markante Großformen, rundere Kuppen statt pyramidenartiger Grate, Hangvegetation/-material und Verdeckung bei normalem Zoom/Nebel beurteilen. Glassteppe wurde als leer beanstandet; seedbasierte Großformen sind integriert. Vergleich: `experiment=alien-planet&seed=9` (Glassteppe/Bergzüge), Seed `7` (Pilzlandschaft/Kraterrand). Frühere feste Geografie ist keine Vorgabe.
- [ ] **Desert:** Warmen trockenen Canyoncharakter erhalten, keine dunkle Basaltästhetik. Grundgestaltung war positiv bewertet, Polygonwände/Bodenanschlüsse beanstandet. Erodierte Wände/Rinnen, Schutthänge, gruppiertes Geröll und Wandfuß ohne gezackten Anschluss bei Übersicht/Spielzoom abnehmen; Dünen-/Mesa-/Oasen-/Salzrezepte, Nebel/Asche und weite Eckblicke vergleichen. Kein Rückbau zum festen Layout.
- [ ] **Westmark:** Jahreszeiten, Pflanzen/Kronen, Schnee, Tal-/Bergkulisse, Hangvegetation und Tageslicht der prozeduralen Fassungen vergleichen. Isolierter Start: `index.html?experiment=westmark`, flüchtiges Profil; das frühere Fluss-/Brückenlayout ist keine Vorgabe.
- [ ] Materialmaßstab/-wiederholung, Boden-/Einheiten-/Minimap-Kontrast und Nachtlesbarkeit aller Familien vergleichen.
- [ ] **Biotope:** Offene, gehölzreiche, feuchte und karge Gemeinschaften sowie zweite Pflanzenformen in Übersicht/Spielzoom prüfen. Übergänge sollen große nachvollziehbare Regionen bilden, ohne Wege/Wirtschaft zu verdecken oder Höhen überall gleich einzufärben. Gezielt karge Desert-Hochflächen, Grove/Conifer auf Haven und Reed/Fungus auf Alien vergleichen. Kosmetische Feuchte ist keine Hydrologie; hoher Wald bleibt auf Sperrflächen, offene Flächen bekommen keine neuen Blocker. [Vertrag](../rendering.md#landschaftszonen-und-wetter).
- [ ] Hohe Vegetationsdichte, gestaffelte Kronen und niedrige Büsche insbesondere in dichtesten Seeds auf Verdeckung prüfen. Frontier `3` wurde mit erhöhter Dichte in Chromium ohne GL-/Seitenfehler geöffnet; keine Allseed-/Geräteabnahme. Mehr Bodendekor rechtfertigt keine zusätzlichen Waldhindernisse.

## Randkulisse und Kamera

- [ ] Feste, bis zum erzeugten Rand dekorierte Außenkulisse und weich erhöhte Vegetations-/Steindichte in Übersicht und bei normalen Randkameras beurteilen. Westmark `4` zeigte zuvor einen harten Dekorabschluss vor leerer Gelände-Verlängerung; diese entfällt. Keine unnötig große Kulisse oder pauschal erhöhten Instanzbudgets.
- [ ] Breite/schmale Fenster, Drehung, Zoom, Resize und Randziele prüfen: kein sichtbares Geländeende, Durchblick, heller Anschluss oder rechteckiger Schattenrand. Kamera-/Zoomgrenzen berücksichtigen Bildschirmecken und Geländeextrema; Übersichten dürfen zugunsten geschlossener Geländedeckung Teile der spielbaren Fläche abschneiden. Erreichbarkeit bebaubarer Ränder erhalten.
- [ ] Außenhöhen dürfen keine unbeabsichtigte umlaufende Beckenform erzeugen; echte Becken-/Kraterrezepte bleiben Varianten. Die spielbare Grenze bleibt rechteckig, Kulisse verleiht weder Baufläche noch Spielsicht. Vollaufgedeckte Vergleiche müssen auch die kosmetische Sichtkulisse aufdecken. Lokale Fog-Übergänge einschließlich kreisförmigem Sichtsaum, Material-/Bewuchs-/Schattierungsanschluss und Nachtwirkung menschlich abnehmen. [Darstellungsvertrag](../rendering.md#terrain-und-renderpässe).

## Taktische Lesbarkeit und Flugfreiraum

- [ ] Gemeldeten verdeckten Echo-Vent mit Raffinerie belegen und Bau abschließen; Originalkarte/Seed fehlen. Silhouetten-Zielklick ist integriert, Originalfall nicht reproduziert.
- [ ] Bauflächenlinien an Hang-/Blocker-/Sichtgrenzen, Vents und Klickvorschau beurteilen; Farbe zwischen Validatorproben bleibt Orientierung. Kosten unter [Bauplatzraster](performance/README.md#bauplatzraster), Bedienung unter [Citybuilding](citybuilding.md#baugrid-darstellung-und-bedienung).
- [ ] Kontursilhouetten bei normalem Zoom, Parteienfarben, dichten Gruppen und Verdeckung durch Berge/Kronen/Stadt prüfen. Keine Sichtfreigabe durch Intro/Fog.

### Flugfreiraum nach dem Reliefausbau

- [ ] Flugzeug-/Zerstörerhöhe, An-/Abstieg über Bergen/Tälern/Decks und Produktionsausfahrt abnehmen. CPU-Hülle schützt nicht automatisch vor hohen Dekorbauten, Baumkronen oder Außenkulisse.

## Tageszeit, Wetter und Licht

- [ ] [Startbildschirm-Himmel](../rendering.md#menü-landschaftswechsel): fremde Paletten, Sternpunktgrößen, Planeten-/Sonnenwirkung und Menülesbarkeit. Chromium prüft atmosphärische/Weltraumvariante, Shader, schmales Seitenverhältnis und Ressourcenfreigabe, nicht subjektive Wirkung oder Geräteperformance.
- [ ] [Tageszyklus](../architecture.md#weltrezepte-und-feste-designs): Morgen-/Abendübergänge und Nachtlesbarkeit aller Familien/Fraktionen, besonders auf dunklen Displays. Dunklere Nachtfüllbeleuchtung, stärkerer Bloom und [Modelllichter](modelle.md) gemeinsam prüfen. Technischer Desert-Vergleich `1415` sichert Mittag/Mitternacht und Pause, nicht alle Wetter-/Materialkombinationen.
- [ ] Regen/Schnee in Bewegung zurückhaltend statt dominant oder einfacher Striche beurteilen; frühere verstärkte Regenfassung wurde beanstandet.
- [ ] Bloom, Lichtanimation, Tracer/Funken/Explosionen/Staub und Brandflecken im Gefecht prüfen, kein flächiges Bodenleuchten. Räumliche Lichtzuordnung in dichten Basen/Armeen und Lichtdurchtritt ohne lokale Schatten bleiben offen.
- [ ] **Nasse Bodenlichtakzente:** High/Balanced bei normalem Zoom vergleichen: farbige Glanzspuren statt flächiger Aufhellung, keine Texturkacheln oder flimmernden Glanzpunkte in Bewegung. Regnerische Myzel-/Graswelten, Wege und signierte nasse Ufer gegen trockene/Fels-/Schneeflächen prüfen. Schein bleibt schattenlos; Kostenneutralität auf integrierten GPUs/Mobilgeräten ist nicht belegt. [Lichtvertrag](../rendering.md#lichtanimation-und-kampfakzente).

Technische CPU-/GPU-/Browserprüfungen ersetzen keine künstlerische oder Echtgeräteabnahme. Gerätekosten zentral unter [Performance](performance/README.md), vollständige Partien unter [Run-Abnahme](playtest-validation.md), keine zusätzlichen Vollrunden je Familie. Favoriten/Export mit [Skirmish](new-battle-screen.md) entscheiden; weitere Assets, Zivilisationsspuren, [seltene Blickfänge](unique-points-of-interest.md), Topologie und Missionen brauchen eigene Freigabe. Keine automatisch beauftragten Langläufe.
