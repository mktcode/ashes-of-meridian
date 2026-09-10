# Architektur

## Status und Geltungsbereich

Bestandsaufnahme des Ausgangsstands `ab92a12`, ergänzt um Referenztests, CSS-Auslagerung, JavaScript-Formatierung und die Auslagerung aller acht JavaScript-Bereiche in lokale Dateien. Dieses Dokument beschreibt zunächst den vorhandenen Code; das Zielbild am Ende ist noch nicht implementiert. Die sieben ursprünglichen Skript-Tags wurden benannt, der zentrale CSS-Block unverändert ausgelagert und JavaScript ohne Änderung der Syntaxbäume lesbar formatiert. Assets und eingebettete Texturen blieben unverändert.

`index.html` (statisches HTML und Dateieinbindungen), die acht JavaScript-Dateien laut Codekarte und `styles.css` (zentrales Stylesheet) sind die maßgeblichen, von Hand bearbeiteten Quellen und zugleich ausgelieferte Dateien. Es gibt weder ein `src/`-Verzeichnis noch generierte Dateien oder einen Build-Prozess. Inline-Styles im HTML beziehungsweise in JS-Templates bleiben vorerst bestehen. JavaScript-Methoden sind nun mehrzeilig formatiert; lange Bild-Data-URLs und Template-Inhalte bleiben bewusst unverändert. Ablauf und Prüfungen: [JavaScript-Formatierung](javascript-formatting.md).

## Codekarte

Im `<head>` bindet `<link rel="stylesheet" href="./styles.css">` das lokale Stylesheet ein. Nach dem statischen HTML folgen acht lokale klassische Skripte. `index.html` enthält keine Inline-Skriptinhalte mehr. Sie teilen sich globale lexikalische Bindungen und werden synchron in Dokumentreihenfolge ausgeführt; kein `async`, `defer` oder `type="module"`. Die folgende Nummerierung beschreibt diese Reihenfolge, keine unabhängigen ES-Module. Zur Navigation die Symbolnamen in den unten angegebenen Dateien suchen; das statische DOM steht in `index.html`. Die Tags tragen `data-meridian-script` mit den Namen `core`, `renderer`, `content`, `world`, `simulation`, `audio`, `ui` und `app`; das Attribut dient nur der Identifikation durch Tests.

| Block | Einstieg / wichtige Symbole | Zuständigkeiten heute |
| --- | --- | --- |
| 1 / `core` | `M4`, `V`, `seeded` in `core.js` | Matrizen, Vektoren und Seed-RNG, ohne Browserabhängigkeiten |
| 2 / `renderer` | `MAT`, `MERIDIAN_TEXTURES`, `geom`, Shaderkonstanten und `MeridianRenderer` in `renderer.js` | Eingebettete Texturen, Meshes, GLSL-Shader, WebGL-Ressourcen, Kamera und Renderpässe |
| 3 / `content` | `FACTIONS`, `UNITS`, `BUILDINGS`, `TECH`, `META`, `BIOMES`, `CAMPAIGN`, `ACTS`, `ICON_PATHS` und Hilfsfunktionen in `content.js` | Spieldefinitionen, Balancing, Kampagne, Texte, Icons und Namenshelfer |
| 4 / `world` | Kartenkonstanten, Hilfsfunktionen, `Heap`, `Battlefield`, `renderEntity` in `world.js` | Kartenkonstanten, Terrain, Hindernisraster, Navigation, Sichtbarkeit und prozedurale Entitätsmodelle |
| 5 / `simulation` | `DIFFICULTY`, `MeridianGame`, `formatTime` in `simulation.js` | Missionsaufbau, Entitäten, Befehle, Wirtschaft, Kampf, KI, Ziele, Effektdaten und Snapshot/Restore |
| 6 / `audio` | `MeridianAudio` in `audio.js` | Prozedurales Web Audio für Musik und Geräusche |
| 7 / `ui` | `Store`, `defaultProfile`, `readProfile`, `MeridianUI` in `ui.js` | Speicherung, Fortschritt, Menüs, HUD, Eingabe, Kamera-Steuerung, Import/Export und Canvas-Overlay |
| 8 / `app` | IIFE und `window.Meridian` in `app.js` | Verdrahtung, Spielschleife, Menüvorschau, Szenendarstellung, Effekte und Fehlerbehandlung |

