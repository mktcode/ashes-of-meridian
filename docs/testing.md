# Prüfungen

## Prüfaufwand

- **Dokumentation, minimale Text-/Rahmen-/Abstandsänderungen:** Diff sichten, bei Dokumentationsänderungen Links und Angaben prüfen; kein zusätzlicher Browserlauf nötig.
- **Mechanische, verhaltensneutrale JavaScript-/TypeScript-Kleinständerungen:** `npm run build` und Diff-Sichtung genügen, etwa bei einer lokalen Konstantenextraktion mit unverändertem Wert. Voraussetzung: keine Änderung an Logik, RNG-Aufrufreihenfolge, Schnittstellen oder Auswertungsreihenfolge; kein struktureller Umbau.
- **Sonstiger Spielcode oder Tests:** vollständiges `npm test` ausführen, passende Regressionstests ergänzen. Bei Änderungen an Spiellogik, RNG, Schnittstellen oder Tests sowie im Zweifel ist der vollständige Lauf Pflicht.
- **Eingabe, Layoutstruktur, Rendering oder Auslieferung:** zusätzlich gezielt direkt unter `file://` prüfen, insbesondere betroffene Touch-Aktionen und Portraitgrößen. Bei Änderungen am Webcontainer außerdem Image bauen, Healthcheck/MIME-Typen/404-Verhalten prüfen und die ausgelieferte Seite über HTTP öffnen. Keine vollständige Browser-Regressionsserie für jeden kleinen Schritt.
- Ergebnisse und ausgelassene relevante Bereiche kurz nur im [Arbeitsprotokoll](worklog.md) festhalten. Ältere Nachweise sind keine neu ausgeführten Tests.

## Automatisierte Tests

Nach einmaligem `npm install` baut und prüft ein Befehl die aktuelle Laufzeitausgabe:

```bash
npm test
```

Das Skript leert `dist/`, kompiliert die Quellen und führt anschließend die zehn fachlichen Node-Testdateien sowie `tests/models/*.check.cjs` gegen die erzeugten klassischen Skripte aus. Ein Testworker; 128 MiB begrenzen nur den JS-Heap, nicht den gesamten Prozessspeicher. Für einen erneuten reinen Build genügt `npm run build`.

Prüfzuständigkeiten klein halten: CPU-Simulationstests laden keinen Renderer und erzeugen keine Grafikmeshes, aber weiterhin echte Welten samt Massiv-Kollision. Einheitenregel-Szenarien isolieren den strategischen Controller; `tests/ashes-of-meridian-ai.check.cjs` verwendet dagegen echte Controller und reguläre Produktion. Kontrollierte Testaufstellungen sind keine privilegierten Startarmeen im Spiel. Worker-Stufen 0–5 werden für jede Fraktion geprüft; Biome separat statt als redundantes Kreuzprodukt. Terrain-Tests prüfen alle 11 CPU-Layouts der drei verbleibenden Biome samt freien/verbundenen Basis- und Ressourcenzugängen. Die vollständige Raster-/Umrissprüfung erfolgt an einer detailliert geprüften Massivwelt; feste Navigationsreferenzen sichern weiterhin alle 11 Welten. Mesh-Erzeugung und View-/Fog-Uploads gehören in Geometrie-/Präsentationstests, nicht in jeden Gefechtsstart. Durchgehende Verkehrs-, Produktions- und Kampfszenarien nicht nur wegen ihrer Laufzeit streichen.

