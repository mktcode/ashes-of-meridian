# Prüfungen

## Prüfaufwand

- **Dokumentation, minimale Text-/Rahmen-/Abstandsänderungen:** Diff sichten, bei Dokumentationsänderungen Links und Angaben prüfen; kein zusätzlicher Browserlauf nötig.
- **Mechanische, verhaltensneutrale JavaScript-/TypeScript-Kleinständerungen:** `npm run build` und Diff-Sichtung genügen, etwa bei einer lokalen Konstantenextraktion mit unverändertem Wert. Voraussetzung: keine Änderung an Logik, RNG-Aufrufreihenfolge, Schnittstellen oder Auswertungsreihenfolge; kein struktureller Umbau.
- **Sonstiger Spielcode oder Tests:** vollständiges `npm test` ausführen, passende Regressionstests ergänzen. Bei Änderungen an Spiellogik, RNG, Schnittstellen oder Tests sowie im Zweifel ist der vollständige Lauf Pflicht.
- **Eingabe, Layoutstruktur, Rendering oder Auslieferung:** zusätzlich gezielt direkt unter `file://` prüfen, insbesondere betroffene Touch-Aktionen und Portraitgrößen. Keine vollständige Browser-Regressionsserie für jeden kleinen Schritt.
- Ergebnisse und ausgelassene relevante Bereiche kurz nur im [Arbeitsprotokoll](worklog.md) festhalten. Ältere Nachweise sind keine neu ausgeführten Tests.

## Automatisierte Tests

Nach einmaligem `npm install` baut und prüft ein Befehl die aktuelle Laufzeitausgabe:

```bash
npm test
```

Das Skript leert `dist/`, kompiliert die Quellen und führt anschließend alle neun Node-Testdateien gegen die erzeugten klassischen Skripte aus. Ein Testworker; 128 MiB begrenzen nur den JS-Heap, nicht den gesamten Prozessspeicher. Für einen erneuten reinen Build genügt `npm run build`.

| Bereich | Abdeckung |
| --- | --- |
| Terrain/Kristalle | Syntax, bytegleiche Skybox-/Dirt-Einbettungen, Geometrie, feste Layout-/Ressourcenreferenzen |
| Harness/Core | Lokale Skripte, Reihenfolge/Pfadvertrag, Isolation, Mathematik und Seed-RNG |
| Simulation | Gefechtsstart/-ziel, Startökonomie/passives Einkommen, Befehle, freie Worker-Zuweisung, Baufortsetzung/-ablösung ohne Mehrarbeitertempo, Reparatur/Verkauf, Produktion/Ausfahrt, Kampf, Wellen, Upgrades, vollständiger Neustart; sechsminütiger Worker-Gegenverkehr: Lieferungen je Worker/Minute, Schutz vor anhaltenden Richtungswechseln |
| Persistence | Nur permanentes Profil: Normalisierung, Fehlerfälle, flüchtiger Storage-Ersatz; keine Run-/Backup-API |
| Präsentation | Welt-/Effektgrenzen, feste Zeichen-/Effekt-/RNG-Referenzen |
| Steuerung | Touch-Auswahl/Gesten, Move-/Attack-move-Umschaltung und Tempo-Button samt Anzeige/Lebenszyklus/Profilfreiheit, Worker-Kontexttaps auf eigene Bau-/Reparaturziele mit Auswahl-/Gestenschutz, Welt-Viewport-Lebenszyklus/-Eingabegrenzen und Minimap-Ausschnitt, Kategorien/Zurück, feste Gebäudeaktionen, Queue-Aggregation/-Abbruch und Pausenschutz, Tab-Wechsel, Run-Abbruch, Ergebnisaktionen und Upgrade-Rückkehr ohne erneuten Ergebnis-Sound |
| Renderer | Shader-Quellvertrag samt High-only-Tilt-Shift/Kernel/Schärfezone, CSS-Viewport/Client-Projektion/Rückprojektion und erhaltene Zoomgröße, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

[Feste Referenzen und ihre Grenzen](reference-tests.md). Keine Altspielstand-Kompatibilität und kein Regenerieren von Fixtures zum Beheben fehlgeschlagener Tests.

## Gezielter Browsercheck

Zuerst `npm run build` ausführen. Dann mit einem eigenen Profil ohne wichtige Daten `index.html` über `file://` öffnen; keine abgeschwächten Sicherheitsflags. Je nach Änderung prüfen:

- Start, lokale Ressourcen, Konsole/WebGL; betroffene Grafikqualität und Fenstergrößen. Bei Postshaderänderungen möglichst identische Szene/Zeit für A/B-Pixelvergleich verwenden; High-Schärfezone, beide sichtbaren Weltränder, ausgeschlossene Qualitätsstufen und DPR prüfen. Nach Viewportänderungen zusätzlich Canvas-/HUD-Abgrenzung, Overlayoffsets, Minimap-Ausschnitt, Touch-Ziele und Menü-/Pause-/Resize-Lebenszyklus prüfen.
- Touch-Auswahl/Bodenauftrag, Pan/Pinch/Minimap; erreichbare Aktionen, Zielbestätigung/Cancel und Pause.
- Betroffene Bau-/Rekrutierungs-/Reparatur-/Verkaufsabläufe und Erstattungen. Bei Run-Lebenszyklusänderungen: Pause/Fortsetzen, Hauptmenü-Abbruch, Reload ohne Run, weiterhin gespeicherte Upgrades/Einstellungen und Ergebnis → Upgrades → Ergebnis/Neustart sowie Hauptmenü.
- Bei Grafikänderungen Ergebnis ansehen, nicht nur `gl.getError()` abfragen. Audio tatsächlich anhören, wenn hörbares Verhalten geprüft werden soll.

Node führt kein GLSL aus. Headless/CDP-Touch mit kontrolliertem Setup ist kein Echtgerät-, zuverlässiger Tap-Timing-, Langzeitspiel-, Screenreader- oder Hörnachweis. Andere Browser/GPUs und tatsächliche Mobilgeräte getrennt bewerten.