Wichtige Abhängigkeiten:

- `Battlefield` verwendet Definitionen aus `content`, Mathematik aus `core`, Geometrie aus `renderer` und eine Renderer-Instanz. Es berechnet nicht nur die Welt, sondern erzeugt auch statische Renderdaten und lädt Nebeldaten auf die GPU.
- `MeridianGame` hält Renderer, Profil und `Battlefield`. Der `emit(type, data)`-Callback wird im Einstiegspunkt an `MeridianUI.event()` angeschlossen.
- `MeridianUI` greift direkt auf `game.s`, Renderer, Audio, DOM und Speicherung zu. Der Ereignis-Callback ist deshalb noch keine vollständige Entkopplung.
- `app` erstellt alle Instanzen. Die `requestAnimationFrame`-Schleife führt bei aktivem, ungepaustem Spiel `game.step(0.05)` und `tickEffects(0.05)` aus; UI und Rendering werden pro Frame aktualisiert.
- `window.Meridian` stellt die laufenden Instanzen, Inhalte und Leistungswerte zur Inspektion bereit. Die übrigen globalen `const`-/`class`-Bindungen sind nicht automatisch Eigenschaften von `window`.

## Zustände und Speicherung

- `game.s` enthält den serialisierbaren Operationszustand, einschließlich Entitäten, Ressourcen, Aufträgen, Missionsdaten, Kamera und Kontrollgruppen.
- Welt-Raster, Suchindizes (`ids`, `spatial`), RNG-Closure und kurzlebige Effekte liegen außerhalb von `game.s`.
- `snapshot()` klont `game.s` und ergänzt erkundete Kartenfelder. `restore()` validiert Teile der Daten, rekonstruiert Welt und Indizes und ersetzt bei Kampagnenmissionen die Missionsdefinition durch den aktuellen `CAMPAIGN`-Eintrag.
- Profil und Operation verwenden Version 1 und die Storage-Schlüssel `meridian.profile.v1` beziehungsweise `meridian.operation.v1`.
- Exportierte Backups tragen `format: 'ashes-of-meridian'`, `version: 1`, `profile` und optional eine Operation. UI-Import und `restore()` prüfen unterschiedliche Teile des Formats; ein vollständig validiertes Schema gibt es nicht.
- `Store` fängt Storage-Ausnahmen ab und bietet einen flüchtigen In-Memory-Ersatz. Das ist keine dauerhafte Sicherung; Backup-Export bleibt wichtig.

Daraus folgt: Nicht nur Feldnamen und Versionen, sondern auch Kampagnenindizes, Definitionen und Kartenlayout sind für bestehende Spielstände relevant.

## Assets und direkter Dateistart

Alle über `<script src>` eingebundenen lokalen JavaScript-Dateien sowie `styles.css` liegen neben `index.html` und müssen mit ausgeliefert werden. `core.js` wird über `<script data-meridian-script="core" src="./core.js"></script>` vor den übrigen Skripten geladen; Funktionen und globale Bindungen bleiben erhalten. Die [Core-Auslagerungsprüfung](core-extraction.md) bestätigt den direkten Dateistart. `content.js` wird entsprechend über `<script data-meridian-script="content" src="./content.js"></script>` an der bisherigen Stelle zwischen `renderer` und `world` geladen. Werte, Texte und Reihenfolge blieben unverändert; siehe [Content-Auslagerung](content-extraction.md).

Das Stylesheet enthält derzeit keine `url(...)`- oder `@import`-Verweise. Künftig beziehen sich relative Asset-URLs im Stylesheet auf dessen Speicherort. Die [CSS-Auslagerungsprüfung](css-extraction.md) bestätigt das Laden über `file://` in Chromium ohne Server oder besondere Sicherheitsflags.

