# Westmark: Texturen und Abnahme des ersten spielbaren Stands

## Auftrag und Stand

Auf den Analyseauftrag folgte die Freigabe, Westmark mit den vorhandenen Materialien, passenden Ressourcen und fahrzeugtauglich verbreiterten Brücken einzubauen. Die vierte Karte ist im Katalog, in Expeditionen und in der Multiplayer-Kartenauswahl angebunden. Bestehende Karten, gemeinsame Bildassets und Ressourcenmengen wurden nicht umgestaltet.

Für einen isolierten menschlichen Test nach dem Build `index.html?experiment=westmark` öffnen: zwei eigene Worker, flüchtiges Profil und flüchtiger Expeditionscheckpoint. Kein automatischer Abnahmelauf. Im Multiplayer müssen Client und Server gemeinsam neu gebaut und ausgerollt werden.

## Grundlage und bewusste Anpassungen

Lokal gelieferte Vorlage: Titel „Westmark · Die vier Banner“, SHA-256 `3e598becfc97bfd0db17cb5ff9ce8b3875d21fa9117f34eaa00f76d50eda93cd`. Die Integration setzt den ursprünglichen Downloadpfad nicht voraus.

Die eigenständige Landschaftsstudie besaß keine Ressourcen-, Bau- oder Navigationslogik. Der Spielstand ist deshalb keine unveränderte Rendererübernahme:

