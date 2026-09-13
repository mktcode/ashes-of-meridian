# Einstieg für KI-Agenten

## In wenigen Minuten orientieren

1. [README.md](README.md): Projektstand, Start, Core Loop und Dokumentationskarte.
2. Je nach Aufgabe: [Gameplay](docs/gameplay.md) für Regeln/Bedienung, [Architektur](docs/architecture.md) für Code/Schnittstellen, [Grafik](docs/rendering.md) für Rendering/Assets, [Tests](docs/testing.md) für Prüfverfahren. Vor strukturellen Änderungen immer Architektur lesen.
3. `git status --short` prüfen, dann betroffene Quellen und Tests lesen. [Worklog](docs/worklog.md) enthält nur den kompakten Übergabestand und letzte Nachweise, keine zusätzliche Spezifikation.

**Stand:** Der Core Loop aus Gefecht → Aether-Evakuierung → permanenten Upgrades → neuem Gefecht ist implementiert. Nächster Schwerpunkt ist Validierung auf echten Geräten und über vollständige Runs, nicht Featureausbau. [Nächste Schritte](docs/gameplay.md#nächste-schritte-und-grenzen) sind Prüfprioritäten, keine pauschale Implementierungsfreigabe. Breites Refactoring und weitere TypeScript-Migration bleiben bis zu einem neuen Auftrag pausiert.

## Quellen und Befehle

- `index.html`, `styles/` und `src/` sind handgepflegte Quellen. Ausnahme: `src/renderer/assets.js` wird mit `npm run embed:textures` bytegleich aus `assets/textures/` erzeugt und nicht direkt bearbeitet. Simulation in `src/simulation/`, UI in `src/ui/`, WebGL in `src/renderer/`; vollständige Codekarte in der Architektur.
- Einmalig `npm install`; `npm run build` erzeugt klassische Skripte unter `dist/src/`. `dist/` nie direkt bearbeiten oder einchecken; die eingecheckte Textur-Einbettung nur über das vorgesehene Skript aktualisieren.
- `npm test` baut neu und führt die Node-Regression aus. Testdateien unter `tests/`, gemeinsame VM-/Szenariohelfer unter `tests/helpers/`, feste Referenzen unter `tests/fixtures/`.
- Auslieferungsziel: gebaute `index.html` direkt über `file://` öffnen. Kein erforderlicher Server, CDN, Laufzeit-Import oder Paketinstallation im Browser; keine abschwächenden Sicherheitsflags.

## Leitplanken

- Kleinste sinnvolle Änderung; Formatierung, strukturelles Refactoring und Verhaltensänderungen getrennt halten. Keine beiläufigen Änderungen an Balancing, Darstellung oder Regeln; bekannte Probleme nicht stillschweigend korrigieren.
- Seedbasierte Hindernisverteilung, Kollisionsradien und RNG-Aufrufreihenfolge schützen. Auch kosmetische Effekte nutzen teilweise den Simulations-RNG. [Referenzwerte](docs/reference-tests.md) nicht zur Reparatur fehlgeschlagener Tests neu erzeugen.
- Entwicklungsprototyp: keine Rückwärtskompatibilität, Migrationen oder Legacy-Adapter ohne ausdrücklichen Auftrag. Nur das permanente Profil wird gespeichert, keine Runs.
- Bildassets werden ausschließlich als WebP mit Qualität 80 gepflegt; keine PNGs einchecken. Texturquellen und Einbettungen mit `npm run embed:textures` synchronisieren. Assets trotzdem nicht nur wegen vermeintlicher Redundanz löschen oder austauschen; Pflegeverfahren in der Grafikreferenz beachten.
- Zusammenhängende, geprüfte Änderungen eigenständig committen. Fremde oder unzusammenhängende vorhandene Änderungen nicht aufnehmen.

## Prüfen und dokumentieren

- Spielcode-/Teständerungen: grundsätzlich `npm test`. Nur mechanische, verhaltensneutrale JS-/TS-Kleinständerungen ohne Logik-/RNG-/Schnittstelleneingriff dürfen mit Build und Diff-Sichtung geprüft werden; im Zweifel vollständiger Lauf.
- Eingabe, Layoutstruktur, Rendering oder Auslieferung: zusätzlich gezielter `file://`-Browsercheck. Node ist kein WebGL-Nachweis, Headless-Touch kein Echtgerätetest.
- Reine Dokumentation oder minimale risikoarme Text-/Rahmen-/Abstandsänderungen: Diff und passende statische Prüfungen, keine Browsertests auf Vorrat. Details in [docs/testing.md](docs/testing.md).
- Referenzen direkt auf den Ist-Zustand bringen, nicht historische Nachträge anhängen. Nur [docs/worklog.md](docs/worklog.md) führt kurze Änderungseinträge mit tatsächlich ausgeführten Prüfungen und offenen Grenzen; ältere Einträge verdichten, Details bleiben in Git.
- Bei Dokumentationspflege Wiederholungen, veraltete Angaben und tote Links entfernen. AGENTS.md bleibt Wegweiser und Regelwerk, nicht Arbeitshistorie.

## Issues

- Issues werden lokal im Repository in `docs/issues` verwaltet.
- Kommentare und ergänzende Infos werden in den dortigen Dateien fortlaufend gepflegt.
- Ist ein Issue erledigt, wird die Datei gelöscht.
- Auswirkungen auf andere bestehende Issues müssen dort ergänzt werden.