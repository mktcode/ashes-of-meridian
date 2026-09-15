# Testlauf: parallele Repo-Pflege in Worktrees

## Ziel und Grenze

Den [dokumentierten Subagent-Arbeitsablauf](../subagents.md) mit einem kleinen realen Durchlauf prüfen: isolierte Arbeit, asynchrone Rückfrage/Antwort, Übergabe, Integration und sichere Bereinigung. Einrichtung und Regeln sind vorbereitet; ein echter paralleler Modell-/Worktree-Lauf steht noch aus. Der bisherige Extension-Lade-/Doctor-Check ersetzt diesen Nachweis nicht.

Der nächste Auftrag startet den Testlauf. Zunächst das Repo analysieren und kleine Pflegekandidaten auswählen, nicht pauschal den Backlog implementieren. Größeres Refactoring und Regel-/Balancingänderungen bleiben außerhalb des Testumfangs.

## Vorgehen

- Zwei unabhängige Analyseaufträge auf demselben Ausgangscommit, jeweils in eigenem Worktree: Dokumentationsrelevanz/Redundanzen/erledigte Issues sowie Tests und ein eng eingegrenzter Codebereich. Befunde mit Quellen und vorgeschlagenem Änderungsumfang zurückgeben, noch nichts bereinigen.
- Mindestens eine begrenzte Supervisor-Rückfrage zum weiteren Vorgehen stellen und in der ursprünglichen Hauptsession beantworten. Jeder Agent meldet seinen tatsächlichen cwd, Branch, Ausgangscommit und Scratch-Pfad; lokale `AGENTS.md` und effektive Kontextvererbung prüfen.
- Der Hauptagent wählt daraus höchstens zwei kleine, unabhängige Änderungen im freigegebenen Pflegeumfang aus und weist exakte Schreibgrenzen zu. Ein mögliches Refactoring vor Umsetzung konkret eingrenzen und mit dem Nutzer klären, falls es über den Auftrag hinausgeht. Kein künstlicher Änderungsbedarf nur für den Testlauf.
- Schreibende Agenten prüfen und committen getrennt. Der Hauptagent reviewed, integriert nacheinander und prüft den kombinierten Stand risikogerecht. Issues bleiben ausschließlich in seiner Zuständigkeit.

## Abnahme

- Keine Änderungen im fremden Worktree; eigene `.tmp/`-Pfade auch für Logs/Hilfsprogramme, nichts Temporäres im Commit. Eigenständige Build-/Abhängigkeitsverzeichnisse, soweit benötigt.
- Asynchrone Zustellung einer Rückfrage, passende Antwort und Abschluss tatsächlich beobachtet; Verhalten bei Blockaden nicht aus einem Doctor-Report ableiten.
- Übergaben enthalten Commit, Dateiumfang, Testnachweise und offene Grenzen. Integration übernimmt ausschließlich geprüfte Änderungen; auch der zusammengeführte Stand ist geprüft.
- Erst nach beendeten Prozessen, gesicherter Integration und Übernahme dauerhafter Befunde aufräumen. Übrig gebliebene Runs, Branches oder Worktrees mit konkretem Zustand und nächster Aktion hier vermerken, nicht stillschweigend löschen.

Bei Start-/Toolfehlern den tatsächlichen Befund knapp hier ergänzen und den Lauf anhalten; kein stiller Wechsel auf eine andere CLI oder gemeinsame Arbeitsverzeichnisse. Nach erfolgreichem Testlauf und geklärten Restpunkten dieses Issue löschen.
