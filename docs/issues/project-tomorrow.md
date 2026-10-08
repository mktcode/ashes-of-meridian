# Landschaften und taktische Darstellung: offene Abnahme

Welt-/Materialrezepte sind integriert. Technische [Weltgrenzen](../architecture.md#weltrezepte-und-feste-designs) und [Grafikpflege](../rendering.md) sind maßgeblich; kein weiterer Engineumbau aus dieser Liste.

## Alien Planet: markante Großformen

Glassteppe wirkte laut Nutzer trotz Pflanzenvariation leer. Seedbasierte Großformen sind integriert; die frühere feste Geografie ist keine Vorgabe mehr. Vergleich nach Build: `experiment=alien-planet&seed=9` (Glassteppe/Bergzüge), Seed `7` (Pilzlandschaft/Kraterrand).

- [ ] Großformen, rundere Kuppen zwischen Weg-/Bauschultern statt pyramidenartiger Grate, Hangvegetation/-material, Verdeckung, Bauflächen und faire Umwege bei normalem Zoom/Nebel beurteilen. Technische Erdung ist keine künstlerische Abnahme.

## Mothership: prozedurale Industrieflächen

- [ ] Terrassierte Metallflächen als Teil eines großen industriellen Trägers erkennbar statt als beliebige Metallarena? Maschinen-/Hangarsilhouetten, nicht begehbare Außenkulisse, Metallalterung, Schnee/Asche und Einheitenkontrast bei normalem Zoom beurteilen. Der aktuelle gemeinsame Generator und seine Dekoration sind maßgeblich, kein Wiederaufbau des früheren festen Deck-/Brückengrundrisses.
- [ ] Verdeckung an Aufbauten und Terrassenrändern; Rampen, Wirtschaft und Sicht zentral unter [Höhenabnahme](hoehenstufen/README.md).

## Flugfreiraum nach dem Reliefausbau

- [ ] Flugzeug-/Zerstörerhöhe, An-/Abstieg über Bergen/Tälern/Decks und Produktionsausfahrt abnehmen. CPU-Hülle schützt nicht automatisch vor hohen Dekorbauten, Baumkronen oder Außenkulisse.

## Noch nicht erreicht / Abnahme

- [ ] Gemeldeten verdeckten Echo-Vent erneut mit Raffinerie belegen und Bau abschließen; Originalkarte/Seed fehlen. Silhouetten-Zielklick ist integriert, Originalfall nicht reproduziert.
- [ ] Seedabhängig hohe Vegetationsdichte einschließlich eng gestaffelter Kronen und verstreuter niedriger Büsche bei normalem Zoom/Nebel visuell und auf Zielgeräten abnehmen; insbesondere Verdeckung dichtester Seeds prüfen; Gerätekosten zentral unter [Performance](performance/README.md#renderer-und-gpu); große Pflanzen bleiben auf vorhandenen Sperrflächen, mehr befahrbarer Bodendekor ersetzt keine neuen Waldhindernisse. Frontier-Seed `3` wurde mit erhöhter Dichte über die echte Chromium-Auslieferung ohne GL-/Seitenfehler geöffnet; keine Framerate-/Allseedabnahme.
- [ ] Bauflächenlinien: Hang-/Blockerübergänge, Sichtgrenzen, Vents und Klickvorschau; Kosten zentral unter [Performance](performance/README.md#bauplatzraster). Farbe zwischen Validatorproben bleibt nur Orientierung.
- [ ] Kontursilhouetten: normaler Zoom, Parteienfarben, dichte Gruppen und Verdeckung durch statische Berge/Kronen/Stadt. Keine Sichtfreigabe durch Intro/Fog.
- [ ] Materialmaßstab/-wiederholung, Boden-/Einheiten-/Minimap-Kontrast der sechs prozeduralen Weltfamilien vergleichen; [Desert](desert-map.md), [Westmark](westmark-map.md), [Mothership](#mothership-prozedurale-industrieflächen).
- [ ] Begehbare Hänge, Fahrzeug-Hanglage, verteilte Ressourcen/Bauflächen und faire Wege verschiedener Größen; Nachtkontrast/Fernkulisse. Start-/KI-Abnahme zentral unter [prozeduralen Gefechten](procedural-battlefields.md).
- [ ] [Startbildschirm-Himmel](../rendering.md#menü-landschaftswechsel): fremde Farbpaletten, Sternpunktgrößen, Planeten-/Sonnenwirkung und Menülesbarkeit visuell abnehmen. Gezielter Chromium-Check deckt atmosphärische und Weltraumvariante, Shaderkompilierung, schmales Seitenverhältnis und Ressourcenfreigabe beim Menüausstieg ab; keine Echtgeräte-/Performanceabnahme.
- [ ] [Tageszyklus](../architecture.md#weltrezepte-und-feste-designs): Morgen-/Abendübergänge und Nachtlesbarkeit aller Familien/Fraktionen auf Zielgeräten abnehmen; die deutlich dunklere Nachtfüllbeleuchtung und stärkere nächtliche Bloom-Einblendung zusammen mit den [Einheiten-/Gebäude-Lichtakzenten](modelle.md) insbesondere auf dunklen Displays prüfen. Gezielter lokaler Chromium-Check mit arrangierter Desert-Basis, Seed `1415`, bestätigte Mittags-/Mitternachts-Uniforms, Pause/Fortsetzung und fehlerfreie WebGL-Ausgabe; kein Nachweis für dunkle Displays oder alle Wetter-/Materialkombinationen.
- [ ] Regen/Schnee in Bewegung: zurückhaltend statt dominant/simple Striche; Nutzer beanstandete frühere verstärkte Regenfassung. Aktuelle Fäden/Flocken erneut sichten.
- [ ] Bloom, Lichtanimation, Tracer/Funken/Explosionen/Staub und Brandflecken im Gefecht abnehmen, kein flächiges Bodenleuchten. Nächtliche Bloom-Verstärkung und die [lokalen Modelllichter aller Fraktionen](modelle.md) besitzen gezielte Uniform-/Pass-/Ressourcen- und Modellverträge. Künstlerische und Zielgeräteabnahme bleiben offen; insbesondere räumliche Lichtzuordnung bei dichten Basen/Armeen und Lichtdurchtritt ohne lokale Schatten prüfen.

Gerätekosten zentral unter [Performance](performance/README.md), vollständiges Spielen unter [Run-Abnahme](playtest-validation.md). Keine automatisch beauftragten Langläufe. Favoriten/Export mit [Skirmish](new-battle-screen.md) entscheiden; weitere Assetersetzung und Topologie-/Missionsänderung brauchen eigene Freigabe.
