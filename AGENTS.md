# Arbeitsregeln für KI-Agenten

## Worktree-Pflicht – auch für den Hauptagenten

- **Ohne ausdrückliche abweichende Nutzeranweisung für den aktuellen Auftrag findet sämtliche Arbeit in einem eigenen Aufgaben-Worktree auf einem eigenen Branch statt, niemals im `main`-Worktree oder auf Branch `main`.** Das umfasst auch Dokumentation, Arbeitsregeln, Diagnosen, Kleinständerungen und Folgeaufträge nach einer Integration.
- Fehlt ein geeigneter eigener Aufgaben-Worktree, vor Beginn selbst einen separaten Worktree mit eigenem Branch vom aktuellen lokalen `main` anlegen. Dafür ist keine zusätzliche Nutzerfreigabe nötig. Fremde oder noch anderweitig verwendete Worktrees nicht übernehmen.
- Vor Arbeit absoluten Worktree-Pfad, Branch und `git status --short` prüfen. Ein aktueller Arbeitsordner in `main`, ein ausgecheckter Branch `main`, eine frühere Integration oder ein allgemeiner Arbeitsauftrag sind **keine** Ausnahme von dieser Pflicht.
- `main` ist ausschließlich Ziel ausdrücklich beauftragter Integrationen samt Abschlussprüfungen. Direkte Quellen-/Dokumentationsbearbeitung dort nur auf ausdrückliche Nutzeranweisung für den aktuellen Auftrag.
- Geprüfte eigene Änderungen im Aufgaben-Worktree committen; **nicht automatisch nach `main` integrieren**. „Implementieren“, „kümmere dich darum“ oder „abschließen“ ist keine Integrationsfreigabe.
- Bei ausdrücklichem Integrationsauftrag zuerst im Aufgaben-Worktree auf dessen Aufgabenbranch den aktuellen lokalen `main` mit `git merge main` integrieren, Konflikte dort lösen und gezielt prüfen. Danach im bestehenden `main`-Worktree auf Branch `main` integrieren und relevante Abschlussprüfungen ausführen. Ändert sich `main` inzwischen, Vorbereitung wiederholen. Vor dem Zielmerge Pfad, Branch und Status erneut prüfen; bei blockierenden fremden Änderungen stoppen und rückfragen, nichts überschreiben oder eigenmächtig stashen. Den Aufgaben-Worktree nicht auf `main` umschalten. Kein automatischer Push und keine automatische Branch-/Worktree-Löschung.

## Einstieg

1. [README](README.md) lesen, `git status --short` prüfen.
2. Betroffenes [Issue](docs/issues/), Quellen und Tests mit `rg`/`find` erkunden.
3. Fachreferenzen nur nach Bedarf; vor strukturellen Änderungen [Architektur](docs/architecture.md) lesen.

## Änderungen

