# Westmark: Texturen und Abnahme des ersten spielbaren Stands

## Auftrag und Stand

Auf den Analyseauftrag folgte die Freigabe, Westmark mit den vorhandenen Materialien, passenden Ressourcen und fahrzeugtauglich verbreiterten Brücken einzubauen. Die vierte Karte ist im Katalog, in Expeditionen und in der Multiplayer-Kartenauswahl angebunden. Bestehende Karten, gemeinsame Bildassets und Ressourcenmengen wurden nicht umgestaltet.

Für einen isolierten menschlichen Test nach dem Build `index.html?experiment=westmark` öffnen: zwei eigene Worker, flüchtiges Profil und flüchtiger Expeditionscheckpoint. Kein automatischer Abnahmelauf. Im Multiplayer müssen Client und Server gemeinsam neu gebaut und ausgerollt werden.

## Grundlage und bewusste Anpassungen

Vorlage: `/home/mkt/Downloads/Westmark_3D.html`, Titel „Westmark · Die vier Banner“, SHA-256 `3e598becfc97bfd0db17cb5ff9ce8b3875d21fa9117f34eaa00f76d50eda93cd`.

Die eigenständige Landschaftsstudie besaß keine Ressourcen-, Bau- oder Navigationslogik. Der Spielstand ist deshalb keine unveränderte Rendererübernahme:

