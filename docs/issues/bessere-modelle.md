# Bessere, einzeln wartbare 3D-Modelle

**Status:** in Umsetzung · Infrastruktur und zeichnungsidentische Auslagerung geprüft; Detailmodell folgt · erster Pilot: **Fraktion 0 / building / barracks**

Bis auf das HQ von Fraktion 0 und den Aether Vent sind die 3D-Modelle noch sehr einfach. Gebäude und Einheiten sollen einzeln auf einen vergleichbaren Detailgrad gebracht werden können, ohne dass jeder Modellauftrag dieselben zentralen Rendererdateien umbaut oder unbeteiligte Modelle verändert.

## Aktueller Engpass

Ein detailliertes Modell ist derzeit über mehrere zentrale Stellen verteilt:

- `src/renderer/geometry.js` enthält generische Primitive, Terrainmeshes und alle bereits detaillierten Entitätsmeshes in einem 600-Zeilen-Objekt.
- `src/renderer/runtime.js` erzeugt und lädt die Meshes über eine feste, zentrale Liste.
- `renderEntity()` in `src/world-view.js` enthält in weiteren rund 600 Zeilen Auswahl, Transformation und sämtliche Modellteile aller Fraktionen.
- Modelltests stehen gemeinsam in `tests/ashes-of-meridian-presentation.check.cjs`.
- Das zugehörige 320×320-Aktionsportrait wird separat und bislang nur manuell gepflegt.

Dadurch berührt ein bisheriger Modellauftrag regelmäßig drei gemeinsame Laufzeitdateien sowie eine große gemeinsame Testdatei. Parallele Arbeit verursacht leicht Konflikte. Außerdem duplizieren `commandHull()`, `workerHull()` und `turretAssembly()` lokale Helfer zum Transformieren von Primitiven, Erzeugen abgeschrägter Körper und Berechnen neuer Flächennormalen.

Die Barracks von Fraktion 0 besteht aktuell nur aus der gemeinsamen Gebäudeplattform sowie zwölf Box-Instanzen und einem Zylinder (insgesamt 15 Zeichenaufträge). Sie besitzt kein eigenes Mesh. Das HQ verwendet dagegen `commandHull()` mit 1.152 Dreiecken und zusätzliche, aus der Standardperspektive erkennbare Eingangs-, Dach-, Licht-, Lüftungs- und Antennendetails.

## Ziel

Nach dem Piloten soll ein weiterer Modellauftrag im Wesentlichen in **einer eigenen Modelldatei** stattfinden:

1. eigener stabiler Modellschlüssel ohne Spielernamen,
2. eigene einmalig erzeugte Meshes,
3. eigene Zusammensetzung aus Meshes, Farben, Leuchten und optionalen Bewegungen,
4. kurzer eigener Vertragstest,
5. gegebenenfalls erneuertes Portrait.

Neue Modelle dürfen danach keine neuen Typzweige in `renderEntity()` und keine Einträge im Meshblock des Renderer-Konstruktors erfordern. Unvermeidbar bleibt wegen der klassischen synchronen `file://`-Auslieferung ein expliziter Script-Eintrag in `index.html` und in der Test-Scriptliste. Laufzeit-Imports, ES-Module, dynamisches Nachladen und ein neuer Bundler bleiben ausgeschlossen.

## Vorgesehene Architektur

### Dateien

```text
src/renderer/model-kit.js
src/renderer/models/faction-0-building-barracks.js

tests/helpers/model-contract.cjs
tests/models/faction-0-building-barracks.check.cjs
```

`index.html` lädt `model-kit.js` nach `geometry.js`, anschließend die einzelnen Modelldateien und erst danach Shader/Renderer-Laufzeit. `tests/helpers/game-scripts.cjs` führt dieselben Namen in derselben Dokumentreihenfolge. Das Testkommando soll `tests/models/*.check.cjs` einschließen, damit spätere Modelltests keine weitere zentrale Testdatei ändern müssen.

### Dünne Registry statt vollständiger Model-DSL

