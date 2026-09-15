# Testlauf: parallele Repo-Pflege in Worktrees

## Ziel und Grenze

Den [dokumentierten Subagent-Arbeitsablauf](../subagents.md) mit einem kleinen realen Durchlauf prüfen: isolierte Arbeit, asynchrone Rückfrage/Antwort, Übergabe, Integration und sichere Bereinigung. Einrichtung und Regeln sind vorbereitet; ein echter paralleler Modell-/Worktree-Lauf steht noch aus. Der bisherige Extension-Lade-/Doctor-Check ersetzt diesen Nachweis nicht.

Das [Audit-Team](../subagents.md#projektteam-für-lesende-audits) ist eingerichtet; seine Konfiguration startet noch keinen Testlauf. Nach Startfreigabe zunächst das Repo ausschließlich lesend analysieren und begründete Pflegekandidaten vorschlagen. Keine Befehle, Builds, Tests, Benchmarks, Browserläufe oder Dateiänderungen durch die Audit-Subagents. Tests dürfen als Quellen gelesen werden; ungemessene Performancewirkungen bleiben Hypothesen. Jede Umsetzung wird erst nach konsolidierten Befunden konkret mit dem Nutzer vereinbart, nicht automatisch aus dem Backlog abgeleitet. Größeres Refactoring und Regel-/Balancingänderungen bleiben außerhalb des Testumfangs.

## Freigegebene Audit-Welle 01

Startfreigabe des Nutzers liegt vor. Hauptagent: Einrichtung, Git-Nachweise, Supervisor-Antworten, Quellenprüfung und Konsolidierung; keine Implementierung in dieser Welle. Alle drei Worktrees starten auf demselben Commit dieses Auftragsstands. Die konkrete SHA und Run-Identitäten werden nach Einrichtung ergänzt.

| Auftrag / Branch | Absoluter Worktree | Lesender Schwerpunkt |
| --- | --- | --- |
| `aom/audit-01-docs` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-docs` | README und `docs/` einschließlich Issues gegen Quellen und gelesene Tests abgleichen; Aktualität und maßgebliche Informationsorte |
| `aom/audit-01-code` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-code` | `src/`, Lade-/Typverträge und Testharness auf notwendigen Wartungsbedarf und nachweislich obsolete Übergangslösungen prüfen |
| `aom/audit-01-perf` | `/home/mkt/Projekte/experimental2/aom-audit-worktrees/wave-01-perf` | Simulations-/KI-/Navigations- und Render-/UI-Aufrufpfade statisch auf wiederholte Arbeit, Allokationen und Skalierungsrisiken untersuchen |

Lesezugriff auf den gesamten eigenen Quellstand für Gegenbelege erlaubt; keine Schreibrechte, kein gegenseitiges Lesen vor der unabhängigen Übergabe. Gemeinsame RNG-, Sicht-, Kollisions- und Ladeverträge bleiben unverändert. Die Fragen sind unabhängig: Dokumentationswahrheit, Änderungsrisiko, ungemessene Laufzeitwirkung; Querverweise bei Überschneidungen statt mehrfacher Kernbewertung. Generierte Assets, Abhängigkeiten und Git-Interna nicht flächig durchsuchen.

Abnahme dieser Phase: priorisierte, belegte Befunde mit Pfad/Zeile, Abdeckung und Grenzen, kleinste Maßnahmen, Risiken und spätere Prüfempfehlungen; kein Mindestmaß an Problemen. Mindestens eine fachliche Supervisor-Rückfrage samt beantworteter Fortsetzung beobachten. Modell-/Thinking-Zuordnung und unveränderte Quellstände durch den Hauptagenten kontrollieren. Ergebnisberichte werden aus den normalen Antworten durch die Runtime in den jeweiligen `.tmp/audit-wave-01/`-Bereich geschrieben; die Audit-Subagents selbst schreiben keine Dateien. Dauerhafte Befunde übernimmt nur der Hauptagent in Issues.

## Anzeigegrenze

Die Standardagenten bleiben über `disableBuiltins` abgeschaltet; `action: "list", capabilities: true` zeigt ausschließlich die drei eigenen Audit-Profile als ausführbar. `/subagents-models` zeigt sie in der gepinnten Extension-Version trotzdem mit `disabled` an (auch Aliase). Vollständiges Ausblenden aus dieser Diagnoseansicht ist damit noch nicht erreicht und benötigt eine gesonderte Extension-Anpassung, keine direkte Änderung am ignorierten Paketdownload.

## Vorgehen

- Die effektiven Definitionen von `aom-doc-auditor` (Sol/medium), `aom-code-auditor` und `aom-perf-auditor` (je Sol/high) wurden mit `action: "get"` geprüft: eigene Projektprofile, frischer Kontext, `inheritProjectContext: true`, nur Lese-/Suchwerkzeuge und `contact_supervisor`, keine ambient geladenen Extensions. Diese Prüfung beweist noch keinen erfolgreichen Modell-/Toolstart. Vor dem Lauf erneut auf Overrides prüfen; keine Standardagenten reaktivieren.
- Drei parallele Analyseaufträge auf demselben Ausgangscommit, jeweils im eigenen Worktree: Dokumentationsrichtigkeit und Issue-Aktualität; Wartbarkeit/Codequalität und belegte Altlasten; statische Performance-/Skalierungsrisiken. Lesebereiche dürfen sich überschneiden, die Fragestellungen und Kernbefunde nicht. Keine Dateischreibrechte, kein künstlicher Änderungsbedarf.
- Der Hauptagent bereitet die Worktrees vor und übergibt den vor Start geprüften absoluten Pfad, Branch, Ausgangscommit und sauberen Git-Status. Audit-Subagents gleichen den Nachweis mit ihrem Kontext ab; sie führen Git nicht selbst aus und legen keine Scratch-Dateien an. Mindestens eine echte, begrenzte Supervisor-Rückfrage zur Abgrenzung oder einem Befund in der ursprünglichen Hauptsession beantworten.
- Der Hauptagent konsolidiert und verifiziert die Quellenbefunde. Höchstens zwei kleine, unabhängige Änderungen als möglichen Testumfang mit dem Nutzer vereinbaren. Erst danach gegebenenfalls ein gesondertes Schreibprofil vorbereiten und exakte Schreibgrenzen zuweisen.
- Freigegebene schreibende Agenten prüfen gezielt und committen getrennt. Der Hauptagent reviewed und integriert nacheinander; ausschließlich er führt die volle Testsuite einmal ganz am Schluss nach Integration aller freigegebenen Änderungen aus. Issues bleiben ausschließlich in seiner Zuständigkeit.

## Abnahme

- Keine Änderungen im fremden Worktree; eigene `.tmp/`-Pfade auch für Logs/Hilfsprogramme, nichts Temporäres im Commit. Eigenständige Build-/Abhängigkeitsverzeichnisse, soweit benötigt.
- Die [Modellzuordnung](../subagents.md#modelle-und-thinking) anhand der tatsächlich gestarteten Audit-Rollen prüfen: Sol/medium für Dokumentation, Sol/high für die beiden anspruchsvollen Codeanalysen. Nicht unbemerkt vom Hauptagenten übernehmen; weder Terra noch Astra allein zum Testen aufrufen.
- Asynchrone Zustellung einer Rückfrage, passende Antwort und Abschluss tatsächlich beobachtet; Verhalten bei Blockaden nicht aus einem Doctor-Report ableiten.
- Audit-Übergaben enthalten Ausgangsstand, Abdeckung, belegte und priorisierte Befunde, Unsicherheiten, kleinste Maßnahmen und vorgeschlagene spätere Prüfungen; ausdrücklich keine ausgeführten Tests oder Änderungen. Spätere Schreibübergaben enthalten Commit, Dateiumfang, tatsächlich ausgeführte gezielte Prüfungen und offene Grenzen. Integration übernimmt ausschließlich geprüfte Änderungen; die abschließende Gesamtsuite läuft beim Hauptagenten.
- Erst nach beendeten Prozessen, gesicherter Integration und Übernahme dauerhafter Befunde aufräumen. Übrig gebliebene Runs, Branches oder Worktrees mit konkretem Zustand und nächster Aktion hier vermerken, nicht stillschweigend löschen.

Bei Start-/Toolfehlern den tatsächlichen Befund knapp hier ergänzen und den Lauf anhalten; kein stiller Wechsel auf eine andere CLI oder gemeinsame Arbeitsverzeichnisse. Nach erfolgreichem Testlauf und geklärten Restpunkten dieses Issue löschen.
