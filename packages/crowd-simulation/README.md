# Crowd Simulation

Privates `0.x`-Workspace-Package für gruppengesteuerte CPU-Crowds, unabhängig von
Spiel, DOM und WebGL. Gemeinsame Navigationsfelder, lokale Körpertrennung,
reservierte Ankunftsplätze und budgetierte Recovery unterstützen unterschiedlich
große runde Körper. Gegnerkontakt ist optionales Stoppen/Blicken, kein Kampfsystem.

## Start

Im Repository: `npm ci`, danach `npm run build:crowd`.
[Demo](demo/index.html) direkt mit `file://` öffnen. Marines und vereinfachte Panzer,
Gruppenbefehle, Mischszenen, Kamera, Fuß-IK und Instancing sind die Referenzdarstellung,
nicht Bestandteile des Bewegungskerns. Die Demo startet nur mit gebautem Bundle.

`npm run build` erzeugt außerdem die eigenständig mitführbare Demo unter
`dist/crowd-simulation/demo/index.html`; `npm run build:zip` nimmt sie mit ins Archiv.
Das eigentliche Spiel benutzt die Crowd noch nicht.

## Verbraucher

Node/TypeScript verwendet `@aom/crowd-simulation`. Für den Browser entsteht
`dist/crowd.global.js` mit dem globalen Einstieg `MeridianCrowd`; danach eigene
klassische Skripte synchron laden. Keine Laufzeit-Imports, Netzwerkzugriffe oder
zusätzlichen Browserberechtigungen. Esbuild ist nur eine Build-Abhängigkeit.

```ts
import {
  createHeightfield, createNavigationWorld, createCrowd,
  createCrowdFrameBuffer, createFixedStepClock,
} from '@aom/crowd-simulation';

const surface = createHeightfield({
  halfSize: 16, cellSize: 0.5, heights: new Float64Array(65 * 65),
});
const navigation = createNavigationWorld({
  surface, obstacles: [],
  profiles: { infantry: { radius: 0.4, maxSlope: 0.6, maxSpeed: 2 } },
});
const crowd = createCrowd({ navigation });
const group = crowd.createGroup({
  profile: 'infantry', team: 0, spawnOrigin: { x: 0, z: 0 },
});
const spawn = crowd.spawn(group, 100);
const command = crowd.command({
  kind: 'move', group, destination: { x: 8, z: 0 },
});
if (!spawn.complete || !command.ok) { /* Kapazität / Ablehnungsgrund behandeln. */ }

const frame = createCrowdFrameBuffer();
const clock = createFixedStepClock();
// Je Renderframe, nicht während Pause; Tempo genau einmal anwenden:
clock.advance(realDeltaSeconds * tempo, crowd.step);
crowd.writeFrame(frame, clock.alpha);
// Eigenen Renderer mit den ersten frame.count Einträgen versorgen.
```

`realDeltaSeconds` und `tempo` kommen vom Host. Ein Spiel mit eigener fester
Simulationsuhr ruft stattdessen selbst `crowd.step()` auf und verwendet keinen
zweiten Akkumulator. Renderer, Modelle, Kamera und Picking bleiben außerhalb.
Die [Typverträge](src/contracts.ts) und der [kompilierte Verbraucher](tests/consumer.ts)
sind die maßgeblichen API-Signaturen.

## Verträge und Grenzen

- Die Welt beginnt leer. IDs sind stabil, innerhalb einer Crowd gültig und werden
  dort nicht wiederverwendet. Gruppen enthalten jeweils ein Bewegungsprofil.
  Profilnamen haben keine Modellbedeutung; die Verkehrsoption unterscheidet
  kooperatives Nachgeben von unabhängigen lokalen Umwegen.
- Das Gelände ist ein zentriertes quadratisches Höhenfeld, zeilenweise von -Z nach
  +Z und darin von -X nach +X. Pro Zelle gelten die Dreiecke `(a,c,b)` und `(b,c,d)`.
  Navigation verwendet dessen Auflösung und tatsächliche Dreieckssteigungen.
  Endliche Oberflächenabfragen außerhalb des Feldes klemmen an den Rand.
  Einheiten bewegen sich auf X/Z, Y ist Höhe, Yaw ist Radiant mit +Z als Vorwärtsrichtung.
- Gelände, Hindernisse und Profile werden beim Erzeugen defensiv übernommen und
  bleiben unveränderlich. Für eine andere Karte eine neue Navigationswelt erzeugen.
  Mehrere Crowds dürfen statische Navigationsdaten teilen; Aufträge, Reservierungen
  und Recovery gehören jeweils ihrer eigenen Welt.
