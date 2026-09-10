# Architektur

## Status und Geltungsbereich

Bestandsaufnahme des Ausgangsstands `ab92a12`, ergänzt um Referenztests, CSS-Auslagerung, JavaScript-Formatierung und die Auslagerung aller acht ursprünglichen JavaScript-Bereiche in lokale Dateien sowie die Entkopplung der Speicherung, der Weltberechnung vom Renderer und der kosmetischen Effektkomponente. Dieses Dokument beschreibt zunächst den vorhandenen Code; das Zielbild am Ende ist noch nicht vollständig implementiert. Die sieben ursprünglichen Skript-Tags wurden benannt, der zentrale CSS-Block unverändert ausgelagert und JavaScript ohne Änderung der Syntaxbäume lesbar formatiert. Assets und eingebettete Texturen blieben unverändert.

`index.html` (statisches HTML und Dateieinbindungen), die JavaScript-Dateien laut Codekarte und `styles.css` (zentrales Stylesheet) sind die maßgeblichen, von Hand bearbeiteten Quellen und zugleich ausgelieferte Dateien. Es gibt weder ein `src/`-Verzeichnis noch generierte Dateien oder einen Build-Prozess. Inline-Styles im HTML beziehungsweise in JS-Templates bleiben vorerst bestehen. JavaScript-Methoden sind nun mehrzeilig formatiert; lange Bild-Data-URLs und Template-Inhalte bleiben bewusst unverändert. Ablauf und Prüfungen: [JavaScript-Formatierung](javascript-formatting.md).

## Codekarte

Im `<head>` bindet `<link rel="stylesheet" href="./styles.css">` das lokale Stylesheet ein. Nach dem statischen HTML folgen die unten aufgeführten lokalen klassischen Skripte. `index.html` enthält keine Inline-Skriptinhalte mehr. Sie teilen sich globale lexikalische Bindungen und werden synchron in Dokumentreihenfolge ausgeführt; kein `async`, `defer` oder `type="module"`. Die folgende Nummerierung beschreibt diese Reihenfolge, keine unabhängigen ES-Module. Zur Navigation die Symbolnamen in den unten angegebenen Dateien suchen; das statische DOM steht in `index.html`. Die Tags tragen `data-meridian-script` mit den Namen `core`, `renderer`, `content`, `world`, `world-view`, `effects`, `effects-view`, `simulation`, `audio`, `persistence`, `ui` und `app`; das Attribut dient nur der Identifikation durch Tests.

| Block | Einstieg / wichtige Symbole | Zuständigkeiten heute |
| --- | --- | --- |
| 1 / `core` | `M4`, `V`, `seeded` in `core.js` | Matrizen, Vektoren und Seed-RNG, ohne Browserabhängigkeiten |
| 2 / `renderer` | `MAT`, `MERIDIAN_TEXTURES`, `geom`, Shaderkonstanten und `MeridianRenderer` in `renderer.js` | Eingebettete Texturen, Meshes, GLSL-Shader, WebGL-Ressourcen, Kamera und Renderpässe |
| 3 / `content` | `FACTIONS`, `UNITS`, `BUILDINGS`, `TECH`, `META`, `BIOMES`, `CAMPAIGN`, `ACTS`, `ICON_PATHS` und Hilfsfunktionen in `content.js` | Spieldefinitionen, Balancing, Kampagne, Texte, Icons und Namenshelfer |
| 4 / `world` | Kartenkonstanten, Hilfsfunktionen, `Heap`, `Battlefield` in `world.js` | CPU-Terrain-/Layoutdaten, Hindernisraster, Navigation und Sichtbarkeit, ohne Renderer |
| 5 / `world-view` | `BattlefieldView`, `renderEntity` in `world-view.js` | Terrain-Mesh, statische GPU-Platzierungen, Fog-Upload und Entitätsmodelle |
| 6 / `effects` | `MeridianEffects` in `effects.js` | Synchrone kosmetische Erzeugung, Effektdaten, Schadenszahlen und Lebensdauer; übergebener RNG |
| 7 / `effects-view` | `drawEffectRing`, `renderBattlefieldEffects` in `effects-view.js` | Nur Zeichnen der übergebenen Effekte, Pings, Felder, Scans und Strike-Markierungen |
| 8 / `simulation` | `DIFFICULTY`, `MeridianGame`, `formatTime` in `simulation.js` | Missionsaufbau, Entitäten, Befehle, Wirtschaft, Kampf, KI, Ziele, Effektaufträge und Snapshot/Restore |
| 9 / `audio` | `MeridianAudio` in `audio.js` | Prozedurales Web Audio für Musik und Geräusche |
| 10 / `persistence` | `createMeridianPersistence` in `persistence.js` | Private Storage-Schlüssel, flüchtiger Ersatz, Profilnormalisierung, Checkpoint-JSON und Backup-Codec; nur ausdrücklich übergebene Abhängigkeiten |
| 11 / `ui` | `MeridianUI` in `ui.js` | Fortschritt, Menüs, HUD, Eingabe, Kamera-Steuerung, Datei-/Download- und Import-Orchestrierung sowie Canvas-Overlay; Speicherung über eine übergebene Instanz |
| 12 / `app` | IIFE und `window.Meridian` in `app.js` | Verdrahtung, Spielschleife, Menüvorschau, Szenendarstellung, Effekte und Fehlerbehandlung |

