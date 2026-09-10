# Architektur

## Status und Geltungsbereich

Bestandsaufnahme des formatierten Ausgangsstands `ab92a12`, ergänzt um den gemeinsamen Testzugriff, die Referenztests und die CSS-Auslagerung. Dieses Dokument beschreibt zunächst den vorhandenen Code; das Zielbild am Ende ist noch nicht implementiert. Die sieben Skript-Tags wurden benannt und der zentrale CSS-Block unverändert ausgelagert. Skriptinhalte und Assets blieben unverändert.

`index.html` (HTML und JavaScript) und `styles.css` (zentrales Stylesheet) sind die maßgeblichen, von Hand bearbeiteten Quellen und zugleich ausgelieferte Dateien. Es gibt weder ein `src/`-Verzeichnis noch generierte Dateien oder einen Build-Prozess. Inline-Styles im HTML beziehungsweise in JS-Templates bleiben vorerst bestehen. Viele JavaScript-Methoden stehen trotz HTML-Formatierung noch auf einer Zeile.

## Codekarte

Im `<head>` bindet `<link rel="stylesheet" href="./styles.css">` das lokale Stylesheet ein. Nach dem statischen HTML folgen sieben klassische Inline-Skripte. Sie teilen sich globale lexikalische Bindungen und werden in Dokumentreihenfolge ausgeführt. Die folgende Nummerierung beschreibt diese Reihenfolge, keine unabhängigen Module. Zur Navigation die Symbolnamen in `index.html` suchen. Die Tags tragen `data-meridian-script` mit den Namen `renderer`, `content`, `world`, `simulation`, `audio`, `ui` und `app`; das Attribut dient nur der Identifikation durch Tests.

| Block | Einstieg / wichtige Symbole | Zuständigkeiten heute |
| --- | --- | --- |
| 1 | `M4`, `V`, `seeded`, `MAT`, `geom`, `MeridianRenderer` | Mathematik, RNG, eingebettete Texturen, Meshes, GLSL-Shader, WebGL-Ressourcen, Kamera und Renderpässe |
| 2 | `FACTIONS`, `UNITS`, `BUILDINGS`, `TECH`, `META`, `BIOMES`, `CAMPAIGN` | Spieldefinitionen, Balancing, Kampagne, Texte, Icons und Namenshelfer |
| 3 | `Heap`, `Battlefield`, `renderEntity` | Kartenkonstanten, Terrain, Hindernisraster, Navigation, Sichtbarkeit und prozedurale Entitätsmodelle |
| 4 | `DIFFICULTY`, `MeridianGame` | Missionsaufbau, Entitäten, Befehle, Wirtschaft, Kampf, KI, Ziele, Effektdaten und Snapshot/Restore |
| 5 | `MeridianAudio` | Prozedurales Web Audio für Musik und Geräusche |
| 6 | `Store`, `defaultProfile`, `readProfile`, `MeridianUI` | Speicherung, Fortschritt, Menüs, HUD, Eingabe, Kamera-Steuerung, Import/Export und Canvas-Overlay |
| 7 | abschließende IIFE, `window.Meridian` | Verdrahtung, Spielschleife, Menüvorschau, Szenendarstellung, Effekte und Fehlerbehandlung |

Wichtige Abhängigkeiten:

- `Battlefield` verwendet Definitionen aus Block 2, Mathematik/Geometrie aus Block 1 und eine Renderer-Instanz. Es berechnet nicht nur die Welt, sondern erzeugt auch statische Renderdaten und lädt Nebeldaten auf die GPU.
- `MeridianGame` hält Renderer, Profil und `Battlefield`. Der `emit(type, data)`-Callback wird im Einstiegspunkt an `MeridianUI.event()` angeschlossen.
- `MeridianUI` greift direkt auf `game.s`, Renderer, Audio, DOM und Speicherung zu. Der Ereignis-Callback ist deshalb noch keine vollständige Entkopplung.
- Block 7 erstellt alle Instanzen. Die `requestAnimationFrame`-Schleife führt bei aktivem, ungepaustem Spiel `game.step(0.05)` und `tickEffects(0.05)` aus; UI und Rendering werden pro Frame aktualisiert.
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

`styles.css` liegt neben `index.html` und muss mit ausgeliefert werden. Es enthält derzeit keine `url(...)`- oder `@import`-Verweise. Künftig beziehen sich relative Asset-URLs im Stylesheet auf dessen Speicherort. Die [CSS-Auslagerungsprüfung](css-extraction.md) bestätigt das Laden über `file://` in Chromium ohne Server oder besondere Sicherheitsflags.