- Kleinster sinnvoller Umfang. Formatierung, Struktur und Verhalten getrennt halten; kein beiläufiges Balancing, Darstellungs-/Regelkorrekturen oder Abarbeiten des Backlogs. Issues sind keine Implementierungsfreigabe.
- Hindernisverteilung, Körperradien und RNG-Reihenfolge schützen; kosmetische Effekte nutzen teilweise Simulations-RNG. [Referenzen](docs/reference-tests.md) nicht zum Grünmachen regenerieren.
- Prototyp: keine Migrationen, Rückwärtskompatibilität oder Legacy-Adapter ohne Auftrag.
- Quellen statt `dist/` bearbeiten; Modelle gemäß [Pflegevertrag](docs/rendering.md#einzeln-wartbare-modelle). Rasterassets ausschließlich WebP/Qualität 80; keine unbeauftragte Löschung/Ersetzung.
- Direkte `file://`-Auslieferung ohne erforderlichen Server, CDN, Laufzeit-Imports oder gelockerte Browser-Sicherheit erhalten.
- Zusammenhängende geprüfte Änderungen eigenständig committen; fremde Änderungen nicht aufnehmen. Kein eigenständiger Push/Deployment.

## Prüfungen und Zeitbudget

- Kurze gezielte Rückkopplung zuerst: lokale Logik mit Build/betroffenen Fällen, mechanische Kleinständerung mit Build/Diff, Dokumentation nur mit Diff/Links/Angaben. [Auswahl und Befehle](docs/testing.md).
- Mehrminütige oder zeitlich unbekannte breite Läufe benötigen aktuelle ausdrückliche Freigabe samt konkretem Erkenntnisziel. Gemeinsame Verträge begründen Prüfbedarf, keine automatische Vollsuite. Breite Integrationstests nur einmal am integrierten Stand durch den Hauptagenten; Wiederholung nur bei neuem relevantem Risiko.
- `test:ai`/`test:simulation` immer nur durch den Hauptagenten auf ausdrücklichen aktuellen Nutzerauftrag, auch direkte/gefilterte Fälle. Implementierung oder Abschlussprüfung ist keine Freigabe. Bedarf vorschlagen, sonst als nicht ausgeführt nennen.
- Browserchecks nur für konkrete technische Fragen, keine Screenshotserien auf Vorrat. Visuelle/akustische und Echtgeräteabnahme bleibt menschlich. Prüfungen und relevante offene Grenzen im Abschluss benennen.

## Spiel-Performance

Mentales Modell: *Was würde John Carmack tun?*

Performance-Analyse und -Optimierung ist ein kreativer Prozess, der über einfache Code-Verbesserungen hinausgeht. Fokus auf:

- Reduzierung von Suchräumen und globalen Invalidierungen
- Minimierung von Arbeit, deren Ergebnis sich seit dem letzten Frame kaum verändert hat
- Optimierung von Geländeabfragen, Kollisionsprüfungen und wiederholtem Aufbau von Modelldaten
- Nutzung von Profiling-Tools und Performance-Messungen, um Engpässe zu identifizieren
- Kreative Ansätze zur Verbesserung der Framerate und Reduzierung von Latenz, z.B. durch Caching, Level-of-Detail-Techniken oder asynchrone Verarbeitung

## Delegation

- Innerhalb freigegebener Arbeit erlaubt; Hauptagent orchestriert, beantwortet Rückfragen, pflegt Issues und integriert. Höchstens drei Kinder gleichzeitig, keine Weiterdelegation.
- Jedes Kind erhält eigenen vom Hauptagenten angelegten Worktree/Branch, auch bei Analyse. Vor Start absoluten Pfad, Branch, Ausgangscommit und Status prüfen; Abweichung → stoppen/rückfragen. Audit ohne Shell erhält den Git-Nachweis vom Hauptagenten.
- Lokale AGENTS-Version gilt; Kontextvererbung sicherstellen (`inheritProjectContext: true`). Regeln während einer Welle nicht nebenbei ändern. Luna/low für klare kleine Aufgaben, Sol/medium oder high für Abwägung/Reviews; Ausnahmen begründen und effektive Zuordnung prüfen.
- Auftrag enthält Ziel/Nicht-Ziele, Schreibgrenzen/Verträge, Abhängigkeiten, Prüfungen und Übergabe. Fachliche Überschneidungen vorab klären; Umfangserweiterung an Hauptagenten melden.
- Erste Audit-Phase ausschließlich lesend: keine Änderungen/Scratch-Dateien, Befehle, Builds, Tests, Benchmarks oder Browserläufe durch Audit-Kinder. Ausführungsbedarf nur vorschlagen.
- Kinder committen nur geprüfte eigene Änderungen. Keine fremden Worktrees, Merges/Rebases/Pushes, gemeinsame Git-Konfiguration oder Worktree-/Branch-Löschungen; `docs/issues/` und Arbeitsregeln nur durch Hauptagenten ändern.
- Fragen/Zwischenmeldungen über nativen Supervisor, Abschluss mit Branch/Commit, Dateien, Prüfungen/Resultat, Risiken/Entscheidungen. Fehlerzustand erhalten, nicht still den Ausführungsmodus wechseln. Integration und Bereinigung ausschließlich durch Hauptagenten nach gesicherter Übergabe/beendeten Prozessen. [Verfahren](docs/subagents.md).

## Temporäre Arbeit

Selbst angelegte Skripte, Downloads, Profile, Bilder und Logs nur unter `<eigener-Worktree>/.tmp/<lauf>/`; nie gemeinsam benannte `/tmp/`-Pfade. Bei Hilfsprogrammen `TMPDIR`, `TMP`, `TEMP` und Ausgabewege explizit dorthin setzen, in jedem Toolaufruf erneut. Keine schreibend geteilten `.tmp/`, `dist/`, `node_modules/` oder Symlinks zwischen Worktrees. Nur eigene Dateien nach Prozessende bereinigen; [Runtime-Grenzen](docs/subagents.md#temporäre-isolation).

## Dokumentation und Issues

Dauerhafte Entscheidungen, Grenzen und Pflegeverfahren dokumentieren, keine Codekarte, Wertetabellen oder Test-/Änderungshistorie. Ein maßgeblicher Ort je Information; andere Stellen verlinken. README ist Einstieg, AGENTS Regelwerk, offene Arbeit ausschließlich in `docs/issues/`, abgeschlossene Historie in Git; kein zusätzliches Worklog.

Nur betroffene Dokumentation pflegen; bei Wartungsaufträgen Redundanzen/Altlasten entfernen. Befunde knapp mit relevantem Prüfkontext ins Issue, Auswirkungen auf andere Issues dort ergänzen. Erledigte Issue-Dateien löschen.
