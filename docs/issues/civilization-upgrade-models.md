# Upgrade-spezifische Zivilisationsgebäude: verbleibende Abnahme

Alle zwölf Stilfamilien mit je drei Rängen sind integriert: **36 spezialisierte Varianten**, fraktionsübergreifend geteilte Metallarchitektur. Unkonfiguriert bleibt ein Gebäude neutral; erst bestätigte Aktivierung, nicht Angebot/Modalöffnung, wechselt die Variante. Optik folgt gespeichertem `upgrade` und lokalem `upgradeLevel`, nicht dem aggregierten Run-Bonus. Regeln unter [Gameplay](../gameplay.md#wirtschaft-bau-und-produktion), Pflege unter [Rendering](../rendering.md#einzeln-wartbare-modelle) und [Grafik-Leitlinie](../graphics-guideline.md).

## Menschliche Designabnahme

- [ ] Alle zwölf Silhouetten und Rangfolgen im Spielshader vergleichen: Cinder-Kontor/Echo-Depot, Worker-Quartier, Bauplanungswerk, Logistikhaus, Reparaturhaus sowie Waffentechnik, Schutztechnik, Feldmedizin, Command-Akademie, Energieversorgung und Kommandantenkolleg. Besonders Cinder/Logistik, Echo/Energie, Bau/Reparatur und Command/Kommandant ohne Beschriftung oder Bloom unterscheiden.
- [ ] Neutrale und spezialisierte Modelle, gemischte dichte Siedlungen, Kameradrehungen, Tag/Nacht und High/Balanced/Performance ansehen. Große Baukörper, Dachmotive und Geschossstaffelung müssen auch im Gefechtszoom und niedriger Qualität erkennbar bleiben; keine Nachbarzugänge überlagern.
- [ ] Warmweiße Wohnfenster gegen cyanfarbene Forschung, kleine Funktionsakzente und zurückhaltendes Licht beurteilen. Cargo bleibt feste Dekoration auf eigenen Decks: Cinder-Kontor nur Cinder, Echo-Depot nur Echo; Waffentechnik zeigt einen statischen Panzer-Demonstrator, keine spielbare Einheit. Keine Animationen oder Gameplayfunktionen aus der Gestaltung ableiten.

## Verbleibende technische und Kostenfragen

- [ ] Aktivierung, Abbruch, echter Rangkauf und Save/Load im Spielfluss prüfen: richtige Familie/Größe in Welt, archivierter Menüszene, Auswahlporträt und Detailansicht; keine verschwundenen Meshes oder veralteten Kacheln. Generische Vorschauen bleiben neutral.
- [ ] Alle Familien/Ränge auf geneigtem und unebenem Terrain prüfen: vollständige Bounds einschließlich Effekten/Schatten/Picking, Deck-/Treppenauflage, bestehende Ausbauflächen und Zugänge, passende Kachelrahmung. Keine zweite Stützen-/Eingangslogik; vorhandene CPU-/Modellstützdaten bleiben maßgeblich.
- [ ] Wiederholtes Zeichnen/Laden und Variantenwechsel dürfen Entitäten, Konten, Lieferungen oder RNG nicht verändern. Modal-/Kachelansichten dürfen weder aktivieren noch liefern.
- [ ] Dieselbe neutrale und spezialisierte Vergleichsszene auf residente Meshbytes, Instanzen/Draws, Varianten-/Kachelwechsel und dichtes Nachtlicht prüfen. Geometrie einmal je Variante teilen, keine GPU-Ressourcen je Gebäude oder Geometrie je Frame. Lampen und kleine Details nicht pauschal vermehren. Kosten zentral unter [Performance](performance-und-mobilstabilitaet.md#renderer-und-gpu); Langläufe/Diagnose/Echtgerätechecks nur mit Erkenntnisziel und [Freigabe](../testing.md).

## Vorschau und Prüfgrenze

Nach Build `index.html?models=civilian-upgrades` öffnen. Die Galerie zeigt je Stil neutrales kleines Haus und Ränge 1–3. Klick öffnet die drehbare Codex-Ansicht, Ziehen dreht, Mausrad zoomt, **CODEX** führt zurück. Der explizite Aufruf nutzt flüchtigen Speicher statt des Spielprofils. Galerie/Studiovorschau ist keine Hang-/Nacht-/Performanceabnahme.

Vorhandene Modellchecks decken 36 Varianten, endliche Geometrie/Bounds, neutrale/familienfremde Fallbacks, Fraktionsgleichheit, gespeicherte Identität und Porträtwechsel ab; sie sind keine unimplementierte Restarbeit. Der bisherige `file://`-Check öffnete Galerie und neun neue Hochhaus-Detailansichten ohne Seiten-/GL-Fehler, nicht alle 48 Kacheln einzeln. Menschliche Spielbeleuchtungs-, Hang-, Siedlungs- und Zielgeräteabnahme bleibt offen.

Kein neuer Modellsatz, Savefeld, Migration, Fraktionsskin, Upgrade-Effekt oder Rerolling aus dieser Liste. Bestehende Decks/Grundflächen/Kollisionskörper und Größenwechsel erhalten; keine neue Terrainauffüllung oder Navigation. Balance, Kosten der Käufe und Rettungsregeln bleiben unter [Zivilisationsupgrades](civilization-upgrades.md).