`model-kit.js` stellt eine kleine globale Registrierung bereit. Der genaue Vertrag soll sinngemäß so aussehen:

```js
registerEntityModel({
  id: 'faction-0/building/barracks',
  meshes: {
    faction0BarracksHull: () => createBarracksHull()
  },
  render(context) {
    // Zusammensetzung dieses Modells
  }
});
```

Die Registry muss:

- doppelte Modell-IDs und doppelte Mesh-Namen sofort ablehnen,
- nur Funktionen und Daten registrieren, aber beim Laden noch keinen WebGL-Kontext benötigen,
- alle Meshfabriken genau einmal beim Erzeugen von `MeridianRenderer` ausführen,
- anhand von `faction`, `kind` und `type` das passende Modell liefern,
- für noch nicht migrierte Modelle sauber auf die bestehenden Zweige in `renderEntity()` zurückfallen.

Der Modellkontext kapselt die bestehende `p(...)`-Transformation und stellt nur die nötigen Werte bereit: Entität, Zeit, `part(...)`, Effektring sowie `metal`, `dark`, `team` und `accent`. Damit bleiben Weltposition, `BUILDING_YAW`, Gegnerdrehung, Baufortschritt, Ghost-/Preview-Tint, Alpha, Layer und Material zentral korrekt. Modelldateien sollen nicht direkt auf Simulationszustand, UI oder WebGL zugreifen und `R.add(...)` nicht selbst nachbauen.

Die gemeinsamen Meshhilfen werden nur so weit ergänzt, wie der Pilot sie wirklich benötigt, zunächst insbesondere:

- ein vorhandenes Primitiv mit Translation, Skalierung und Rotation in ein Zielmesh backen,
- dabei nach nichtuniformer Skalierung korrekte flache Normalen neu berechnen,
- einen geschlossenen abgeschrägten Kasten/Panzerkörper erzeugen.

Keine große deklarative Modellbeschreibung und keine vorsorgliche Bibliothek für jede denkbare Form. Radialprofile, Gelenke oder weitere Helfer werden erst extrahiert, wenn mindestens ein konkretes Folgemodell sie benötigt. Die bestehenden HQ-, Worker-, Turret- und Vent-Meshes werden im Pilot-Refactoring nicht nebenbei migriert.

### Klare Zuständigkeiten

- `geometry.js`: allgemeine Primitive sowie vorerst bestehende Terrain-/Legacy-Meshes.
- `model-kit.js`: Registry, Mesh-Namensprüfung und wenige allgemeine Modellbauhilfen.
- `models/faction-0-building-barracks.js`: ausschließlich Geometrie und Darstellung der Barracks von Fraktion 0.
- `runtime.js`: lädt allgemeine Meshes plus die Meshfabriken der Registry, kennt aber keine einzelne Entität mehr.
- `world-view.js`: berechnet den gemeinsamen Darstellungskontext, fragt die Registry ab und behält vorerst den Legacy-Fallback.
- `tests/helpers/model-contract.cjs`: wiederverwendbare Prüfungen für Meshdaten und Darstellungsvarianten.

## Pilotmodell: Fraktion 0 / building / barracks

Der Anzeigename „Muster station“ bleibt Content in `src/content.ts` und darf weder Datei- noch Meshname werden.

### Gestalterisches Ziel

Die Barracks soll eindeutig zur industriellen Formsprache des Fraktion-0-HQs gehören, ohne wie ein verkleinertes HQ oder wie die Factory auszusehen:

- niedrige, breite militärische Silhouette innerhalb des bestehenden Fundaments,
- geschlossene abgeschrägte Hauptpanzerung statt eines großen glatten Quaders,
- klar erkennbare, zurückgesetzte Truppenschleuse an der lokalen **+Z-Front**; dort liegt auch die bestehende Produktionsausfahrt,
- seitliche Stütz-/Versorgungsmodule und ein lesbarer Dachaufbau,
- größere Paneelfugen, Lüftungs- oder Kühlgitter und wenige robuste Dachrippen,
- Teamfarbe und Cyan-Akzent an aus der Standardkamera sichtbaren Kanten/Leuchten,
- dunkle Vertiefungen und relative Vertex-Tints für Materialtiefe,
- keine winzigen Details, die nur im Portrait sichtbar sind und im Gefecht flimmern.

