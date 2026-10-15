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
- Das Gelände ist ein unveränderliches rechteckiges Höhenfeld. Der folgende
  Oberflächenvertrag gilt unabhängig von Generator, Editor und Darstellung.
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
Parkformationen berücksichtigen die größte bereits vorhandene Körperklasse.
Kleine Körper stehen dabei in kompakten Inseln; gezielte sich kreuzende Gassen
halten große Körper passierfähig, statt jede Nachbarlücke auf deren Größe aufzuweiten.
Die Freistellung an Wänden und zwischen unabhängigen Gruppen bleibt konservativ.
Später hinzugefügte größere Körper verschieben keine alten engen Formationen.
Beliebige Blockaden lösen sich nicht garantiert: feste Gruppen müssen gegebenenfalls
Platz machen. Lokale Recovery ist begrenzt, kein ORCA und kein globaler Deadlock-Beweis.

Noch nicht zugesichert: dynamische Kartenänderungen, längliche Körper, Wendekreise,
Kampf/Schaden, Speicherformat/Restore, Worker und plattformübergreifender Lockstep.
Der private Solver bleibt verhaltenserhaltend extrahiertes JavaScript; die öffentliche
Fassade und Verbrauchergrenze sind strikt typgeprüft, nicht schon sämtliche Solver-Interna.

## Oberflächenvertrag

```ts
const surface = createHeightfield({
  width: 48, depth: 72, cellSize: 2,
  origin: { x: 100, z: -90 }, // kleinste X/Z-Ecke, unabhängig von der Speicherreihenfolge
  rowOrder: 'decreasing-z', diagonal: 'a-d', boundary: 'reject',
  heights: new Float32Array(25 * 37), // tatsächliche Höhen in Weltmetern
});
```

Ohne `origin` liegt das Rechteck zentriert um `(0,0)`. `halfSize` ist die alternative
Kurzschreibweise für ein zentriertes Quadrat, nicht zusammen mit `width`, `depth`
oder `origin` verwenden. Beide Ausdehnungen müssen ganze Vielfache von `cellSize`
mit mindestens zwei Zellen sein. Es gibt kein quadratisches Padding.

`columns` und `rows` sind **Zellenzahlen**; `heights` enthält
`(columns + 1) * (rows + 1)` Vertices. Spalten laufen immer in Richtung +X.
`rowOrder` bestimmt die Zeilenrichtung: `increasing-z` (Standard) von `bounds.minZ`
nach `bounds.maxZ`, `decreasing-z` umgekehrt. Für die vier Speicherindizes
`a = row * (columns + 1) + column`, `b = a + 1`, `c = a + columns + 1`, `d = c + 1`
verbindet `diagonal: 'b-c'` (Standard) die Vertices b/c, `a-d` die Vertices a/d.
Diese Namen beziehen sich auf **Speicherindizes**, nicht Himmelsrichtungen.
Zeilenumkehr allein verändert deshalb die physische Diagonale; eine beabsichtigte
Umordnung muss auch die Diagonale wechseln. Keine Höhenneuberechnung oder Glättung.

`heightAt` interpoliert innerhalb des tatsächlichen Dreiecks, `slopeAt` liefert
dessen Gradient als Betrag, nicht Grad. `cellSlopeAt` liefert den größeren Gradienten
beider Dreiecke der Zelle; Navigation verwendet genau diesen Wert, keine von der
Diagonale abhängigen Stichproben. Höhen sind bereits in Weltmetern; das Package
wendet keinen zweiten Höhenmaßstab an. Renderer und Picking müssen dieselben
Dreiecke verwenden, auch bei anderer Speicherorientierung und passender Face-Winding.
Kosmetisches Displacement ist keine zusätzliche Kollisionsoberfläche.

`bounds` ist eine eingefrorene Kopie der tatsächlichen Ausdehnung. `contains(x,z)`
prüft endliche Punkte einschließlich der Außenkante. Für Abfragen außerhalb gilt
`boundary: 'clamp'` (Standard) oder `reject` (`RangeError`); nichtendliche Höhen-/
Steigungsabfragen sind immer Fehler. Clamping erweitert weder Navigation noch
Spawn-/Zielraum. Die Navigation sperrt konservativ den Rand und benötigt zusätzlichen
Platz für den Körperradius. Portale außerhalb der Karte sind keine gültigen Befehlsziele.