Wichtige Abhängigkeiten:

- `Battlefield(seed, biome)` verwendet `content` und `core`, aber weder Renderer noch Geometrie. `renderData` enthält CPU-Farben und benannte Platzierungsdaten; die kosmetischen RNG-Samples bleiben wegen der Layoutkompatibilität in der bisherigen Reihenfolge.
- `BattlefieldView.sync(world)` übersetzt diese Daten in Mesh-/Rendereraufrufe und lädt geänderte Fog-Pixel. `app` synchronisiert vor dem Start-Ereignis an die UI sowie vor dem Zeichnen; die Menüvorschau nutzt denselben Adapter ohne Fog.
- `MeridianGame(profile, emit, createEffects)` hält Profil, `Battlefield` und eine Effektkomponente, keinen Renderer. Die optionale Factory erhält einen Provider für den jeweils aktuellen Spiel-RNG; standardmäßig erstellt sie `MeridianEffects`. Der `emit(type, data)`-Callback wird im Einstiegspunkt nach der nötigen Welt-Synchronisierung an `MeridianUI.event()` angeschlossen.
- `MeridianUI` greift weiterhin direkt auf `game.s`, Renderer, Audio und DOM zu, erhält die Speicherung aber als fünftes Konstruktorargument. Weder Storage-Schlüssel noch Profilnormalisierung oder Backup-JSON-Verarbeitung liegen noch in der UI. Der Ereignis-Callback ist trotzdem keine vollständige Entkopplung.
- `createMeridianPersistence` kennt weder UI noch Spielinstanz oder Browserglobals. `app` übergibt einen verzögerten Storage-Zugriff, `clamp`, Upgrade-Grenzen aus `META`, gültige Schwierigkeiten aus `DIFFICULTY` und einen Warn-Callback. Die Speicherinstanz besitzt ihren eigenen flüchtigen Ersatz.
- `app` erstellt und verdrahtet alle Instanzen, lädt das Profil über die Speicherkomponente und übergibt diese der UI. Die `requestAnimationFrame`-Schleife führt bei aktivem, ungepaustem Spiel `game.step(0.05)` und `game.effects.tick(0.05)` aus; UI und Rendering werden pro Frame aktualisiert.
- `window.Meridian` stellt die laufenden Instanzen, Inhalte und Leistungswerte zur Inspektion bereit. Die übrigen globalen `const`-/`class`-Bindungen sind nicht automatisch Eigenschaften von `window`.

## Zustände und Speicherung

- `game.s` enthält den serialisierbaren Operationszustand, einschließlich Entitäten, Ressourcen, Aufträgen, Missionsdaten, Kamera und Kontrollgruppen.
- Welt-Raster, Suchindizes (`ids`, `spatial`), RNG-Closure und kurzlebige Effekte liegen außerhalb von `game.s`.
- `snapshot()` klont `game.s` und ergänzt erkundete Kartenfelder. `restore()` validiert Teile der Daten, rekonstruiert Welt und Indizes und ersetzt bei Kampagnenmissionen die Missionsdefinition durch den aktuellen `CAMPAIGN`-Eintrag.
- Profil und Operation verwenden Version 1 und die Storage-Schlüssel `meridian.profile.v1` beziehungsweise `meridian.operation.v1`.
- Exportierte Backups tragen `format: 'ashes-of-meridian'`, `version: 1`, `profile` und optional eine Operation. Backup-Codec und `restore()` prüfen unterschiedliche Teile des Formats; ein vollständig validiertes Schema gibt es nicht.
- Der private `Store` in der Speicherkomponente fängt Storage-Ausnahmen ab und bietet einen flüchtigen In-Memory-Ersatz. Das ist keine dauerhafte Sicherung; Backup-Export bleibt wichtig.