Nichtemissive, unbewegte Details sollen möglichst in `faction0BarracksHull` gebacken werden. Teamfarbene oder leuchtende Teile bleiben separate Instanzen, damit Gegnerfarbe, Ghost/Preview und Bauzustand unverändert funktionieren. Ein HQ-ähnlicher Detailgrad bedeutet nicht, dessen 50 Zeichenaufträge zu kopieren: Ziel sind grob **900–1.500 Dreiecke** im Hauptmesh und insgesamt höchstens etwa **20 Zeichenaufträge** einschließlich gemeinsamer Plattform.

### Zu erhaltende Grenzen

- `BUILDINGS.barracks.size === 3`, HP, Kosten, Bauzeit, Produktion, Queue und Voraussetzungen unverändert.
- Keine Änderung an Kollision, Navigation, Spawn-/Ausfahrtsposition oder `BUILDING_YAW`.
- Feste Hauptgeometrie ungefähr innerhalb der heutigen sichtbaren Grenzen: X ±3,1 m, Z −2,2 bis +2,25 m; nur Dachaufbauten dürfen bis etwa Y 4,6 m reichen.
- Front bleibt lokale +Z-Richtung; Gegnergebäude bleiben um π gedreht.
- Baufortschritt skaliert das Modell wie bisher vertikal mit mindestens 0,15.
- Team-/Gegnerfarbe, Ghost-Tint, Preview-Tint, Alpha, Material und Layer bleiben erhalten.
- Keine neue Animation, kein RNG-Aufruf, keine Textur, kein Shader und kein zusätzlicher Simulationszustand.
- Andere Fraktionen und alle anderen Entitätsmodelle bleiben zeichnungsidentisch.

## Umsetzung in getrennten Schritten

### 1. Ausgangszustand sichern

- Zeichenaufrufe aller Fraktions-/Team-/Entitätstypen vor dem Umbau erfassen.
- Aktuelle Barracks-Grenzen, Ausrichtung, Bauzustände und Portrait als Vergleich festhalten.
- Keine Referenzfixtures neu erzeugen; beabsichtigte Modelldeltas separat prüfen.

### 2. Infrastruktur und mechanische Migration

- Registry, kleine Meshhilfen, Scriptreihenfolge und Modellteststruktur einführen.
- Den **bestehenden** Barracks-Zweig zunächst ohne visuelle Änderung nach `faction-0-building-barracks.js` verschieben.
- Vorher/Nachher müssen sämtliche Zeichenaufrufe einschließlich Barracks identisch sein.
- Separater Commit, damit Architekturänderung und neue Gestaltung nicht vermischt werden.

### 3. Barracks verfeinern

- `faction0BarracksHull` und die neue Zusammensetzung nur in der Modelldatei implementieren.
- Erwartete Zeichenänderungen auf Fraktion 0 / building / barracks begrenzen.
- `assets/portraits/faction-0-building-barracks.webp` aus dem tatsächlichen fertigen Modell neu als 320×320-WebP, Qualität 80, rendern; keine PNG-Datei einchecken.
- Grafikreferenz und Worklog direkt auf den neuen Stand bringen.

### 4. Pilot auswerten

Vor der Migration weiterer Modelle prüfen:

- Reicht der Kontext für Gebäude, Worker und drehbare Waffen, ohne Rendererdetails durchzureichen?
- Sind Dateigrenzen und Tests tatsächlich konfliktarm für parallele Aufträge?
- Welche Meshhilfen wurden mindestens zweimal benötigt und gehören wirklich in `model-kit.js`?
- Lohnt sich als eigener Folgeauftrag eine nicht ausgelieferte `file://`-Modellvorschau mit Modellwahl, Drehung, Team-, Bau- und 320×320-Portraitansicht? Kein Browserautomationspaket nur für den Piloten hinzufügen.

