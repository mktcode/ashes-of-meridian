# STRATA Landscape

Privates `@aom/landscape`-Workspace-Package für den datenbasierten STRATA-Spielkartenimport.
Kern und Meshaufbau benötigen weder DOM/WebGL noch Crowd, Generator oder Netzwerk.
JavaScript-Import/Validierung stammen aus STRATA (`aom-shader`, Stand `cbb90cc`);
die öffentliche TypeScript-Fassade und der optionale Crowd-Adapter sind getrennte Einstiege.
Editor, Generierung und vollständige Materialdarstellung gehören noch zum Landschaftslabor.
Das eigentliche Spiel verwendet dieses Package nicht.

## Crowd auf Terrain ausprobieren

Vom Repository aus `npm ci` und `npm run build`, dann
[`demo/index.html`](demo/index.html) direkt unter `file://` öffnen.
Die mitgeführte Fassung liegt unter `dist/landscape/demo/index.html` relativ zur Repositorywurzel;
`npm run build:zip` nimmt sie mit der Crowd-Demo ins Archiv auf.

Die Demo startet mit einem echten STRATA-v1-Spielkartenexport und kleinen wartenden
Marine-/Panzergruppen. Eigene Karten im Labor über **Spiel-Exporte → Spielkarte**
exportieren und hier über die Dateiauswahl laden. Keine Materialpakete nötig.
Die Beispieldaten sind unter `tests/fixtures/strata-417.zip` eingecheckt und im
Demo-Bundle eingebettet; Laden braucht keinen HTTP-Server und führt keinen Archivcode aus.

Klick/Tippen erteilt ein Ziel; Wegpunkte erleichtern den Sprung zwischen Zugang und
Verzweigungen. Kamera und Referenzmodelle einschließlich Marine-Fuß-IK stammen aus der
Crowd-Demo. Die Farben zeigen einfache Gelände-/Diagnoseansichten, keine STRATA-Materialien.
Das Begehbarkeits-Overlay fragt Crowds tatsächliches Profilraster ab. Bei groben Zellen
können Marine und Panzer dieselbe Rastermaske haben; Körperradien und Formation bleiben
unterschiedlich. Der Export-Korridor ist dagegen nur eine Radius-0-Geländegarantie.

Die Demo begrenzt weitere Spawns bewusst auf eine kleine Gesamtmenge.
Aufträge können wegen Erreichbarkeit oder fehlender Ankunftsplätze abgelehnt werden;
angenommen heißt nicht angekommen. Große Gruppen, Gegenverkehr auf allen Karten und
Fahrphysik sind damit nicht abgenommen. Ungültige Karten ersetzen die aktive Welt nicht;
Kartenwechsel entsorgt die alte Crowd und GPU-Geometrie. Grafikverlust verlangt einen Reload.

## Verbraucher

```ts
import { importGameMap, heightAt, createTerrainMesh } from '@aom/landscape';
const map = await importGameMap(fileOrBytes);
const y = heightAt(map, x, z); // null außerhalb des Rechtecks
const mesh = createTerrainMesh(map); // Position/Normale, indiziert, ohne WebGL
```

Für klassische Browser-Skripte entsteht `dist/landscape.global.js` mit
`MeridianLandscape`. Alle Skripte synchron laden; kein Laufzeit-Import oder Fetch.
ZIP/Stored-v1 wird strikt mit Größen-/CRC-/Metadaten-/Geometrie-/Wegprüfung gelesen.
CRC ist keine Authentifizierung. SDK-Dateien im Archiv sind inerte Beigaben, keine
nachzuladenden Module. Map-Arrays gehören dem Importergebnis und dürfen während der
Nutzung nicht verändert werden; Crowd übernimmt eine defensive Höhenkopie.

`@aom/landscape/crowd` bietet den optionalen Adapter. Er erhält `createHeightfield`
und `canStand` vom Verbraucher, statt eine zweite Crowd-Laufzeit einzubinden.
Der maßgebliche [Oberflächenvertrag](../crowd-simulation/README.md#oberflächenvertrag)
bleibt bei Crowd: keine Höhenneuberechnung, Zeilenumkehr, Skalierung oder Rasterverfeinerung.

## Prüfen

`npm run test:landscape` baut beide Packages und prüft Typverbrauch, strikten Import,
Mesh/Picking sowie die tatsächliche Oberfläche und kleine Gruppen auf dem mitgeführten
STRATA-Export. Diese Karte ist kein Nachweis für sämtliche Seeds, Parameter und Gruppengrößen.
`npm run check:landscape-browser` prüft gezielt Dateiladen, WebGL-/Maskendaten, Picking,
Pause und Weltwechsel unter `file://`; `node packages/landscape/tests/check-browser.mjs --release`
verwendet die zuvor gebaute Auslieferung. Kein menschlicher Bild-/Geräteperformancebeleg.
Die Browser-/GPU-Abnahme ist unter dem festen Task-Limit durch Chromiums Thread-Erzeugung
blockiert; CPU-Prüfungen und ein erfolgreicher Build ersetzen diesen Nachweis nicht.
Es gelten die [Prüfregeln](../../AGENTS.md#prüfungen).