| Bereich | Abdeckung |
| --- | --- |
| Terrain/Kristalle | Syntax, bytegleiche Einbettung aller sechs kanonischen Texturquellen, Ring-/Massivgeometrie, kleine Felslayouts, Massiv-Raster, freie/verbundene Ressourcen- und Basiszugänge, echte Umwege, keine Straßenflächen/-markierungen |
| Harness/Core | Lokale Skripte, Reihenfolge/Pfadvertrag, Isolation, stabile neutrale Fraktions-/Biom-IDs und Katalogzuordnung, Mathematik und Seed-RNG; bytegleiche Musikfreigaben, Playlistreihenfolge/10-s-Startverzögerung und -Pausen/Rücksprung, Pause/Mute/Reset und Wiedergabefehler |
| Simulation | Gefechtsstart/-ziel, Startökonomie/passives Einkommen, Befehle, freie Worker-Zuweisung, Baufortsetzung/-ablösung ohne Mehrarbeitertempo, Reparatur/Verkauf, Produktion/Ausfahrt, Kampf, Upgrades, vollständiger Neustart; sechsminütiger Worker-Gegenverkehr: Lieferungen je Worker/Minute, Schutz vor anhaltenden Richtungswechseln |
| Gegner-KI | Symmetrischer Baseline-Start aller Fraktionspaare, unabhängige Konten/Fraktionskosten, Worker-/Raffinerieeinkommen, faire Zielerfassung und kopiertes Sichtgedächtnis, unsichtbare gegnerische Effektmarker, alle Fähigkeiten samt Controllerheuristiken, Wirtschaftsziele/Verteidigung, verlorene Bauarbeiter und fehlgeschlagene Bau-/Produktionsversuche; neun KI-gegen-KI-Langläufe bis zum Ergebnis (maximal 20 Simulationsminuten je Fall), Audit bezahlter Fundamente/echter Produktionsausgänge und Körperabstände einschließlich Bauplatzfreiheit, Seed-Reproduzierbarkeit |
| Persistence | Nur permanentes Profil: Aether-/Upgrade-/Fraktionsfreischaltungs-Normalisierung, Fehlerfälle, flüchtiger Storage-Ersatz; keine Run-/Backup-API |
| Präsentation | Welt-/Effektgrenzen, feste Zeichen-/Effekt-/RNG-Referenzen; Modell-/Schussvarianten bleiben unabhängig von Anzeigenamen |
| Einzelmodelle | Registry-/Dispatchvertrag aller 21 Gebäude und sieben Fraktion-0-Einheiten; Meshhilfen (geschlossene Panzerung und organische Schalen ohne degenerierte Pole, Rotation, Normalen); einzelne Mesh-/Assemblierungsbounds, Merkmale, Gesamtbudgets und Farben/Alpha/Layer/Material; unveränderte Bau-/Kristall-/Orbital-/Zielwinkel-, Lauf-/Flug-/Frachtverträge, vertiefte Mündungen und geschlossener Air-Rumpf; feste Zeichenreferenzen aller Gebäude und Fraktion-1/2-Einheiten sowie ergänzungsbereinigter Worker-Altassemblierung |
| Steuerung | Fraktions-/Biomnamen aus dem Katalog bei unveränderten IDs, Gegnerreihenfolge und Freischaltung; neutrale Portraitpfade aller 14 Aktionen; Touch-Auswahl/Gesten, Move-/Attack-move-Umschaltung und Tempo-Button unter der Uhr samt Anzeige/Lebenszyklus/Profilfreiheit, HTML-Dreier-Deck-Reihenfolge, Worker-Kontexttaps auf eigene Bau-/Reparaturziele mit Auswahl-/Gestenschutz, Fraktionssperre/Freischaltung samt abgesichertem Start, Ergebnis-Aetherevakuierung/Tiergrenzen 100–1.000/Preise, Welt-Viewport-Lebenszyklus/-Eingabegrenzen und Minimap-Ausschnitt, Kategorien/**Back**, feste Gebäudeaktionen, Queue-Aggregation/-Abbruch und Pausenschutz, Tab-Wechsel, Run-Abbruch, Ergebnisaktionen und Upgrade-Rückkehr ohne erneuten Ergebnis-Sound |
| Renderer | Shader-Quellvertrag samt Boden-Atlasrechtecken/-Sampling, einmaligem Atlasupload, Weltseed-Übergabe und erhaltener Schattenberechnung und High-only-Tilt-Shift/Kernel/Schärfezone, CSS-Viewport/Client-Projektion/Rückprojektion und erhaltene Zoomgröße, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

[Feste Referenzen und ihre Grenzen](reference-tests.md). Keine Altspielstand-Kompatibilität und kein Regenerieren von Fixtures zum Beheben fehlgeschlagener Tests. Der Harness prüft aktive Lade-/Isolationsverträge und relevante APIs, keine festen Methodenzahlen. Negativtests bleiben sinnvoll, wenn sie heutige Regeln schützen (z. B. keine Run-Speicherung, unzulässige Befehle); reine Nachweise entfernter Features gehören nicht dauerhaft in die Suite.

## Manuelle Zuschauerpartie

`npm run simulate:visible` ist ausschließlich ein persönlicher Beobachtungsbefehl: normales Standardbrowserfenster ohne gesetzte Größe, flüchtiges Profil, KI gegen KI, zunächst 1× und nach zehn Echtzeitsekunden 2×. Er ist absichtlich kein Bestandteil von `npm test`, CI oder Agentenabnahmen und darf dort nicht automatisch geöffnet werden. Automatisierte Browserchecks verwenden weiterhin ihre isolierten Harnesses; bloßes Zuschauen ersetzt keinen reproduzierbaren Test oder vollständigen menschlichen Run.

## Gezielter Browsercheck

Zuerst `npm run build` ausführen. Dann mit einem eigenen Profil ohne wichtige Daten `index.html` über `file://` öffnen; keine abgeschwächten Sicherheitsflags. Je nach Änderung prüfen:

- Start, lokale Ressourcen, Konsole/WebGL; betroffene Grafikqualität und Fenstergrößen. Bei Postshaderänderungen möglichst identische Szene/Zeit für A/B-Pixelvergleich verwenden; High-Schärfezone, beide sichtbaren Weltränder, ausgeschlossene Qualitätsstufen und DPR prüfen. Nach Viewportänderungen zusätzlich Canvas-/HUD-Abgrenzung, Overlayoffsets, Minimap-Ausschnitt, Touch-Ziele und Menü-/Pause-/Resize-Lebenszyklus prüfen. Beim Dreier-Deck: bündige Unterkanten, erreichbare Werkzeuge/Fähigkeiten, aufwärts wachsende Untermenüs samt Scrollen/**Back**, Tempo unter der Uhr und schmale/querformatige Rückfalllayouts.
- Touch-Auswahl/Bodenauftrag, Pan/Pinch/Minimap; erreichbare Aktionen, Zielbestätigung/Cancel und Pause. Bei Menüänderungen zusätzlich scrollbare Dialoge samt Abschlussknöpfen, schmale Formulare, gesperrte/aktive Fraktionen und bezahlbare/gesperrte Upgrades prüfen.
- Betroffene Bau-/Rekrutierungs-/Reparatur-/Verkaufsabläufe und Erstattungen. Bei Run-Lebenszyklusänderungen: Pause/Fortsetzen, Hauptmenü-Abbruch, Reload ohne Run, weiterhin gespeicherte Aether-Reserven/Upgrades/Einstellungen/Fraktionsfreischaltungen und Ergebnis → Upgrades → Ergebnis/Neustart sowie Hauptmenü.
- Bei Grafikänderungen Ergebnis ansehen, nicht nur `gl.getError()` abfragen. Audio tatsächlich anhören, wenn hörbares Verhalten geprüft werden soll.

Node führt kein GLSL aus. Headless/CDP-Touch mit kontrolliertem Setup ist kein Echtgerät-, zuverlässiger Tap-Timing-, Langzeitspiel-, Screenreader- oder Hörnachweis. Andere Browser/GPUs und tatsächliche Mobilgeräte getrennt bewerten.
