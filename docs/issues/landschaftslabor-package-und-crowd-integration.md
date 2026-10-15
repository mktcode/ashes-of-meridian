# Landschaftslabor als Package und Crowd-Anbindung

Das Landschaftslabor/Karteneditor aus dem Parallelrepository `../../aom-shader/`
(Pfad ab Repositorywurzel) soll Teil des Spielrepositorys werden. Offene Planung,
keine Implementierungs-, Balancing- oder Testfreigabe. Vor Übernahme den dortigen
Arbeitsstand einschließlich noch uncommittierter Export-/Importarbeit sichern.

Die Quellsichtung bezieht sich auf das Crowd-Package in `14edb4f`; ein gemeinsamer
technischer Integrationsnachweis fehlt. Die [Crowd-Simulation](../../packages/crowd-simulation/README.md)
ist bislang nicht an das eigentliche Spiel angebunden. Package-Übernahme,
Landschaft/Crowd-Demo und vollständige RTS-Anbindung sind getrennte Schritte.

## Ziel und Package-Grenzen

- [ ] Eigenständiges Workspace-Package, beispielsweise `@aom/landscape`, mit
  DOM-/WebGL-freiem Kern für Generierung, autoritative Oberfläche sowie getrennte
  Spielkarten-/Materialformate. Editor und Materialgalerie sind Werkzeuge, keine
  Abhängigkeiten der Spielsimulation.
- [ ] Gelände-Renderpass, Editoroberfläche und Crowd-/Spieladapter getrennt halten.
  Ein Package mit klaren Einstiegen zunächst mehreren vorsorglichen Packages vorziehen.
- [ ] Öffentliche Daten-/API-Verträge typisieren. Das Labor ist JavaScript/GLSL;
  das Crowd-Package zeigt bereits das Muster JavaScript-Interna mit TypeScript-Fassade.
  Eine vollständige TypeScript-Umschreibung ist keine Vorbedingung der Übernahme.
- [ ] Karte und Gestaltung unabhängig verwenden/exportieren können. Gespeicherte
  tatsächliche Höhen bleiben maßgeblich, nicht eine Neugenerierung allein aus dem Seed.
  Aktive Karte und noch nicht angewendete Editorparameter auseinanderhalten.

## Gemeinsame Oberfläche vor Adapterimplementierung festlegen

Maßgebliche Crowd-Grenzen stehen in den [Typverträgen](../../packages/crowd-simulation/src/contracts.ts),
der [öffentlichen Fassade](../../packages/crowd-simulation/src/index.ts),
dem [Höhenfeld](../../packages/crowd-simulation/src/navigation/heightfield.js)
und der [Navigation](../../packages/crowd-simulation/src/navigation/navigation.js).

- [ ] Rechteckige Laborkarte (520 × 640 m) gegen aktuell quadratisches Crowd-Feld
  über `halfSize` abgleichen. Rechteckunterstützung oder eine bewusst begrenzte
  Zwischenfläche entscheiden; aufgefüllte Bereiche dürfen nicht spielbar werden.
- [ ] Rasterorientierung und Dreiecksteilung gemeinsam festlegen. Das Labor
  speichert Zeilen Süd → Nord, Crowd von −Z → +Z. **Bloßes Umdrehen der Zeilen
  verändert die physische Zellendiagonale.** Höhen/Steigungen zwischen Vertices
  können dann vom sichtbaren Terrain abweichen.
- [ ] Steigungsabtastung an den Oberflächenvertrag binden: Die beiden aktuellen
  Crowd-Proben setzen dessen Diagonale voraus. Andere Höhen-Callbacks allein
  machen eine fremde Triangulierung nicht kompatibel. Die Fassade akzeptiert
  außerdem nur selbst erzeugte Höhenfelder, keine beliebigen Surface-Objekte.
- [ ] Eine Oberfläche für Kollision, Navigation, Picking, Fuß-/Gebäudeauflage und
  Darstellung sicherstellen. Material-Displacement bleibt kosmetisch. Bereits
  exportierte Höhenskalierung nicht erneut auf Gameplay-Geometrie anwenden.
- [ ] Randverhalten und Portale vereinbaren: Lab-Abfragen außerhalb liefern keinen
  Boden; Crowd-Höhenabfragen klemmen, Navigation hält Körper vom Rand fern.
  Spawn-/Zielbereiche deshalb innerhalb des nutzbaren Korridors festlegen.

## Weggarantie auf Bewegungsprofile beziehen

- [ ] Grad und Gradient explizit umrechnen: 35° entsprechen `tan(35°) ≈ 0,7002`;
  Crowd-Demoprofile verwenden derzeit `maxSlope: 0.6` (etwa 31°). Bestehende
  Profilwerte nicht stillschweigend auf den Generierungsgrenzwert erhöhen.