`renderer.js` wird über `<script data-meridian-script="renderer" src="./renderer.js"></script>` zwischen `core` und `content` geladen. Der frühere Inline-Block wurde vollständig bytegleich übernommen, bewusst ohne Bereinigung seiner Einrückung oder mehrzeiligen Shaderliterale; siehe [Renderer-Auslagerung](renderer-extraction.md). `Image.src` für die Skybox bezieht sich weiterhin auf das HTML-Dokument, nicht auf die Skriptdatei.

`MERIDIAN_TEXTURES` in `renderer.js` enthält drei eingebettete Bild-Data-URLs. Die danebenliegenden `texture-floor-*.png` werden vom aktuellen Renderer nicht als Dateien geladen. Ihre Bearbeitung allein ändert die eingebetteten Texturen nicht; ein automatischer Abgleich existiert nicht.

`skybox.webp` wird dagegen über eine relative URL mit `Image` geladen und als WebGL-Textur hochgeladen. Daher ist die Anwendung nicht vollständig auf eine Datei reduziert. Der Renderer legt zunächst eine dunkle Ersatztextur an. Beim Chromium-152-Test über `file://` wurde der GPU-Upload vor und nach der CSS-Auslagerung mit einem `SecurityError` blockiert; die dunkle Ersatztextur blieb bestehen. Das ist eine bestehende, nicht durch das CSS verursachte Einschränkung. Andere Browser sind separat zu prüfen; Node-Tests decken das nicht ab.

## Bekannte Kopplungen und Risiken

1. **RNG und Darstellung:** `Battlefield.generate()` verbraucht eine Zufallsfolge für Bodenfarben, Hindernisse und Dekoration. Ihre Aufrufreihenfolge ist layoutrelevant. Felsmeshes und Kristallmodelle besitzen bereits separate kosmetische Generatoren; `MeridianGame.explosion()` und Arbeitereffekte verwenden dagegen `this.random` aus der Simulation. Eine andere Partikelanzahl kann spätere Zufallsentscheidungen ändern.
2. **Laden ist keine exakte Fortsetzung des RNG:** Der Generatorzustand wird nicht serialisiert. Beim Start wird `seed + 77`, beim Restore `seed + floor(time * 50)` verwendet. Feste Zeitschritte und reproduzierbare Karten sind kein Nachweis für identischen Verlauf nach Save/Load.
3. **Breite Verantwortlichkeiten:** `Battlefield`, `MeridianGame`, `MeridianUI` und der Einstiegspunkt mischen jeweils mehrere Aufgaben. Reines Verschieben in Dateien löst diese Kopplungen nicht.
4. **Implizite Schnittstellen:** Entitäten, Befehle und Ereignisse sind untypisierte Objekte; der Renderer verwendet eine lange positionale `add(...)`-Signatur. Globale Bindungen und Ausführungsreihenfolge ersetzen explizite Imports.
5. **Strukturabhängige Tests:** Der gemeinsame Loader unter `tests/helpers/game-scripts.cjs` liest benannte klassische Inline-/Dateiskripte mit bewusst begrenztem HTML-/Pfadvertrag. Aufrufer nennen ihre Abhängigkeiten explizit; Ausführung bleibt in Dokumentreihenfolge. Bei einer späteren Modulaufteilung den Testzugriff anpassen, nicht die Verhaltensprüfungen abschwächen.

Diese Punkte sind Befunde, keine bereits vorgenommenen Fehlerkorrekturen. Insbesondere RNG- und Save-Änderungen müssen getrennt von strukturellen Refactorings geplant werden.

## Nächste Schritte und späteres Zielbild

### Zunächst: Referenzverhalten absichern

Bereits umgesetzt: gemeinsamer Testloader und Renderer-Teststub, Syntaxprüfung aller benannten Skripte sowie Referenztests für Missionsstart, Befehle, Produktion, Ressourcen und Wiederherstellung eines Version-1-Spielstands aus `ab92a12`. [Herkunft und Grenzen der Referenztests](reference-tests.md) sind dokumentiert; Erwartungen werden nicht während des Testlaufs erzeugt.

Vor weiteren Umbauten:

