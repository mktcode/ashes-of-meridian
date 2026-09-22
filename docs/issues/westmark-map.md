# Westmark als zusätzliche Karte vorbereiten

## Auftrag und Stand

Die lokale Vorlage `/home/mkt/Downloads/Westmark_3D.html` wurde für eine spätere Integration untersucht. Aktuell beauftragt sind Analyse und Texturbriefing, **noch keine Implementierung**, Änderung der bestehenden Karten oder zusätzlichen Spielregeln.

Prüfgrundlage: HTML-/Shader-/Geometriequellen, extrahierte Bild- und Layoutdaten, Abgleich mit Karten-/Material-/Oberflächenverträgen des Spiels. Zwei gezielte Ansichten der unveränderten Vorlage über `file://` in Chromium/SwiftShader zeigten die Übersicht und das Brücken-/Ufermaterial; keine JavaScript-Seitenfehler und keine beobachteten externen HTTP(S)-Requests. Kein Build, keine Spieltests, keine KI-/Simulationsläufe und kein Echtgeräte-Performancenachweis. Visuelle Abnahme bleibt beim Menschen.

Identifikation der untersuchten Vorlage: Titel „Westmark · Die vier Banner“, SHA-256 `3e598becfc97bfd0db17cb5ff9ce8b3875d21fa9117f34eaa00f76d50eda93cd`.

## Texturbedarf

Die Vorlage enthält bereits Wiese, Granit, Erde und Rinde als 2048²-Albedos samt Normalmaps, ein freigestelltes Fichtenzweigmotiv (1024²) und eine Rauchmaske (256²). Eine vollständige Neugenerierung ist nicht erforderlich. Die vorhandenen Desert-Materialien sind farblich kein geeigneter Ersatz; gemeinsam verwendete Spielassets nicht überschreiben.

Sinnvolle Ergänzungen: kartenspezifischer Tageshimmel als Alternative zum prozeduralen Vorlagenhimmel und optional verwittertes Bauholz statt Baumrinde an Plattformen/Leitern. Separater Werkstein für Brücken ist optional. Wasser-Normalen, Bannerzeichen und Schnee sind in der Vorlage prozedural beziehungsweise shaderbasiert; dafür zunächst keine Bildproduktion.

