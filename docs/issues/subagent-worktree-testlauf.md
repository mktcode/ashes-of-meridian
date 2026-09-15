# Testlauf: parallele Repo-Pflege in Worktrees

## Ziel und Grenze

Den [dokumentierten Subagent-Arbeitsablauf](../subagents.md) mit einem kleinen realen Durchlauf prüfen: isolierte Arbeit, asynchrone Rückfrage/Antwort, Übergabe, Integration und sichere Bereinigung. Die erste lesende Modell-/Worktree-Welle ist erfolgreich abgeschlossen. Schreibende Übergabe, Integration und abschließende Bereinigung sind noch nicht erprobt; aus dem Audit folgt keine automatische Implementierungsfreigabe.

Das [Audit-Team](../subagents.md#projektteam-für-lesende-audits) hat nach Nutzerfreigabe ausschließlich lesend analysiert. Konsolidierte Pflegekandidaten und notwendige Entscheidungen stehen im [Befund-Issue](audit-welle-01-befunde.md). Keine Befehle, Builds, Tests, Benchmarks, Browserläufe oder Dateiänderungen durch die Audit-Subagents. Tests dürfen als Quellen gelesen werden; ungemessene Performancewirkungen bleiben Hypothesen. Jede Umsetzung wird erst nach konsolidierten Befunden konkret mit dem Nutzer vereinbart, nicht automatisch aus dem Backlog abgeleitet. Größeres Refactoring und Regel-/Balancingänderungen bleiben außerhalb des Testumfangs.

## Freigegebene Audit-Welle 01

Startfreigabe des Nutzers liegt vor. Hauptagent: Einrichtung, Git-Nachweise, Supervisor-Antworten, Quellenprüfung und Konsolidierung; keine Implementierung in dieser Welle. Alle drei Worktrees wurden sauber auf `2d991a42fde3e5a61467838619840cb3cfdce75a` angelegt; Pfad, Branch und Status sowie identische Regeln/Konfiguration sind vor dem Start geprüft. Native asynchrone Workflow-ID: `124f5ceb-4f72-4b41-bb12-89eb3b439f6f`, Mission: `7a56d50e-41e1-4c9c-bf34-90c829fd6478`. Kindläufe: `docs` → `03c045ea-92da-4010-8774-525b5fb27b00`, `code` → `90745de1-61aa-4b53-8645-03500ba21cf8`, `perf` → `86c2f091-9554-4f78-8d74-acfdad96322f`. Aufrufscript: Hauptcheckout `.tmp/audit-wave-01/workflow.js`; syntaktisch validiert, dynamische Startzahl durch Laufzeitlimit 3 begrenzt. Status: Workflow und alle Kinder erfolgreich abgeschlossen, Prozessende für jedes Kind als `observed` bestätigt. Tatsächliches Sol/medium für `docs` und Sol/high für `code`/`perf` bestätigt. Alle drei fachlichen Supervisor-Fragen wurden beantwortet und in den Abschlussberichten berücksichtigt. Finale Git-Prüfung: unveränderte HEADs, keine getrackten Änderungen oder ungetrackten Quelldateien. Die Tool-Ereignisse enthalten ausschließlich Lesen/Suchen und `contact_supervisor`, keine Schreib-, Shell- oder Testwerkzeuge. Ignoriert vorhanden sind Runtimeberichte unter `.tmp/` sowie Pi-Paketdownloads unter `.pi/git/`.

| Auftrag / Branch | Absoluter Worktree | Lesender Schwerpunkt |
| --- | --- | --- |
| `aom/audit-01-docs` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-docs` | README und `docs/` einschließlich Issues gegen Quellen und gelesene Tests abgleichen; Aktualität und maßgebliche Informationsorte |
| `aom/audit-01-code` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-code` | `src/`, Lade-/Typverträge und Testharness auf notwendigen Wartungsbedarf und nachweislich obsolete Übergangslösungen prüfen |
| `aom/audit-01-perf` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-perf` | Simulations-/KI-/Navigations- und Render-/UI-Aufrufpfade statisch auf wiederholte Arbeit, Allokationen und Skalierungsrisiken untersuchen |

Lesezugriff auf den gesamten eigenen Quellstand für Gegenbelege erlaubt; keine Schreibrechte, kein gegenseitiges Lesen vor der unabhängigen Übergabe. Gemeinsame RNG-, Sicht-, Kollisions- und Ladeverträge bleiben unverändert. Die Fragen sind unabhängig: Dokumentationswahrheit, Änderungsrisiko, ungemessene Laufzeitwirkung; Querverweise bei Überschneidungen statt mehrfacher Kernbewertung. Generierte Assets, Abhängigkeiten und Git-Interna nicht flächig durchsuchen.

Abnahme dieser Phase: priorisierte, belegte Befunde mit Pfad/Zeile, Abdeckung und Grenzen, kleinste Maßnahmen, Risiken und spätere Prüfempfehlungen; kein Mindestmaß an Problemen. Mindestens eine fachliche Supervisor-Rückfrage samt beantworteter Fortsetzung beobachten. Modell-/Thinking-Zuordnung und unveränderte Quellstände durch den Hauptagenten kontrollieren. Ergebnisberichte werden aus den normalen Antworten durch die Runtime in den jeweiligen `.tmp/audit-wave-01/`-Bereich geschrieben; die Audit-Subagents selbst schreiben keine Dateien. Dauerhafte Befunde übernimmt nur der Hauptagent in Issues.

Die vollständigen Berichte liegen jeweils im oben genannten Worktree unter `.tmp/audit-wave-01/report.md`; maßgebliche dauerhafte Befunde wurden in das [Befund-Issue](audit-welle-01-befunde.md) übernommen. Terminaler Workflow-Beleg: `/tmp/pi-subagents-uid-1000/async-subagent-runs/124f5ceb-4f72-4b41-bb12-89eb3b439f6f/workflow-receipt.json` (Pi-eigene, aufbewahrungsbegrenzte Runtimeablage). Es lief keine Spielprüfung; ein grüner Modelllauf ist keine Build-/Test-/Darstellungsabnahme.

**Aufbewahrung:** Die drei sauberen Worktrees und Branches bleiben bis zur Entscheidung über Rückfragen bzw. den nächsten freigegebenen Umfang erhalten; kein Prozess arbeitet mehr darin. Danach übernimmt der Hauptagent die kontrollierte Bereinigung. Keine leeren Commits oder Scheinmerges für die lesenden Aufträge. Das Testlauf-Issue bleibt wegen der unerprobten schreibenden Integration und offenen Bereinigung bestehen.

## Anzeigegrenze

Die Standardagenten bleiben über `disableBuiltins` abgeschaltet; `action: "list", capabilities: true` zeigt ausschließlich die drei eigenen Audit-Profile als ausführbar. `/subagents-models` zeigt sie in der gepinnten Extension-Version trotzdem mit `disabled` an (auch Aliase). Vollständiges Ausblenden aus dieser Diagnoseansicht ist damit noch nicht erreicht und benötigt eine gesonderte Extension-Anpassung, keine direkte Änderung am ignorierten Paketdownload.

## Vorgehen

- Die effektiven Definitionen von `aom-doc-auditor` (Sol/medium), `aom-code-auditor` und `aom-perf-auditor` (je Sol/high) wurden mit `action: "get"` geprüft: eigene Projektprofile, frischer Kontext, `inheritProjectContext: true`, nur Lese-/Suchwerkzeuge und `contact_supervisor`, keine ambient geladenen Extensions. Diese Prüfung beweist noch keinen erfolgreichen Modell-/Toolstart. Vor dem Lauf erneut auf Overrides prüfen; keine Standardagenten reaktivieren.
- Drei parallele Analyseaufträge auf demselben Ausgangscommit, jeweils im eigenen Worktree: Dokumentationsrichtigkeit und Issue-Aktualität; Wartbarkeit/Codequalität und belegte Altlasten; statische Performance-/Skalierungsrisiken. Lesebereiche dürfen sich überschneiden, die Fragestellungen und Kernbefunde nicht. Keine Dateischreibrechte, kein künstlicher Änderungsbedarf.
- Der Hauptagent bereitet die Worktrees vor und übergibt den vor Start geprüften absoluten Pfad, Branch, Ausgangscommit und sauberen Git-Status. Audit-Subagents gleichen den Nachweis mit ihrem Kontext ab; sie führen Git nicht selbst aus und legen keine Scratch-Dateien an. Mindestens eine echte, begrenzte Supervisor-Rückfrage zur Abgrenzung oder einem Befund in der ursprünglichen Hauptsession beantworten.
- Der Hauptagent konsolidiert und verifiziert die Quellenbefunde. Höchstens zwei kleine, unabhängige Änderungen als möglichen Testumfang mit dem Nutzer vereinbaren. Erst danach gegebenenfalls ein gesondertes Schreibprofil vorbereiten und exakte Schreibgrenzen zuweisen.
- Freigegebene schreibende Agenten prüfen gezielt und committen getrennt. Der Hauptagent reviewed und integriert nacheinander; ausschließlich er führt die Standardtestsuite einmal ganz am Schluss nach Integration aller freigegebenen Änderungen aus. Zusätzliche KI-/Simulationsläufe benötigen die [ausdrückliche Nutzerfreigabe](../../AGENTS.md#risikobasiert-prüfen). Issues bleiben ausschließlich in seiner Zuständigkeit.

## Abnahme

- Keine Änderungen im fremden Worktree; eigene `.tmp/`-Pfade auch für Logs/Hilfsprogramme, nichts Temporäres im Commit. Eigenständige Build-/Abhängigkeitsverzeichnisse, soweit benötigt.
- Die [Modellzuordnung](../subagents.md#modelle-und-thinking) anhand der tatsächlich gestarteten Audit-Rollen prüfen: Sol/medium für Dokumentation, Sol/high für die beiden anspruchsvollen Codeanalysen. Nicht unbemerkt vom Hauptagenten übernehmen; weder Terra noch Astra allein zum Testen aufrufen.
- Asynchrone Zustellung einer Rückfrage, passende Antwort und Abschluss tatsächlich beobachtet; Verhalten bei Blockaden nicht aus einem Doctor-Report ableiten.
- Audit-Übergaben enthalten Ausgangsstand, Abdeckung, belegte und priorisierte Befunde, Unsicherheiten, kleinste Maßnahmen und vorgeschlagene spätere Prüfungen; ausdrücklich keine ausgeführten Tests oder Änderungen. Spätere Schreibübergaben enthalten Commit, Dateiumfang, tatsächlich ausgeführte gezielte Prüfungen und offene Grenzen. Integration übernimmt ausschließlich geprüfte Änderungen; die abschließende Prüfung im freigegebenen Umfang läuft beim Hauptagenten.
- Erst nach beendeten Prozessen, gesicherter Integration und Übernahme dauerhafter Befunde aufräumen. Übrig gebliebene Runs, Branches oder Worktrees mit konkretem Zustand und nächster Aktion hier vermerken, nicht stillschweigend löschen.

Bei Start-/Toolfehlern den tatsächlichen Befund knapp hier ergänzen und den Lauf anhalten; kein stiller Wechsel auf eine andere CLI oder gemeinsame Arbeitsverzeichnisse. Nach erfolgreichem Testlauf und geklärten Restpunkten dieses Issue löschen.