- Grundriss, Wege und Flusszüge stammen aus der Vorlage, auf ein Drittel des horizontalen Maßstabs verkleinert. Das Tal besitzt ebene Basis-/Wirtschaftsreserven an vier öffentlichen Starts und acht Ressourcenbereiche mit normaler Kristall-/Vent-Erzeugung. Kernwege und Brückenzufahrten bleiben von neuen Baum-/Felsblockern frei.
- Die drei Steinbrücken haben 22 Einheiten breite Decks mit konservativ gesperrten Brüstungen und freiem Gegenverkehr. Wasser blockiert Bodeneinheiten; nur Brücken queren die Flüsse. Auf und unmittelbar an den Brücken keine Fundamente, keine Unterführungen oder zerstörbaren Brücken. Technischer Vertrag: [Welt und Oberfläche](../architecture.md#welt-darstellung-und-zufall).
- Das RG16-Höhenfeld wurde von 769² auf 129² numerische Stützstellen reduziert, nicht als verlustbehaftetes Bild gespeichert. Das Rezept nivelliert Wirtschaftsflächen und hält die gesamte spielrelevante Oberfläche oberhalb null; ein ausdrückliches Startdatum verhindert HQ-Suche auf Berggipfeln. Außenberge gehören zur Kulisse. Westmark verwendet vorerst überall die logische Sichtstufe null, keine neuen Höhen-Sichtregeln.
- Die ursprünglichen Bäume/Felsen sind feste, seedabhängige CPU-Blocker, unabhängig von Grafikqualität und kosmetischem Zufall. Zusätzliche kleinere Fichten verdichten diese Baumgruppen: höchstens zwei pro bestehendem Baum, nur mit vollständig in bereits gesperrten Zellen liegendem Stammfuß und außerhalb geschützter Zugänge. Ein eigener kosmetischer Zufallsstrom nach allen festen Platzierungen erhält bestehende Blocker, Ressourcen, Felsen und freie Wege. Leuchtfeuer sind Landschaftsdekoration ohne Capture-, Sicht- oder Ressourcenwirkung; geschützte Flächen dürfen Vorlagenobjekte verdrängen.
- Darstellung mit prozeduralen Oberflächenrezepten aus [Project Tomorrow](project-tomorrow.md), alpha-getesteten Zweigen, prozeduralem Tageshimmel und tiefenabhängig transparentem Wasser. Die Brücken besitzen modelliertes Pflaster, Brüstungsmauerwerk, Abdecksteine und Bogensteine; die Fahrbahn bleibt unter der CPU-Deckhöhe. Feuchtes Sediment, Kiesvariation und teilweise versunkene Steingruppen gliedern die Ufer. Dekosteine liegen vollständig auf bestehenden Sperrzellen, abseits der Brückenzufahrten und Wirtschaftsreserven. Mikrorelief wird in High/Balanced aus der gebackenen Materialhöhe berechnet; keine vollständige Standalone-Atmosphäre oder GPU-abhängige Landschaftsverteilung. [Material- und Rendervertrag](../rendering.md#terrain-und-renderpässe).

## Offene Textur- und Darstellungsarbeit

- [ ] Prozedurale Wiese, Granit, Erde und Rinde auf Kachelung, Maßstab, Mikrorelief und Übergänge menschlich abnehmen. Die gelieferte Wiesen-WebP bleibt als Quelle erhalten, ist aber kein aktives WebGL-Albedo mehr. Der Fichtenzweig ist weiterhin das unveränderte Bildasset. Die gemeinsame Umstellung ist Teil von [Project Tomorrow](project-tomorrow.md); weitere Westmark-Gestaltung nicht unbemerkt auf andere Materialien ausweiten.
- [ ] Vor öffentlicher Weitergabe Herkunft/Nutzungsfreigabe der eingebetteten Vorlagenbilder klären.
- [ ] Wasser-/Uferdarstellung und Brückendetails menschlich abnehmen. Flussgabeln verwenden nun ein gemeinsames, überlappungsfreies Wassergitter; das Alpha-Blending erhält den sichtbaren Grund und versunkene Steine. Wasserfälle bleiben geneigte Wasserflächen mit prozeduralem Schaum, ohne Spritzwasserpartikel, Brechung oder echte Szenenreflexion. Diese Erweiterungen bei Bedarf separat beurteilen, nicht mit neuen Wasser-Navigationsregeln verbinden.
- [ ] Verdichtete Fichtenkronen und Baumgruppen menschlich abnehmen: überlappende Astquirle und gekreuzte Zweigflächen füllen die Kronen, kleinere Begleitbäume lockern die zuvor vereinzelten Standorte auf. Der gezielte `file://`-Check in Chromium/SwiftShader (Balanced) zeigte keine WebGL-/JavaScriptfehler. Für drei Seeds bestätigte ein Vorher-/Nachher-Abgleich identische Terrain-/Bauraster, Höhen, Ressourcenlayout und ursprüngliche Platzierungen. Zusätzliche Alpha-Überzeichnung und Schattengeometrie auf Mobilgeräten noch prüfen.
- [ ] Tal-/Bergübergänge, Kulisse am Kartenrand und Tageslicht menschlich abnehmen. Die Karte ist bewusst gröber als die Standalone-Vorlage; Kameraverdeckung und mobile GPU-Kosten separat bewerten.

Nach Bildänderungen die [Einbettung aus den kanonischen Quellen](../rendering.md#texturen-und-portraits) neu erzeugen. Höhen-/Materialdaten bleiben numerisch; keine WebP-Komprimierung technischer Masken. Frühere temporäre Bildbriefings sind kein dauerhafter Vertrag.

## Prüfung und verbleibende Spielabnahme

Gezielte CPU-Prüfungen belegen für drei Seeds die Verbindung aller vier Startbereiche und Ressourcen mit Fahrzeugfreiraum. Brückentests prüfen beide Fahrtrichtungen mit Panzerkörpern, Zufahrten, Brüstungen und Bauverbot; Wasser bleibt auch bei geleertem temporären Belegungsraster gesperrt. Vierparteien-Initialisierung prüft Standardvorkommen und bodengebundenen Arbeiterzugang. Geometrie-/Texturprüfungen prüfen endliche, budgetierte Meshes, gemeinsame CPU-Dreiecke, Deck-Picking, deterministische Blocker und die eingebetteten Bildbytes.

Client- und Serverbuild, ZIP-Build samt Westmark-Skript-/Assetvergleich, abschließende Standardtestsuite und kurze Server-Sitzungstests einschließlich Westmark waren zum Integrationsstand erfolgreich. Der technische `file://`-Check in Chromium/SwiftShader meldete auf allen drei Qualitätsstufen keine WebGL-/JavaScriptfehler; Deck-Picking und Texturfreigabe beim Profilwechsel funktionierten, keine externen HTTP(S)-Requests. Die Autoplay-Audiowarnung ohne Nutzergeste ist erwartbar. Diese historischen Diagnosen sind keine Echtgeräte-Performanceabnahme.

Der gezielte technische Brücken-/Flussgabel-Check über `file://` bestätigte nach der Überarbeitung fehlerfreies WebGL auf allen Qualitätsstufen und Deck-Picking. Für drei Seeds blieben CPU-Höhen, Sperr-/Bauraster, Ressourcenlayout, feste Hindernisse und Baumplatzierungen im Vorher-/Nachher-Abgleich identisch. Synthetische Wassergeometrieprüfungen sichern einfache Flächendeckung, trockene Bereiche und beschnittene Ufer; der Pass-Test prüft Blending nach deckender Geometrie und vor Effekten. Das ist keine menschliche Wasser-/Material- oder Mobilabnahme.

- [ ] Menschlicher Test von Basisbau, Produktionsausfahrten, tatsächlichem Minenverkehr und größeren Fahrzeuggruppen an allen Brücken; anschließend gewünschte Proportionen und Erweiterungsflächen bestätigen. Geometrische Erreichbarkeit ist kein Nachweis fairer Rush-Distanzen oder stabilen Gruppenverkehrs.
- [ ] Zwei-Client-Test mit neu gebautem Server und mobile Darstellungs-/Performanceabnahme. Bestehende Übergabe: [Multiplayer-Karten](multiplayer-karten-und-darstellung.md).
- [ ] KI-/Simulations-Langläufe nur auf ausdrücklichen aktuellen Nutzerauftrag; bislang nicht ausgeführt. Kein Balancing-/Langzeitnachweis aus den begrenzten Tests ableiten; [Prüfverfahren](../testing.md).