Der frühere Profilwert `settings.wasd` ist entfallen: Tastaturkamera ist fest WASD, Attack-Move fest F. Alte Version-1-Profile/Backups werden weiter gelesen; der obsolete Wert wird bei der Normalisierung entfernt. Keine automatische Schreibmigration beim Start, keine Änderung an Operationsdaten oder Storage-Schlüsseln. [Kompatibilität und Prüfungen](wasd-controls.md).

Daraus folgt: Nicht nur Feldnamen und Versionen, sondern auch Kampagnenindizes, Definitionen und Kartenlayout sind für bestehende Spielstände relevant.

## Assets und direkter Dateistart

Alle über `<script src>` eingebundenen lokalen JavaScript-Dateien sowie `styles.css` liegen neben `index.html` und müssen mit ausgeliefert werden. `core.js` wird über `<script data-meridian-script="core" src="./core.js"></script>` vor den übrigen Skripten geladen; Funktionen und globale Bindungen bleiben erhalten. Die [Core-Auslagerungsprüfung](core-extraction.md) bestätigt den direkten Dateistart. `content.js` wird entsprechend über `<script data-meridian-script="content" src="./content.js"></script>` an der bisherigen Stelle zwischen `renderer` und `world` geladen. Werte, Texte und Reihenfolge blieben unverändert; siehe [Content-Auslagerung](content-extraction.md).

Das Stylesheet enthält derzeit keine `url(...)`- oder `@import`-Verweise. Künftig beziehen sich relative Asset-URLs im Stylesheet auf dessen Speicherort. Die [CSS-Auslagerungsprüfung](css-extraction.md) bestätigt das Laden über `file://` in Chromium ohne Server oder besondere Sicherheitsflags.

`renderer.js` wird über `<script data-meridian-script="renderer" src="./renderer.js"></script>` zwischen `core` und `content` geladen. Der frühere Inline-Block wurde vollständig bytegleich übernommen, bewusst ohne Bereinigung seiner Einrückung oder mehrzeiligen Shaderliterale; siehe [Renderer-Auslagerung](renderer-extraction.md).

`MERIDIAN_TEXTURES` in `renderer.js` enthält vier eingebettete Bild-Data-URLs (drei Bodentexturen und die Skybox). Die danebenliegenden `texture-floor-*.png` werden vom aktuellen Renderer nicht als Dateien geladen. Ihre Bearbeitung allein ändert die eingebetteten Texturen nicht; ein automatischer Abgleich existiert nicht.

`skybox.webp` bleibt die unveränderte Bildquelle. Ihre Bytes sind zusätzlich als `MERIDIAN_TEXTURES.sky` eingebettet; zur Laufzeit wird keine externe Skybox-Datei mehr angefordert. Der Terrain-Test prüft Bytegleichheit mit der Quelle, aber es gibt keinen automatischen Generierungsschritt. Bei einem absichtlichen Bildwechsel die Einbettung ebenfalls aktualisieren. Die dunkle Ersatztextur bleibt bis zum asynchronen Upload erhalten. Der frühere `file://`-SecurityError entfällt im Chromium-152-Nachtest; tatsächlicher Upload, GPU-Pixel und sichtbarer Himmel wurden geprüft. Andere Browser sind separat zu prüfen; Node-Tests allein decken das nicht ab. Details: [Skybox-Einbettung](skybox-embedding.md).

## Bekannte Kopplungen und Risiken

