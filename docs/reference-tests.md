# Referenztests für die unveränderte Simulation

## Umfang

Die Test-Erweiterung nach dem Dokumentationscommit `49349bf` führt einen gemeinsamen HTML-Skriptloader und Renderer-Stub sowie 5 Harness- und 15 Simulationsprüfungen ein. Die 24 vorhandenen Terrain-/Kristallprüfungen bleiben erhalten. Die einzige Änderung an `index.html` sind sieben identifizierende `data-meridian-script`-Attribute; kein Skriptinhalt und kein Asset wurde geändert.

Die Namen sind keine neuen Laufzeitmodule. Der Loader unter `tests/helpers/inline-scripts.cjs` unterstützt bewusst nur die hier verwendeten benannten, klassischen Inline-Skripte. Er ist kein allgemeiner HTML-Parser. Explizite Skriptauswahl verhindert, dass eine eingeschobene Skriptdatei plötzlich anstelle der Simulation ausgeführt wird; die tatsächliche Ausführung bleibt in Dokumentreihenfolge.

## Herkunft der festen Referenzen

- Quelle: `index.html` aus Git-Commit `ab92a12`, nicht aus dem beim Testlauf aktuellen Arbeitsverzeichnis.
- Erfassung unter Node.js `v23.11.1` / Linux, mit `structuredClone` in einer Node-VM und einem minimalen Renderer-Stub (`clearStatic`, `geometry`, `add`, `fog` ohne GPU; numerische RGB-Konvertierung in `color`).
- Für die einmalige Erfassung wurden die ersten vier Skripte des **alten Commits ohne Namensattribute** ausgeführt. Die neuen Tests selbst verwenden ausschließlich die Namensauswahl.
- `Math.random()` wurde bereits bei der Erfassung durch eine werfende Funktion ersetzt. Der explizite Seed muss für dieses Szenario ausreichen.
- Startprofil: `{ upgrades: {} }`, also keine Kampagnenboni. Die UI und `readProfile()` wurden nicht ausgeführt.

Die festen Startwerte im Simulationstest stammen aus diesem Ausgangsstand: Seed 1409, Standard, Fraktion 0, 470 Alloy / 80 Aether / 100 Energie, 64 Entitäten, 11 belegte Supply bei Kapazität 24. Spielerpositionen nach der Navigation-Korrektur sowie die ersten fünf Kristallmengen wurden direkt erfasst, nicht aus den heutigen Definitionen berechnet.

### Spielstand-Fixture

Datei: `tests/fixtures/operation-v1.json` (81.398 Bytes).

SHA-256: `ece3a352e8aa9e8acf8a1f9ded9513ed7f41c2febb4552709b84cbb194dcdacb`

Es handelt sich um eine vollständige JSON-Operation, **nicht** um den Backup-Container der UI. Das Fixture enthält keine persönlichen Nutzerdaten. Es wurde einmalig durch diesen Ablauf auf den aus `ab92a12` geladenen Klassen erzeugt:

```js
const game = new MeridianGame(renderer, { upgrades: {} });
game.start(0, { seed: 1409, difficulty: 'standard', faction: 0 });
const hero = game.alive(e => e.team === 0 && e.type === 'hero')[0];
const barracks = game.alive(e => e.team === 0 && e.type === 'barracks')[0];
game.command([hero.id], { type: 'move', x: -10, z: 32 });
game.command([hero.id], { type: 'move', x: -15, z: 10 }, true);
game.command([barracks.id], { type: 'move', x: -35, z: 48 });
game.train('rifle', barracks.id); // Rückgabe true bei der Erfassung geprüft.
game.ability('scan', { x: 20, z: -20 }); // Ebenfalls true.
game.s.groups = { '1': [hero.id] };
game.s.cam = { x: -42, z: 40, zoom: 64 };
for (let i = 0; i < 100; i++) {
  game.step(0.05);
  game.tickEffects(0.05);
}
const serialized = JSON.stringify(game.snapshot(), null, 2) + '\n';
```