- Grundriss, Wege und Flusszüge stammen aus der Vorlage, auf ein Drittel des horizontalen Maßstabs verkleinert. Das Tal besitzt ebene Basis-/Wirtschaftsreserven an vier öffentlichen Starts und acht Ressourcenbereiche mit normaler Kristall-/Vent-Erzeugung. Kernwege und Brückenzufahrten bleiben von neuen Baum-/Felsblockern frei.
- Die drei Steinbrücken haben 22 Einheiten breite Decks mit konservativ gesperrten Brüstungen und freiem Gegenverkehr. Wasser blockiert Bodeneinheiten; nur Brücken queren die Flüsse. Auf und unmittelbar an den Brücken keine Fundamente, keine Unterführungen oder zerstörbaren Brücken. Technischer Vertrag: [Welt und Oberfläche](../architecture.md#welt-darstellung-und-zufall).
- Das RG16-Höhenfeld wurde von 769² auf 129² numerische Stützstellen reduziert, nicht als verlustbehaftetes Bild gespeichert. Das Rezept nivelliert Wirtschaftsflächen und hält die gesamte spielrelevante Oberfläche oberhalb null; ein ausdrückliches Startdatum verhindert HQ-Suche auf Berggipfeln. Außenberge gehören zur Kulisse. Westmark verwendet vorerst überall die logische Sichtstufe null, keine neuen Höhen-Sichtregeln.
- Bäume/Felsen sind feste, seedabhängige CPU-Blocker, unabhängig von Grafikqualität und kosmetischem Zufall. Leuchtfeuer sind Landschaftsdekoration ohne Capture-, Sicht- oder Ressourcenwirkung; geschützte Flächen dürfen Vorlagenobjekte verdrängen.
- Darstellung zunächst mit vorhandenen Albedos, alpha-getesteten Zweigen, prozeduralem Tageshimmel und vereinfachtem Wasser. Kein Normalmapping, keine vollständige Standalone-Atmosphäre oder GPU-abhängige Landschaftsverteilung. [Material- und Rendervertrag](../rendering.md#terrain-und-renderpässe).

## Offene Textur- und Darstellungsarbeit

- [ ] Die vom Nutzer erzeugten Ergänzungen übernehmen und menschlich beurteilen. Sinnvoll zuerst Tageshimmel und verwittertes Bauholz; eigener Brücken-Werkstein optional. Wiese, Granit, Erde, Rinde und Fichtenzweig existieren bereits unter `assets/textures/texture-westmark-*.webp` als WebP Q80. Keine gemeinsam verwendeten Desert-Materialien überschreiben.
- [ ] Vor öffentlicher Weitergabe Herkunft/Nutzungsfreigabe der eingebetteten Vorlagenbilder klären.
- [ ] Flussgabel und Wasserfälle nacharbeiten: getrennte Wasserstreifen besitzen an der Einmündung noch eine sichtbare Schaum-/Materialnaht; Fälle sind im ersten Stand nur abfallende, animierte Wasserbänder. Eine geometrische Vereinigung ist ein möglicher nächster Schritt, nicht eine neue Wasser-Navigationsregel.
- [ ] Verdichtete Fichtenkronen menschlich abnehmen: überlappende Astquirle und gekreuzte Zweigflächen füllen die bisher kargen Kronen innerhalb der bisherigen Baumhülle. Baumanzahl, Standorte, Blocker und Textur bleiben unverändert. Der gezielte `file://`-Vergleich in Chromium/SwiftShader (Balanced) zeigte keine WebGL-/JavaScriptfehler; zusätzliche Alpha-Überzeichnung und Schattengeometrie auf Mobilgeräten noch prüfen.
- [ ] Bestandsdichte, Tal-/Bergübergänge, Brückenproportionen, Kulisse am Kartenrand und Tageslicht menschlich abnehmen. Die Karte ist bewusst gröber und dünner bewaldet als die Standalone-Vorlage; Kameraverdeckung und mobile GPU-Kosten separat bewerten.

Das temporäre Bildbriefing mit Einzelprompts liegt unter `.tmp/westmark-integration/texture-prompts.md`; es ist nicht versioniert und kein dauerhafter Vertrag. Nach Bildänderungen die [Einbettung aus den kanonischen Quellen](../rendering.md#texturen-und-portraits) neu erzeugen. Höhen-/Materialdaten bleiben numerisch; keine WebP-Komprimierung technischer Masken.

## Prüfung und verbleibende Spielabnahme

Gezielte CPU-Prüfungen belegen für drei Seeds die Verbindung aller vier Startbereiche und Ressourcen mit Fahrzeugfreiraum. Brückentests prüfen beide Fahrtrichtungen mit Panzerkörpern, Zufahrten, Brüstungen und Bauverbot; Wasser bleibt auch bei geleertem temporären Belegungsraster gesperrt. Vierparteien-Initialisierung prüft Standardvorkommen und bodengebundenen Arbeiterzugang. Geometrie-/Texturprüfungen prüfen endliche, budgetierte Meshes, gemeinsame CPU-Dreiecke, Deck-Picking, deterministische Blocker und die eingebetteten Bildbytes.

Client- und Serverbuild, ZIP-Build samt Westmark-Skript-/Assetvergleich, abschließende Standardtestsuite und kurze Server-Sitzungstests einschließlich Westmark erfolgreich. Der technische `file://`-Check in Chromium/SwiftShader meldete auf allen drei Qualitätsstufen keine WebGL-/JavaScriptfehler; Deck-Picking und Texturfreigabe beim Profilwechsel funktionierten, keine externen HTTP(S)-Requests. Die Autoplay-Audiowarnung ohne Nutzergeste ist erwartbar. Diagnosen unter `.tmp/westmark-implementation/` sind temporär und keine Echtgeräte-Performanceabnahme.

- [ ] Menschlicher Test von Basisbau, Produktionsausfahrten, tatsächlichem Minenverkehr und größeren Fahrzeuggruppen an allen Brücken; anschließend gewünschte Proportionen und Erweiterungsflächen bestätigen. Geometrische Erreichbarkeit ist kein Nachweis fairer Rush-Distanzen oder stabilen Gruppenverkehrs.
- [ ] Zwei-Client-Test mit neu gebautem Server und mobile Darstellungs-/Performanceabnahme. Bestehende Übergabe: [Multiplayer-Karten](multiplayer-karten-und-darstellung.md).
- [ ] KI-/Simulations-Langläufe nur auf ausdrücklichen aktuellen Nutzerauftrag; bislang nicht ausgeführt. Kein Balancing-/Langzeitnachweis aus den begrenzten Tests ableiten; [Prüfverfahren](../testing.md).
