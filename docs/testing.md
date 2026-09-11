# Prüfungen

## Prüfaufwand

- **Dokumentation, minimale Text-/Rahmen-/Abstandsänderungen:** Diff sichten, bei Dokumentationsänderungen Links und Angaben prüfen; kein zusätzlicher Browserlauf nötig.
- **JavaScript-Spielcode oder Tests:** vollständigen Node-Befehl unten ausführen, passende Regressionstests ergänzen.
- **Eingabe, Layoutstruktur, Rendering oder Auslieferung:** zusätzlich gezielt direkt unter `file://` prüfen, insbesondere betroffene Touch-Aktionen und Portraitgrößen. Keine vollständige Browser-Regressionsserie für jeden kleinen Schritt.
- Ergebnisse und ausgelassene relevante Bereiche kurz nur im [Arbeitsprotokoll](worklog.md) festhalten. Ältere Nachweise sind keine neu ausgeführten Tests.

## Automatisierte Tests

Keine Paketinstallation oder Build nötig:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs tests/ashes-of-meridian-persistence.check.cjs tests/ashes-of-meridian-presentation.check.cjs tests/ashes-of-meridian-controls.check.cjs tests/ashes-of-meridian-renderer.check.cjs
```

Ein Testworker; 128 MiB begrenzen nur den JS-Heap, nicht den gesamten Prozessspeicher.

| Bereich | Abdeckung |
| --- | --- |
| Terrain/Kristalle | Syntax, eingebettete Skybox, Geometrie, feste Layout-/Ressourcenreferenzen |
| Harness/Core | Lokale Skripte, Reihenfolge/Pfadvertrag, Isolation, Mathematik und Seed-RNG |
| Simulation | Gefechtsstart/-ziel, Befehle, Bau, Reparatur/Verkauf, Produktion, Kampf, Wellen, Upgrades, aktuelle Snapshots |
| Persistence | Profil/Checkpoint/Backup, Validierung, Fehlerfälle und flüchtiger Storage-Ersatz |
| Präsentation | Welt-/Effektgrenzen, feste Zeichen-/Effekt-/RNG-Referenzen |
| Steuerung | Touch-Auswahl/Gesten, aktuelle HUD-Grenzen, Kategorien/Zurück, feste Gebäudeaktionen, Queue-Aggregation/-Abbruch und Pausenschutz |
| Renderer | Shader-Quellvertrag, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

[Feste Referenzen und ihre Grenzen](reference-tests.md). Keine Altspielstand-Kompatibilität und kein Regenerieren von Fixtures zum Beheben fehlgeschlagener Tests.

## Gezielter Browsercheck

Eigenes Profil ohne wichtige Daten verwenden, `index.html` über `file://` öffnen; keine abgeschwächten Sicherheitsflags. Je nach Änderung prüfen:

- Start, lokale Ressourcen, Konsole/WebGL; betroffene Grafikqualität und Fenstergrößen.
- Touch-Auswahl/Bodenauftrag, Pan/Pinch/Minimap; erreichbare Aktionen, Zielbestätigung/Cancel und Pause.
- Betroffene Bau-/Rekrutierungs-/Reparatur-/Verkaufsabläufe und Erstattungen; erforderlichenfalls aktuelle Save-/Backup-Roundtrips.
- Bei Grafikänderungen Ergebnis ansehen, nicht nur `gl.getError()` abfragen. Audio tatsächlich anhören, wenn hörbares Verhalten geprüft werden soll.

Node führt kein GLSL aus. Headless/CDP-Touch mit kontrolliertem Setup ist kein Echtgerät-, zuverlässiger Tap-Timing-, Langzeitspiel-, Screenreader- oder Hörnachweis. Andere Browser/GPUs und tatsächliche Mobilgeräte getrennt bewerten.