Kamera und Kontrollgruppe werden direkt gesetzt, wie sonst durch die UI. Nach nominell fünf Sekunden sind zwei Bewegungsaufträge, ein Rally-Punkt, eine unfertige Produktionsqueue, ein aktiver Scan und 1.113 erkundete Rasterfelder enthalten. Gleitkommawerte bleiben ungerundet erhalten (etwa `time: 4.99999999999999`).

Kein Test schreibt das Fixture oder erzeugt seine Sollwerte neu. Der Fünf-Sekunden-Test führt denselben Ablauf auf dem aktuellen Code aus und vergleicht den JSON-Zustand mit der festen Datei. Andere Tests laden die Datei direkt und prüfen Restore, unabhängig von einem gerade neu erzeugten Save.

## Was die Referenztests garantieren – und was nicht

- Einzelassertionen sichern Startwerte, Befehlszuweisung, Produktionskosten aller Fraktionen, Supply-Reservierung, Erstattung, drei Ablehnungsfälle und einmalige Fertigstellung ab. Der kurze Wirtschaftslauf prüft auch tatsächlich angeliefertes Alloy und das passive HQ-Einkommen.
- Der vollständige Fünf-Sekunden-Snapshot ist bewusst eine strenge Charakterisierung, einschließlich interner Timer und Pfaddaten. Nicht jedes Feld ist dadurch eine dauerhaft öffentliche API. Bei späteren absichtlichen Schemaänderungen Unterschiede einzeln begründen und Kompatibilität separat prüfen, statt das Fixture pauschal zu ersetzen.
- Save/Load prüft gespeicherte Zustände, nicht bloß „wirft keine Ausnahme“: verschachtelte Daten sind kopiert, Entitäts-/Raumindizes und Gebäudefußabdrücke werden wieder aufgebaut, vorher erkundete Felder bleiben erhalten und die aktuelle Nebeltextur wird übergeben.
- `restore()` berechnet Sichtbarkeit neu. Erkundung kann dabei gegenüber dem gespeicherten Raster wachsen; deshalb wird dort Erhaltung alter Felder statt zwingender Bytegleichheit des Erkundungsrasters verlangt.
- Ein Restore-Test lässt Zeit und Produktion weiterlaufen. Er vergleicht ausdrücklich **nicht** den weiteren Zufallsverlauf mit einem ununterbrochenen Spiel, weil der RNG-Zustand derzeit nicht gespeichert wird.
- Nur eine Kampagnenoperation ist als Save-Fixture erfasst. Weitere Missionen, Skirmish-Saves, Forschung, Bau-/Kampfregeln, breite Importvalidierung und Fehlerbehandlung bleiben offen. Node-Tests erfassen weder `localStorage` noch UI-Import/Export oder WebGL.

## Ausgeführte Prüfungen

Gesamter Testbefehl: [docs/testing.md](testing.md#automatisierte-tests). Unter Node.js `v23.11.1` / Linux bestanden alle **44 Tests** mit 128-MiB-Heaplimit und einem Testworker.

Zusätzlich wurden drei absichtliche Fehler ausschließlich im Speicher separater Testprozesse injiziert, ohne Projektdateien zu ändern:

| Eingebrachter Fehler | Erkannte Regression |
| --- | --- |
| Rekrutierungsabbruch erstattet nur 50 % Alloy | Alle drei Fraktions-Erstattungstests schlagen fehl |
| `snapshot()` gibt den lebenden Zustand statt eines Klons zurück | Snapshot-Isolation schlägt fehl |
| Restore baut Gebäudefußabdrücke nicht wieder auf | Navigationsprüfung beim Restore schlägt fehl |

Ein byteweiser Vergleich mit `ab92a12` bestätigt: Nach Entfernen der sieben neuen Namensattribute ist das gesamte HTML unverändert; auch Skriptinhalte und vier Assets sind bytegleich. Die bestehenden 16 Layout-Prüfsummen wurden nicht geändert. Lokale Dokumentationslinks samt Abschnittsankern und `git diff --check` wurden geprüft.

**Nicht ausgeführt:** Browser-/WebGL-Prüfung, tatsächlicher `file://`-Start und vollständiger Kampagnen-/E2E-Lauf. Die neue Testabdeckung ersetzt diese offenen Prüfungen nicht; siehe [Browser-Checkliste](testing.md#manuelle-browser-prüfung).
