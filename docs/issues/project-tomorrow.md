# Landschaften, Materialien und offene Abnahme

Inspiration: [Project Tomorrow · How To Make A Big Game (Alone)](https://www.youtube.com/watch?v=KuWTf7KrF6Y). Ziel sind abwechslungsreiche, wiederverwendbare Welt-/Materialrezepte mit gut lesbarer Darstellung und tragbaren Zielgerätekosten, keine zweite Engine. Nächste Prioritäten: [Projektfahrplan](projektfahrplan.md).

## Umsetzung und Abnahme

Alle sieben Karten verwenden die gemeinsame CPU-Oberfläche und eigene seedbasierte Weltfamilien; Haven ist ein festes Design. Maßgebliche Verträge: [Weltrezepte und feste Designs](../architecture.md#weltrezepte-und-feste-designs), [Materialpflege](../rendering.md#prozedurale-oberflächen), [Landschaftszonen und Wetter](../rendering.md#landschaftszonen-und-wetter). Isolierte Vergleichsstarts stehen im [README](../../README.md#landschaftsvarianten-auf-allen-karten).

Die technische Umsetzung ersetzt weder menschliche Darstellungskontrolle noch Messungen auf Zielgeräten. Reale Höhen können örtliche Wege/Bauflächen verändern; rein kosmetische Variation darf weder Navigation noch Gefechts-RNG verschieben. Kein weiterer Engine-/ECS-/Workerumbau oder pauschaler Assetersatz allein aus dem Inspirationsvideo.

## Alien Planet: markante Großformen

Nutzerfeedback zur Glassteppe: Die große Fläche wirkte trotz Pflanzenvariation leer. Bergzüge und aufgebrochene Kraterränder gliedern nun die Landschaft unabhängig von den acht Habitatfamilien. Vergleich: `experiment=alien-planet&seed=9` (Glassteppe/Bergzüge) und Seed `7` (Pilzlandschaft/Kraterrand).

- [ ] Räumliche Gliederung, Bergsilhouetten, Material-/Pflanzenauflage an steilen Flanken, Einheitenverdeckung, Bauflächen und faire Umwege menschlich abnehmen. Besonders Glassteppe bei normalem Zoom/Nebel prüfen. Erhaltene Pflanzenpositionen und technische Erdung sind keine künstlerische Abnahme der Hangvegetation; Mobilkosten und KI-/Balance-Langläufe bleiben separat offen.

## Flugfreiraum nach dem Reliefausbau

Flugzeuge und Zerstörer verwenden lokale Terrain-Freiraumhüllen statt globaler Gipfelhöhe oder Bodennachführung. [Höhenadapter und Grenzen](../architecture.md#welt-darstellung-und-zufall).

- [ ] Flugbahnen über Bergen, Tälern und Decks sowie während der Produktion menschlich abnehmen: Bodenabstand, Verhältnis Flugzeug/Zerstörer und An-/Abstiege. Die Hüllen schützen vor CPU-Terrain, nicht automatisch vor hohen Dekorbauten/Baumkronen oder separater Außenkulisse. Planare Kampf-/Sichtregeln bleiben davon unabhängig.

## Noch nicht erreicht / Abnahme

- [ ] Den ursprünglich gemeldeten verdeckten Echo-Vent im Spiel erneut mit einer Raffinerie belegen und Bauabschluss prüfen. Vorschau und Bauklick verwenden inzwischen erkundete Vent-Silhouetten, ohne Vorrang überlagerter Einheiten; Originalkarte/Seed fehlen. Isolierte Eingabeprüfungen sind keine Reproduktion genau dieses Screenshots.
- [ ] [Bauflächenanzeige](../rendering.md#terrain-und-renderpässe) visuell und auf Mobilgeräten prüfen: feinmaschige Linien bei durchsichtigem Boden, Übergänge auf Hängen/an Hindernissen, Sichtgrenzen, Raffinerie-Vents, Klickvorschau und Kosten bei Kamerabewegung. Zwischen Validierungsproben ist die Farbe nur Orientierung; die Klickvorschau bleibt maßgeblich.
- [ ] [Kontursilhouetten](../rendering.md#kontursilhouetten-bei-verdeckung) menschlich abnehmen: erkundete Ressourcen und beobachtete Einheiten/Gebäude hinter Bergen, Kronen und statischer Stadtgeometrie; Parteienfarben, normaler Zoom, dichte Gruppen und alle Qualitätsstufen. Intro/Fog dürfen keine Beobachtungsfreigabe erzeugen. Dynamische Gebäude/Armeen und nicht tiefenschreibende Transparenz sind bewusst keine Auslöser. Mobilkosten bleiben offen.
- [ ] Materialstil, Kachelmaßstab, Wiederholung und Einheiten-/Boden-/Minimap-Kontrast auf allen Karten und in Modellvorschauen beurteilen. Insbesondere [Desert](desert-map.md), [Westmark](westmark-map.md) und [Mothership](terrain.md) neu ansehen.
- [ ] FPS, Latenz, Start-/Kartenwechselzeit und Thermik auf echten Zielgeräten in vergleichbaren Szenen messen. Weniger Texturspeicher oder Allokationen garantieren keine bessere Gesamtperformance. [Messplan](mobile-performance.md#messplan-und-abnahme).
- [ ] Frontier/Haven spielen: begehbare Hänge/Senken, Bauflächen, vier Parteien, faire Wege/Ressourcenzugänge auf verschiedenen Größen, Nacht-/Dämmerungskontrast, Geländeübergänge und Fernkulisse. Worker, Panzer und Artillerie bergauf, bergab und quer zum Hang einschließlich Kuppen/Rampen beurteilen. Konstruktionstests ersetzen keine Langzeit-KI-/Balanceprüfung. Multiplayerfreigabe anschließend gesondert entscheiden.
- [ ] Regen/Schnee erneut menschlich prüfen. Nutzerfeedback verwarf verstärkte Regenstriche als zu simpel/dominant. Aktuell: weiche transparente Fäden ohne Emission, räumliche Staffelung, wechselnde Landeplätze und wenige Gelände-Auftreffbögen; Schnee mit weichen unregelmäßigen Flocken. Eindruck in Bewegung, Zurückhaltung auf hellen/dunklen Böden und Mobilkosten bleiben offen.
- [ ] [Kampfakzente](../rendering.md#lichtanimation-und-kampfakzente) menschlich abnehmen: fraktionsspezifische Tracer/Samen-/Energiesignaturen, Explosionskörper und kurzlebige Brandflecken bei Gefechtszoom und auf Zielgeräten. Sicht-, Simulationszeit- und Speicherbudgets erhalten; diese Darstellung ist unabhängig von Startaufgeboten und verändert keine CPU-Effektwerte oder RNG-Folgen.
- [ ] Alle Weltfamilien vergleichen: Aliens Silhouetten und Unterwuchs-/Wegbezug, Westmarks Jahreszeiten/Flusssediment, Schiffsaufbauten und Aurelions Deckbeleuchtung, Anzeigen, Wolken und Verkehr. Deserts Innen-/Außenanschluss bei weitem Zoom begutachten. Unterschiedliche Geometrie ist noch keine künstlerische Abnahme.

## Offene Folgeentscheidungen

- Spieler-Favoriten-/Exportoberfläche: mögliche Folgearbeit, kein vorhandenes Feature. Mit [Skirmish-Regeln](new-battle-screen.md) abstimmen.
- Regelbasierte Ersetzung noch verwendeter Himmel-/Zweig-/Dekorbilder: nur nach konkreter Stilentscheidung. Neue Ökologiefamilien ersetzen Westmarks Fichten oder Desert-Atlanten nicht automatisch; Silhouetten, Transparenz und freigegebene Bildquellen erhalten.
- Strategische Topologievariation oder weitere Mission erst nach Spielrückmeldung entscheiden; [Holdout](expeditions-missionsziele-und-holdout.md) bleibt ein eigener Regelauftrag.
