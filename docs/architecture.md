# Architektur

## Status und Geltungsbereich

Bestandsaufnahme des formatierten Ausgangsstands `ab92a12` und Vorbereitung weiterer Refactorings. Dieses Dokument beschreibt zunächst den vorhandenen Code; das Zielbild am Ende ist noch nicht implementiert. Die Dokumentationsbereinigung verändert weder Spielcode noch Assets oder Tests.

`index.html` ist derzeit die maßgebliche, von Hand bearbeitete Quelle und zugleich die ausgelieferte Anwendung. Es gibt weder ein `src/`-Verzeichnis noch generierte Dateien oder einen Build-Prozess. Viele JavaScript-Methoden stehen trotz HTML-Formatierung noch auf einer Zeile.

## Codekarte

Nach CSS und statischem HTML folgen sieben klassische Inline-Skripte. Sie teilen sich globale lexikalische Bindungen und werden in Dokumentreihenfolge ausgeführt. Die folgende Nummerierung beschreibt diese Reihenfolge, keine unabhängigen Module. Zur Navigation die Symbolnamen in `index.html` suchen.

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

`MERIDIAN_TEXTURES` enthält drei eingebettete Bild-Data-URLs. Die danebenliegenden `texture-floor-*.png` werden vom aktuellen Renderer nicht als Dateien geladen. Ihre Bearbeitung allein ändert die eingebetteten Texturen nicht; ein automatischer Abgleich existiert nicht.

`skybox.webp` wird dagegen über eine relative URL mit `Image` geladen und als WebGL-Textur hochgeladen. Daher ist die Anwendung nicht vollständig auf eine Datei reduziert. Der Renderer legt zunächst eine dunkle Ersatztextur an. Ob Laden und GPU-Upload unter `file://` funktionieren, muss je Browser geprüft werden; Node-Tests decken das nicht ab.

## Bekannte Kopplungen und Risiken

1. **RNG und Darstellung:** `Battlefield.generate()` verbraucht eine Zufallsfolge für Bodenfarben, Hindernisse und Dekoration. Ihre Aufrufreihenfolge ist layoutrelevant. Felsmeshes und Kristallmodelle besitzen bereits separate kosmetische Generatoren; `MeridianGame.explosion()` und Arbeitereffekte verwenden dagegen `this.random` aus der Simulation. Eine andere Partikelanzahl kann spätere Zufallsentscheidungen ändern.
2. **Laden ist keine exakte Fortsetzung des RNG:** Der Generatorzustand wird nicht serialisiert. Beim Start wird `seed + 77`, beim Restore `seed + floor(time * 50)` verwendet. Feste Zeitschritte und reproduzierbare Karten sind kein Nachweis für identischen Verlauf nach Save/Load.
3. **Breite Verantwortlichkeiten:** `Battlefield`, `MeridianGame`, `MeridianUI` und der Einstiegspunkt mischen jeweils mehrere Aufgaben. Reines Verschieben in Dateien löst diese Kopplungen nicht.
4. **Implizite Schnittstellen:** Entitäten, Befehle und Ereignisse sind untypisierte Objekte; der Renderer verwendet eine lange positionale `add(...)`-Signatur. Globale Bindungen und Ausführungsreihenfolge ersetzen explizite Imports.
5. **Strukturabhängige Tests:** Beide Testdateien extrahieren Inline-Skripte per regulärem Ausdruck und führen die ersten drei aus. Ein Test verlangt genau sieben Skripte. Vor einer Aufteilung muss dieser Testzugriff bewusst angepasst werden, ohne Verhaltensprüfungen zu verlieren.

Diese Punkte sind Befunde, keine bereits vorgenommenen Fehlerkorrekturen. Insbesondere RNG- und Save-Änderungen müssen getrennt von strukturellen Refactorings geplant werden.

## Nächste Schritte und späteres Zielbild

### Zunächst: Referenzverhalten absichern

1. Gemeinsamen Testloader und Renderer-Teststub einführen. Skriptblöcke explizit identifizierbar machen, statt die ersten drei blind auszuwählen; alle Inline-Skripte weiterhin auf Syntax prüfen.
2. Missionsstart mit festem Seed, Ressourcen/Produktionsqueue, Befehle und Wiederherstellung eines im Ausgangsstand erfassten Spielstand-Fixtures testen. Erwartungswerte nicht bei jedem Testlauf aus der aktuellen Implementierung neu erzeugen.
3. Die vorhandenen Layout-Prüfsummen unverändert beibehalten. Nur tatsächlich zugesicherte Save/Load-Eigenschaften prüfen, nicht vollständige Deterministik unterstellen.
4. Den direkten Browserstart anhand der [Checkliste](testing.md#manuelle-browser-prüfung) prüfen, bevor eine neue Verpackung eingeführt wird.

### Anschließend: schrittweise entkoppeln

Als erste kleine Bereiche eignen sich Mathematik, Inhaltsdefinitionen und Speicherformat-Validierung. Danach Weltberechnung von Renderdaten, Simulation von kosmetischen Effekten sowie UI-Ansichten von Eingabe und Persistenz trennen. Bestehende Verhaltensabhängigkeiten dabei zunächst erhalten; absichtliche Korrekturen separat prüfen. Kein vollständiger Rewrite und kein neues UI-Framework sind dafür nötig.

### Perspektive: TypeScript-Quellen, einfaches Auslieferungsartefakt

Die langfristige Grenze soll zwischen **Entwicklungsquellen** und **Spielartefakt** verlaufen: Module für `core`, `content`, `simulation`, `rendering`, `ui` und `persistence`, verbunden durch einen kleinen Einstiegspunkt. Die Simulation soll ohne DOM, WebGL und Storage ausführbar sein; Browserzugriffe liegen in den äußeren Bereichen.

TypeScript kann bereichsweise eingeführt werden, zunächst für Definitionen, Zustände, Befehle und Ereignisse. Ein kleiner Build, etwa mit esbuild, könnte die Module als klassisches Inline-Skript zusammen mit CSS in eine direkt öffnungsfähige HTML-Datei einsetzen. Typprüfung wäre separat über `tsc --noEmit` nötig.

Noch offen sind Toolwahl, Quellenlayout, Asset-Einbettung und Ablage des fertigen Artefakts. Verbindlich bleibt: Zum Spielen keine Paketinstallation, kein erforderlicher Server, keine CDN-Abhängigkeiten oder Laufzeit-Imports. Vor Einführung des Builds festlegen, welche Dateien generiert sind und wie das fertige HTML ohne Build verfügbar bleibt. Keine parallel von Hand gepflegte zweite Codekopie anlegen.