- [ ] Aufstieg, sämtliche Äste und Rundwege nach Crowd-Körperfreiheit prüfen,
  nicht nur nach dem Lab-Raster für Radius 0. Die Laborkorridore haben konstruktive
  Steigungsreserve; daraus folgt noch keine allgemeine Profil-/Kapazitätsgarantie.
- [ ] Marines/Panzer mit tatsächlichen Radien, konservativer Rasterfreistellung,
  Kurven, Kreuzungen sowie Spawn-/Ankunftsflächen berücksichtigen. Ein statisch
  durchgängiger Weg beweist weder Gruppenankunft noch Gegenverkehr-Liveness.
- [ ] Klare Besitzgrenzen: Landschaft liefert unveränderliche Geometrie und
  Generierungsbedingungen; Crowd besitzt Bewegung und profilbezogene Navigation.
  Keine zweite Bewegungssimulation oder konkurrierende Positionskorrektur.

## Auslieferung und Darstellung

- [ ] [Offline-Ladevertrag](../architecture.md#auslieferung) erhalten: Labor-ESM,
  Shader-/Asset-`fetch` und Modul-Worker sind nicht direkt mit `file://` und den
  klassischen synchronen Spielbundles kompatibel. Browser-Bundle, eingebettete
  Shader, Worker-Auslieferung und serverlosen Karten-/Texturimport festlegen.
- [ ] Vorhandenen Laborrenderer nicht als zweite autonome Renderanwendung einsetzen:
  WebGL-Kontext, Kamera, Frameplanung, Resize/Clear und gemeinsame Licht-/Bildpipeline
  gehören beim Spielbetrieb dem Host. Ressourcenbindung und vollständiges `dispose()`
  einschließlich Worker, Timer, Listener und GPU-Objekte vereinbaren.
- [ ] Asset-/Laufzeitbudget nach [Assetpflege](../assets.md) und Zielgeräten bestimmen.
  Optionale Laborquellen sind derzeit ungefähr 96 MiB und enthalten PNGs; nicht
  ungeprüft als Standardpayload übernehmen. Farb-, Normalen- und Datenkanäle bei
  einer WebP-/Laufzeitaufbereitung getrennt auf Qualitätsverluste prüfen.

## Größe und Suchkosten gezielt untersuchen

- [ ] Rasterauflösung vor Übernahme der Demo-Einstellungen entscheiden. Die
  öffentliche Crowd-Fassade verlangt derzeit gleiche Höhenfeld-/Navigationsauflösung;
  feinere Navigation ist kein unabhängiger Regler zum 2-m-Laborhöhenfeld.
- [ ] Ein 640-m-Quadrat bei 0,5 m ergibt rund 1,64 Mio. Navigationszellen: analytisch
  etwa 50 MiB allein für acht Int32-Nachbarn pro Körperklasse und weitere 31 MiB
  für Kosten/Nachfolger/Flussvektoren je Zielfeld, ohne Heap-/Solverkosten.
  Keine gemessenen Gerätewerte oder Aussage, dass dieser Maßstab bereits trägt.
- [ ] Globale Spawn-/Parkplatzsuche und Zielfeldaufbau für die große Karte gesondert
  betrachten. Gröberes Raster senkt Gitterkosten, begrenzt aber nicht automatisch
  die geometrische Kandidatensuche. Kein vorsorglicher Solverumbau ohne Befund.

## Empfohlene Reihenfolge und Abnahme

1. Gemeinsamen Oberflächenvertrag einschließlich Diagonale, Rand und Skalierung entscheiden.
2. Landschaftskern mit typisierter Package-Grenze und Offline-Build übernehmen.
3. Kleine gemeinsame Demo mit importierter Landschaft, Marines und Panzern anbinden;
   noch kein komplettes Gefecht und kein Austausch bestehender Spielnavigation.
4. Höhenübereinstimmung an Ecken, Zellinneren und beiden Dreiecken sowie sämtliche
   Äste, Breiten, Körperfreiheit und Ankunftsbereiche gezielt prüfen. Export-/Import-
   Roundtrips ersetzen diese Crowd-Vertragsprüfung nicht.
5. Nach eigener Freigabe Suchkosten und tatsächliche Gruppen-/Gegenverkehrsankunft
   untersuchen; danach Terrain-Renderpass und vollständige Spielanbindung angehen.

Build-/Vertragsprüfungen nach [Prüfregeln](../testing.md) auswählen. Keine automatische
Freigabe für breite KI-/Simulationsläufe, Langläufe oder Geräteabnahme. Visuelle
Lesbarkeit, Fuß-/Fahrphysik und Zielgeräteperformance bleiben menschlich abzunehmen.
Bestehende RNG-Reihenfolge, Hindernisse, Radien, Referenzen und Save-Verträge schützen.

Verwandte offene Arbeit: [Terrain/Starts](terrain-generation.md),
[Navigation/Liveness](navigation-worker-und-gruppenankunft.md),
[Performance/Mobilstabilität](performance-und-mobilstabilitaet.md) und
[menschliche Bildabnahme](landschaften-und-taktische-darstellung.md).