`MERIDIAN_TEXTURES` enthält drei eingebettete Bild-Data-URLs. Die danebenliegenden `texture-floor-*.png` werden vom aktuellen Renderer nicht als Dateien geladen. Ihre Bearbeitung allein ändert die eingebetteten Texturen nicht; ein automatischer Abgleich existiert nicht.

`skybox.webp` wird dagegen über eine relative URL mit `Image` geladen und als WebGL-Textur hochgeladen. Daher ist die Anwendung nicht vollständig auf eine Datei reduziert. Der Renderer legt zunächst eine dunkle Ersatztextur an. Beim Chromium-152-Test über `file://` wurde der GPU-Upload vor und nach der CSS-Auslagerung mit einem `SecurityError` blockiert; die dunkle Ersatztextur blieb bestehen. Das ist eine bestehende, nicht durch das CSS verursachte Einschränkung. Andere Browser sind separat zu prüfen; Node-Tests decken das nicht ab.

## Bekannte Kopplungen und Risiken

1. **RNG und Darstellung:** `Battlefield.generate()` verbraucht eine Zufallsfolge für Bodenfarben, Hindernisse und Dekoration. Ihre Aufrufreihenfolge ist layoutrelevant. Felsmeshes und Kristallmodelle besitzen bereits separate kosmetische Generatoren; `MeridianGame.explosion()` und Arbeitereffekte verwenden dagegen `this.random` aus der Simulation. Eine andere Partikelanzahl kann spätere Zufallsentscheidungen ändern.
2. **Laden ist keine exakte Fortsetzung des RNG:** Der Generatorzustand wird nicht serialisiert. Beim Start wird `seed + 77`, beim Restore `seed + floor(time * 50)` verwendet. Feste Zeitschritte und reproduzierbare Karten sind kein Nachweis für identischen Verlauf nach Save/Load.
3. **Breite Verantwortlichkeiten:** `Battlefield`, `MeridianGame`, `MeridianUI` und der Einstiegspunkt mischen jeweils mehrere Aufgaben. Reines Verschieben in Dateien löst diese Kopplungen nicht.
4. **Implizite Schnittstellen:** Entitäten, Befehle und Ereignisse sind untypisierte Objekte; der Renderer verwendet eine lange positionale `add(...)`-Signatur. Globale Bindungen und Ausführungsreihenfolge ersetzen explizite Imports.
5. **Strukturabhängige Tests:** Der gemeinsame Loader unter `tests/helpers/inline-scripts.cjs` extrahiert weiterhin Inline-Skripte per regulärem Ausdruck, nun mit eindeutigen Namen statt festen Positionen oder fester Anzahl. Aufrufer nennen ihre Abhängigkeiten explizit; Ausführung bleibt in Dokumentreihenfolge. Bei einer späteren Modulaufteilung nur diesen Testzugriff anpassen, nicht die Verhaltensprüfungen abschwächen.

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

Als erste kleine JavaScript-Bereiche eignen sich Mathematik, Inhaltsdefinitionen und Speicherformat-Validierung. Danach Weltberechnung von Renderdaten, Simulation von kosmetischen Effekten sowie UI-Ansichten von Eingabe und Persistenz trennen. Bestehende Verhaltensabhängigkeiten dabei zunächst erhalten; absichtliche Korrekturen separat prüfen. Kein vollständiger Rewrite und kein neues UI-Framework sind dafür nötig.

### Perspektive: TypeScript-Quellen, einfaches Auslieferungsartefakt

Die langfristige Grenze soll zwischen **Entwicklungsquellen** und **Spielartefakt** verlaufen: Module für `core`, `content`, `simulation`, `rendering`, `ui` und `persistence`, verbunden durch einen kleinen Einstiegspunkt. Die Simulation soll ohne DOM, WebGL und Storage ausführbar sein; Browserzugriffe liegen in den äußeren Bereichen.

TypeScript kann bereichsweise eingeführt werden, zunächst für Definitionen, Zustände, Befehle und Ereignisse. Ein kleiner Build, etwa mit esbuild, könnte die Module als klassisches Inline-Skript zusammen mit CSS in eine direkt öffnungsfähige HTML-Datei einsetzen. Typprüfung wäre separat über `tsc --noEmit` nötig.

Noch offen sind Toolwahl, Quellenlayout, Asset-Einbettung und Ablage des fertigen Artefakts. Verbindlich bleibt: Zum Spielen keine Paketinstallation, kein erforderlicher Server, keine CDN-Abhängigkeiten oder Laufzeit-Imports. Vor Einführung des Builds festlegen, welche Dateien generiert sind und wie das fertige HTML ohne Build verfügbar bleibt. Keine parallel von Hand gepflegte zweite Codekopie anlegen.