1. Für den jeweils betroffenen Bereich fehlende Fälle ergänzen, etwa weitere Missionstypen, Bau-/Kampfregeln oder Save-Validierung. Die bisherigen Referenzen decken nur ausgewählte Szenarien ab.
2. Die vorhandenen Layout-Prüfsummen unverändert beibehalten. Nur tatsächlich zugesicherte Save/Load-Eigenschaften prüfen, nicht vollständige Deterministik unterstellen.
3. Den direkten Browserstart anhand der [Checkliste](testing.md#manuelle-browser-prüfung) prüfen, bevor eine neue Verpackung eingeführt wird.

### Anschließend: schrittweise entkoppeln

Als erster rein struktureller Schritt wurde das zentrale CSS ohne Umformatierung nach `styles.css` verschoben. Weitere Aufteilungen des Stylesheets oder Bereinigung der Inline-Styles erfolgen getrennt und nur bei konkretem Bedarf.

Nach dem separaten Formatierungscommit wurden `M4`, `V` und `seeded` zunächst im alten Renderer-Block getestet und anschließend unverändert nach `core.js` ausgelagert. Der Testloader unterstützt jetzt explizite lokale klassische Skriptdateien. Globale Bindungen und Dokumentreihenfolge bleiben erhalten; noch keine ES-Module oder neue Build-Werkzeuge.

Anschließend wurde der vollständige `content`-Block samt `icon`, `unitName` und `buildingName` unverändert nach `content.js` verschoben. Ein zusätzlicher Isolationstest bestätigt das Laden ohne Renderer, Core oder Browserglobals. Dies verbessert die Quellenübersicht, führt aber noch keine expliziten Modulschnittstellen ein.

Danach wurde der gesamte Renderer-Block bytegleich nach `renderer.js` ausgelagert. Die anschließende [Auslagerungsserie](script-extraction.md) hat `world`, `simulation`, `audio`, `ui` und `app` jeweils separat und vollständig bytegleich in gleichnamige lokale Skripte verschoben, einschließlich der bisherigen Hilfsfunktionen und noch gekoppelten Darstellungs- und Speicheraufgaben. Die reine Dateiaufteilung ist abgeschlossen; `index.html` enthält nur noch HTML und Dateieinbindungen. Die Aufteilung in Dateien und echte Entkopplung bleiben getrennte Schritte.

Für eine spätere Entkopplung eignet sich etwa Speicherformat-Validierung; dafür zunächst passende Charakterisierungstests ergänzen. Danach Weltberechnung von Renderdaten, Simulation von kosmetischen Effekten sowie UI-Ansichten von Eingabe und Persistenz trennen. Bestehende Verhaltensabhängigkeiten dabei zunächst erhalten; absichtliche Korrekturen separat prüfen. Kein vollständiger Rewrite und kein neues UI-Framework sind dafür nötig.

### Perspektive: TypeScript-Quellen, einfaches Auslieferungsartefakt

Die langfristige Grenze soll zwischen **Entwicklungsquellen** und **Spielartefakt** verlaufen: Module für `core`, `content`, `simulation`, `rendering`, `ui` und `persistence`, verbunden durch einen kleinen Einstiegspunkt. Die Simulation soll ohne DOM, WebGL und Storage ausführbar sein; Browserzugriffe liegen in den äußeren Bereichen.

TypeScript kann bereichsweise eingeführt werden, zunächst für Definitionen, Zustände, Befehle und Ereignisse. Ein kleiner Build, etwa mit esbuild, könnte die Module als klassisches Inline-Skript zusammen mit CSS in eine direkt öffnungsfähige HTML-Datei einsetzen. Typprüfung wäre separat über `tsc --noEmit` nötig.

Noch offen sind Toolwahl, Quellenlayout, Asset-Einbettung und Ablage des fertigen Artefakts. Verbindlich bleibt: Zum Spielen keine Paketinstallation, kein erforderlicher Server, keine CDN-Abhängigkeiten oder Laufzeit-Imports. Vor Einführung des Builds festlegen, welche Dateien generiert sind und wie das fertige HTML ohne Build verfügbar bleibt. Keine parallel von Hand gepflegte zweite Codekopie anlegen.