1. **RNG und Darstellung:** `Battlefield.generate()` verbraucht eine Zufallsfolge für Bodenfarben, Hindernisse und Dekoration. Ihre Aufrufreihenfolge ist layoutrelevant. Felsmeshes und Kristallmodelle besitzen bereits separate kosmetische Generatoren; Die Effektkomponente verwendet für Explosionen und Arbeitereffekte weiterhin den übergebenen Simulations-RNG. Erzeugung und Tick sind vom Zeichnen getrennt, aber eine andere Partikelanzahl kann weiterhin spätere Zufallsentscheidungen ändern. Ein separater kosmetischer RNG wäre eine bewusste spätere Verhaltensänderung.
2. **Laden ist keine exakte Fortsetzung des RNG:** Der Generatorzustand wird nicht serialisiert. Beim Start wird `seed + 77`, beim Restore `seed + floor(time * 50)` verwendet. Feste Zeitschritte und reproduzierbare Karten sind kein Nachweis für identischen Verlauf nach Save/Load.
3. **Breite Verantwortlichkeiten:** Welt-/GPU- und Effektgrenzen sind umgesetzt; Weltgenerierung erzeugt aus Kompatibilitätsgründen aber weiterhin auch kosmetische Layoutdaten. `MeridianUI` und Teile des Einstiegspunkts besitzen noch breite Verantwortlichkeiten.
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

Als erste echte Schnittstellengrenze wurde danach die [Speicherung entkoppelt](persistence-decoupling.md): 13 Charakterisierungstests zunächst gegen die bisherige UI, anschließend eine eigenständige Speicherkomponente mit vier zusätzlichen Schnittstellen-/Isolationstests. `app` verdrahtet sie ausdrücklich mit der UI. Bestehende Formatprüfungen wurden übernommen, nicht verschärft; nicht transaktionale Importabläufe bleiben bestehen.

Die Welt-/Renderer-Grenze ist inzwischen umgesetzt: CPU-Welt und Simulation laufen ohne Renderer, `world-view` übernimmt Meshes, Platzierungen, Fog und Entitätsmodelle. Die [Welt-/Effektreferenzen](world-effects-decoupling.md) sichern die ursprünglichen Ausgaben.

Auch die Effektgrenze ist umgesetzt: `effects` erzeugt und aktualisiert kosmetische Daten synchron, `effects-view` zeichnet sie ohne RNG oder Mutation. Gameplayrelevante Strikes, Felder, Scans, Cooldowns und Sichtentscheidungen bleiben in der Simulation. Die bisherigen `game.fx`-/`game.floats`-Lesezugriffe und `explosion`-/`tickEffects`-Methoden delegieren als Kompatibilitätszugang an die Komponente.

**Der vereinbarte Architekturblock ist abgeschlossen. Jetzt wieder Spielfunktionen entwickeln.** Weitere UI-Aufteilungen, Typisierung und neue Werkzeuge nur bei konkretem Featurebedarf; davor die betroffenen Referenztests ergänzen. Absichtliche RNG-, Save- oder Regeländerungen separat planen und prüfen. Kein vollständiger Rewrite oder neues UI-Framework erforderlich.

### Perspektive: TypeScript-Quellen, einfaches Auslieferungsartefakt

Die langfristige Grenze soll zwischen **Entwicklungsquellen** und **Spielartefakt** verlaufen: Module für `core`, `content`, `simulation`, `rendering`, `ui` und `persistence`, verbunden durch einen kleinen Einstiegspunkt. Die Simulation soll ohne DOM, WebGL und Storage ausführbar sein; Browserzugriffe liegen in den äußeren Bereichen.

TypeScript kann bereichsweise eingeführt werden, zunächst für Definitionen, Zustände, Befehle und Ereignisse. Ein kleiner Build, etwa mit esbuild, könnte die Module als klassisches Inline-Skript zusammen mit CSS in eine direkt öffnungsfähige HTML-Datei einsetzen. Typprüfung wäre separat über `tsc --noEmit` nötig.

Noch offen sind Toolwahl, Quellenlayout, Asset-Einbettung und Ablage des fertigen Artefakts. Verbindlich bleibt: Zum Spielen keine Paketinstallation, kein erforderlicher Server, keine CDN-Abhängigkeiten oder Laufzeit-Imports. Vor Einführung des Builds festlegen, welche Dateien generiert sind und wie das fertige HTML ohne Build verfügbar bleibt. Keine parallel von Hand gepflegte zweite Codekopie anlegen.