Navigation und Höhenfeld verwenden weiterhin dieselbe Zellenweite. Ein 2-m-Feld
wird direkt unterstützt, ohne es auf die Demo-Auflösung von 0,5 m umzubauen.
Die konservative Rasterfreistellung kann dabei enge, geometrisch eigentlich ausreichend
breite Durchgänge sperren. Erreichbarkeit gilt pro Bewegungsprofil, nicht pauschal
für eine Karte; `maxSlope` und Körperradien werden nicht an Generatorwerte angepasst.
Eine getrennte Navigationsauflösung, dynamische Blocker oder ein Terrain-Importer
sind damit nicht implementiert. Große Karten können trotz grobem Gitter wegen der
globalen Spawn-/Formationssuche aufwendig sein.

## Prüfen und messen

`npm run test:crowd` baut und prüft den TypeScript-Verbraucher, öffentliche Verträge,
Entfernung bei laufender Recovery und exakte Vergleiche mit vor der Extraktion
aufgezeichneten unveränderten Einzelgrößen-Szenen sowie Interpolation und Instanzposen.
Die bewusst geänderten Mischformationen verwenden keine neu erzeugten historischen
Referenzen: Solver/Fassade werden weiterhin verglichen, Kompaktheit, reale Gassenbreite
und vollständige Ankunft werden unabhängig geprüft. Synthetische Höhenfelder
prüfen beide Zeilenrichtungen/Diagonalen gegen ein unabhängiges Dreiecksmesh;
rechteckige 2-m-Karten prüfen Körperfreiheit, Gegenverkehr, vollständige Ankunft,
Kontakt/Rückzug und reine Renderinterpolation. Es werden keine Daten oder Module
einer Terrainanwendung verwendet. `npm run check:crowd-browser` prüft die Demo technisch im
lokalen Chromium, ohne Download. `CHROMIUM_PATH` überschreibt dessen Pfad.

Die beibehaltenen Einzelregressionen liegen unter `tests/check-*.mjs`, beispielsweise
`node packages/crowd-simulation/tests/check-recovery.mjs`. `check-scale.mjs` prüft
vollständige Marine-Ankünfte bis 2.000; `check-contact.mjs` Gruppenverkehr/Kontakt;
`check-tank.mjs --scale` ergänzt 500 Marines und 63 Panzer. Diese umfangreicheren
Fälle sind nicht Teil des kurzen Standard-Packagechecks.
`check-package-scale.mjs` prüft zusätzlich über die tatsächlich gebaute öffentliche
API vollständige Ankünfte von 2.000 Marines, 500 Marines mit 63 Panzern und
1.000 Marines um vier fest stehende Panzer. `check-formation.mjs` schützt kompakte
Nachbarabstände, echte Panzerfreiheit in beiden Gassenrichtungen, gedrehte Formationen,
späte Spawns beider Körperklassen und unveränderte geparkte Positionen.
`node packages/crowd-simulation/tests/check-rectangular.mjs --scale` ergänzt einen
synthetischen 128 × 192-m-Fall mit 2.000 kleinen Körpern sowie einen 320 × 480-m-Fall
mit 500 kleinen und 63 großen Körpern, beide im 2-m-Raster mit Hindernisumweg;
der Mischfall enthält Gegenverkehr. Er verlangt vollständige Ankunft einschließlich
stabiler Parkplätze; das Zeitbudget berücksichtigt auch Umwege um die geparkte Formation.

`tests/measure.mjs` misst kurze CPU-Phasen; `tests/measure-render.mjs` vergleicht
vollständigen Poseaufbau mit unveränderter Pause. Letzteres invalidiert nur die
Demo-Darstellung, niemals den Simulations-Tick. Beide nennen tatsächliche Mengen.
Software-WebGL ist kein Geräteperformancebeleg. Keine menschliche Bild-, Touch-,
Fahrphysik- oder Kampfabnahme durch automatisierte Prüfungen.