Erst danach vorhandene detaillierte Modelle mechanisch migrieren oder das nächste einfache Modell auswählen.

## Wiederverwendbarer Modelltestvertrag

Der gemeinsame Testhelfer soll pro neuem Mesh mindestens prüfen:

- deterministische, synchrone Erzeugung ohne `Math.random`/Simulations-RNG,
- Vertexstride von neun Zahlen, ausschließlich endliche Werte,
- keine degenerierten Dreiecke,
- zur Geometrie passende flache Einheitsnormalen,
- begründete lokale Bounds und ein großzügiges Polygonbudget,
- gültige relative Vertex-Tints.

Der kurze Test des einzelnen Modells prüft zusätzlich:

- Registrierung nur unter der vorgesehenen Fraktion/Art/dem vorgesehenen Typ,
- keine Meshfabrikerzeugung während `renderEntity()`,
- unveränderte Eingabeentität,
- Weltposition, Front/Yaw und Gegnerdrehung,
- Baufortschritt 0 / teilweise / fertig,
- Team-, Ghost- und Preview-Tint samt Alpha/Layer/Material,
- begrenzte Zeichenaufrufe und die wesentlichen sichtbaren Merkmale, nicht jedes dekorative Einzelteil als spröden Snapshot,
- keine Änderung der Zeichenaufrufe aller unbeteiligten Modelle.

## Abnahme des Piloten

- [ ] Infrastruktur und visuelle Änderung liegen in getrennten Commits.
- [x] Die unveränderte Barracks wurde vor der Detailarbeit zeichnungsidentisch migriert.
- [ ] Danach wird nur Fraktion 0 / building / barracks anders gezeichnet.
- [ ] Silhouette, Front, Teammarkierung und Dachdetails sind bei normalem Spielzoom lesbar.
- [ ] Mesh-, Registry- und Variantenprüfungen bestehen; feste Terrain-/Effekt-/RNG-Referenzen bleiben unverändert.
- [ ] `npm test` besteht vollständig.
- [ ] Chromium-Check direkt über `file://`: fertig, im Bau, Ghost-Vorschau, Spieler/Gegner, Defaultzoom sowie High/Balanced/Performance; GL 0 und keine Lade-/Laufzeitfehler.
- [ ] Neues Portrait ist 320×320, zeigt das aktuelle Modell und lädt in Bauaktionen unter `file://`.
- [ ] Nahansicht und typische Massenszene werden visuell geprüft; Draw Calls, Dreiecke und Framerate werden festgehalten. Das ersetzt keinen späteren Echtgerätetest.
- [ ] Kein `dist/`, keine PNGs und keine unbeabsichtigten Asset-/Gameplayänderungen im Commit.

## Nicht Teil des Piloten

- neue Einheiten/Gebäude oder Balancingänderungen,
- neue Kollisionskörper, Spawnregeln oder Animationen,
- neue Materialien, Texturen, Shader, LODs oder Qualitätsstufen,
- gleichzeitige Überarbeitung anderer Modelle,
- vollständige TypeScript-Migration des Renderers,
- Runtime-Imports, ES-Module, dynamisches Laden oder ein allgemeiner Assetbundler,
- automatische Portraitpipeline ohne separat begründeten Folgeauftrag.

## Folgeaufträge nach erfolgreichem Pilot

Jedes weitere Modell erhält ein eigenes kleines Issue mit stabiler technischer ID, Referenzansichten, Silhouettenziel, erlaubten Bounds/Animationen, Polygon-/Draw-Call-Budget, betroffenen Portraits und genau den notwendigen Prüfungen. Sinnvolle Reihenfolge innerhalb von Fraktion 0: zuerst die häufig sichtbaren Produktionsgebäude, danach Kampfeinheiten; Modelle anderer Fraktionen erst nach Auswertung der gemeinsamen Hilfen und realer Geräteperformance.