- Gruppenbefehle sind synchron zwischen Ticks. Eine Ablehnung erhält den alten
  Auftrag. Angenommen bedeutet nicht angekommen. Ankunft bezeichnet den eigenen
  reservierten Platz, nicht die Klickkoordinate. Warten und Kontakt sind keine Ankunft.
  Ein identischer Laufbefehl kann Wartende erneut versuchen lassen, ohne das
  unveränderte Hauptfeld neu aufzubauen. Jede Annahme erhält eine neue Auftrags-ID.
- Spawns melden die tatsächlich erzeugten IDs und mögliche Teilmengen. Sie erben
  nur den Auftrag ihrer Gruppe. Entfernen gibt Reservierungen frei, bereinigt
  Kontaktverweise und lokale Suchcaches; unbekannte IDs werden ignoriert.
  Es verschiebt keine verbliebenen geparkten Körper. `dispose()` ist idempotent;
  anschließend sind weitere Weltoperationen Fehler.
- Der Kern besitzt die Positionen. Abfragen sind eingefrorene Kopien; Frame-Puffer
  gehören dem Verbraucher und sind niemals Solver-Speicher. `writeFrame()` verändert
  keine Simulation. Alpha 0/1 bezeichnet vorigen/aktuellen Tick; Y wird auf der
  Oberfläche neu gesampelt, Yaw folgt dem kurzen Winkelbogen. Arrays wachsen nur
  bei Kapazitätsbedarf; nach jedem Schreiben die aktuellen Arrayreferenzen lesen.
- `movementBlend` beschreibt tatsächliche Fortbewegung und die erhaltene Anlaufregel.
  Die Demo leitet daraus eine Gangpose ab; Animationsänderungen schreiben nicht in
  die Physik zurück. Agentenalter folgt der Simulationszeit, nicht der Renderuhr.
- `step()` führt genau einen festen Tick aus. Der optionale Clock-Helfer begrenzt
  Catch-up und verwirft überschüssige Zeit; er ist keine Echtzeit-/Lockstep-Zusage.
  Suchzähler sind Arbeitsnachweise, keine Millisekunden- oder FPS-Garantien.

Größere Körper erhalten echte Navigations- und Interaktionsfreiheit. Neue
Parkformationen berücksichtigen die größte bereits vorhandene Körperklasse;
später hinzugefügte größere Körper verschieben keine alten engen Formationen.
Beliebige Blockaden lösen sich nicht garantiert: feste Gruppen müssen gegebenenfalls
Platz machen. Lokale Recovery ist begrenzt, kein ORCA und kein globaler Deadlock-Beweis.

Noch nicht zugesichert: dynamische Kartenänderungen, längliche Körper, Wendekreise,
Kampf/Schaden, Speicherformat/Restore, Worker und plattformübergreifender Lockstep.
Der private Solver bleibt verhaltenserhaltend extrahiertes JavaScript; die öffentliche
Fassade und Verbrauchergrenze sind strikt typgeprüft, nicht schon sämtliche Solver-Interna.

## Prüfen und messen

`npm run test:crowd` baut und prüft den TypeScript-Verbraucher, öffentliche Verträge,
Entfernung bei laufender Recovery und exakte Vergleiche mit vor der Extraktion
aufgezeichneten Szenen sowie Interpolation und Instanzposen. `npm run check:crowd-browser` prüft die Demo technisch im
lokalen Chromium, ohne Download. `CHROMIUM_PATH` überschreibt dessen Pfad.

Die beibehaltenen Einzelregressionen liegen unter `tests/check-*.mjs`, beispielsweise
`node packages/crowd-simulation/tests/check-recovery.mjs`. `check-scale.mjs` prüft
vollständige Marine-Ankünfte bis 2.000; `check-contact.mjs` Gruppenverkehr/Kontakt;
`check-tank.mjs --scale` ergänzt 500 Marines und 63 Panzer. Diese umfangreicheren
Fälle sind nicht Teil des kurzen Standard-Packagechecks.
`check-package-scale.mjs` prüft zusätzlich über die tatsächlich gebaute öffentliche
API vollständige Ankünfte von 2.000 Marines und 500 Marines mit 63 Panzern.

`tests/measure.mjs` misst kurze CPU-Phasen; `tests/measure-render.mjs` vergleicht
vollständigen Poseaufbau mit unveränderter Pause. Letzteres invalidiert nur die
Demo-Darstellung, niemals den Simulations-Tick. Beide nennen tatsächliche Mengen.
Software-WebGL ist kein Geräteperformancebeleg. Keine menschliche Bild-, Touch-,
Fahrphysik- oder Kampfabnahme durch automatisierte Prüfungen.