Das angeforderte **temporäre** Bildbriefing mit Einzelprompts und lokalen Bildreferenzen liegt unter `.tmp/westmark-integration/texture-prompts.md`; es wird nicht versioniert und ist kein dauerhafter Vertrag. Vor öffentlicher Übernahme Herkunft/Nutzungsfreigabe der eingebetteten Bilder klären. Kanonische Bildpflege gemäß [Rendering](../rendering.md#texturen-und-portraits).

## Belegte Integrationsgrenzen

- **Eigenständige Landschaftsstudie, keine Spielkarte:** 960 × 960 Vorlageneinheiten, 769² Höhensamples, vier Bannerplätze, zehn Wegpolylinien, zwei Flusszüge mit Wasserfällen, drei Steinbrücken und acht Leuchtfeuertürme. Ressourcen, Bauflächenvalidierung, Navigation und spielwirksame Hindernisse fehlen. Das offene Talzentrum und die natürlichen Übergänge sind wichtige Gestaltungselemente, nicht automatisch faire Spielwege.
- **Maßstab und bebaubare Flächen:** Kartenmaße nicht blind übernehmen oder gleichmäßig schrumpfen. Brückendecks sind in der Vorlage nur 7,1 Einheiten breit; Verkleinerung verschärft Körperfreiraum und Gegenverkehr. HQ, Anfangsressourcen, Vents und Produktionsausgänge brauchen ausreichend ebene Reserven an allen vier öffentlichen Startkandidaten. Ressourcenmengen nicht aus der Dekoration ableiten.
- **Autoritative Daten:** Die Höhe ist in R/G des eingebetteten Rasters kodiert (`(R*256+G)/65535*320-64`); die Materialmaske steuert Weg/Fels/Schnee/Wiesenvariation. Datenraster nicht wie Albedos verlustbehaftet nach WebP Q80 konvertieren. Für Browser und Node-Host dieselben präzisen CPU-Daten bereitstellen, nicht die Simulation von Canvas-Bilddecodierung abhängig machen. Vorlagen-Sampling ist bilinear, die gezeichneten Geländedreiecke haben zudem eine andere Diagonale als `BattlefieldSurface`; für die Integration einen gemeinsamen Dreiecksvertrag festlegen.
- **Höhenbereich und Startsuche:** Aus den Vorlagendaten ergeben sich ungefähr −33,62 bis +150,50 Einheiten, die Starts liegen um +16. `battlefieldStartSites` akzeptiert bei vorhandener Oberfläche derzeit nur Plätze nahe `surface.maxHeight`. Die Berge dürfen daher nicht ungeprüft zum Maximum der spielbaren Oberfläche werden. Auch Luftfahrt orientiert sich daran; Terrain-Picking in `BattlefieldSurface.ray` grenzt den Höhenbereich derzeit auf 0 bis Maximum ein. Negative Höhen, Bergkulisse und spielbare Ebenen benötigen eine ausdrückliche Lösung, keine stillschweigende Änderung des Mothership-Vertrags.
- **Flüsse und Brücken:** Der [Oberflächenvertrag](../architecture.md#welt-darstellung-und-zufall) erlaubt genau eine begehbare Höhe je `x/z`. Vorschlag für einen ersten Stand: Wasser für Bodeneinheiten gesperrt, nur Brückendecks begehbar, keine Unterführungen. Deck, Uferanschluss, Sperrflächen, Picking und Bauverbote müssen gemeinsam modelliert werden. Brücken sind in der Vorlage nur Rendergeometrie; sie werden nicht durch Kopieren begehbar. Vorschlag bedarf Freigabe.
- **Materialumfang:** Das Spiel besitzt noch keine Westmark-Materialauswahl, Gelände-Splatmaske, Foliage-UV-/Alpha-Cutout-Pipeline oder vergleichbaren Wasserpass. Die Vorlage verwendet Normalmaps, Wasserreflexion/-brechung, HDR-/Atmosphärenlogik und zusätzliche Licht-/Partikeleffekte. Diese nicht als beiläufigen Komplettaustausch des Spielrenderers übernehmen. Materialprofile und Texturresidenz gezielt erweitern; `file://` und Einbettung erhalten.
- **CPU-/GPU-Trennung und Kosten:** Die Vorlage reduziert Baum-/Felszahlen bei Software-WebGL und verwendet einen gemeinsamen festen Zufallsstrom für verschiedene Dekorationen. Das darf keine autoritative Kollision oder Ressourcenverteilung im Spiel steuern. Feste Blocker unabhängig von GPU/Qualität und kosmetischen Zufallsaufrufen bestimmen. Terrain-LOD, Nadel-Overdraw, Schattenwiederholung und Wasserreflexion benötigen ein begrenztes Budget; Standalone-Detailzahlen nicht unverändert zusagen.
- **Ladevertrag:** Neues Rezept und Terrainmodelle deklarativ anbinden; Kartenkatalog, Typen, `index.html`, VM-Skriptgruppen und die explizite CPU-Bundleliste in `server/scripts/build.mjs` berücksichtigen. Keine CDN-/Laufzeit-Imports und kein direkter Rendererzugriff aus der Simulation.

## Vor Umsetzung entscheiden

1. Westmarks Grundriss und alpinen Stil beibehalten; endgültigen Spielmaßstab, ebene Startreserven und freie Haupt-/Flankenwege festlegen.
2. Wasser als Bodensperre und Brücken als einzige Querungen bestätigen oder andere Übergänge ausdrücklich gestalten; keine neue Mehr-Ebenen-Navigation voraussetzen.
3. Rolle der Banner, Steinkreise und Leuchtfeuer klären: zunächst reine Landschaftsdekoration oder gewünschte andere Gestaltung. Keine Capture-/Sicht-/Ressourcenmechanik daraus ableiten.
4. Renderziel für den ersten Stand festlegen: vorhandene Albedos/Alpha, eigener Tageshimmel, begrenztes Wasser; Normalmapping und volle Standalone-Effekte separat bewerten. [Höhen-Sichtstufen](hoehenstufen/README.md) für Westmark ausdrücklich festlegen, nicht ungeprüft aus jeder Geländeunebenheit ableiten.

## Spätere Prüfung nach Implementierungsfreigabe

Build und gezielte Terrain-/Höhen-/Navigation-/Ladeprüfungen, insbesondere alle vier Starts, ebene Wirtschaft, Brückenanschlüsse, Körperfreiraum, Wasser-/Klippenbarrieren und unveränderte bestehende Karten/RNG-Verträge. Standardtestsuite wegen gemeinsamer Oberflächen-/Ladeverträge erst nach Integration durch den Hauptagenten. Bei Multiplayer-Anbindung auch CPU-Bundle und Client-/Server-Geländeidentität prüfen. KI-/Simulationslangläufe nur mit ausdrücklichem aktuellem Nutzerauftrag. Menschliche Brücken-/Sicht-/Darstellungs- und Mobilabnahme bleibt erforderlich; [Prüfverfahren](../testing.md).
