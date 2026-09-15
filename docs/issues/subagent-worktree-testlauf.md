# Testlauf: parallele Repo-Pflege in Worktrees

## Ziel und Grenze

Den [dokumentierten Subagent-Arbeitsablauf](../subagents.md) mit einem kleinen realen Durchlauf prüfen: isolierte Arbeit, asynchrone Rückfrage/Antwort, Übergabe, Integration und sichere Bereinigung. Einrichtung und Regeln sind vorbereitet; ein echter paralleler Modell-/Worktree-Lauf steht noch aus. Der bisherige Extension-Lade-/Doctor-Check ersetzt diesen Nachweis nicht.

Der nächste Auftrag startet den Testlauf. Zunächst das Repo analysieren und kleine Pflegekandidaten auswählen, nicht pauschal den Backlog implementieren. Größeres Refactoring und Regel-/Balancingänderungen bleiben außerhalb des Testumfangs.

## Anzeigegrenze

Die Standardagenten sind über `disableBuiltins` abgeschaltet; die ausführbare Liste wurde leer geprüft. `/subagents-models` zeigt sie in der gepinnten Extension-Version trotzdem mit `disabled` an (auch Aliase). Vollständiges Ausblenden aus dieser Diagnoseansicht ist damit noch nicht erreicht und benötigt eine gesonderte Extension-Anpassung, keine direkte Änderung am ignorierten Paketdownload.

## Vorgehen

- Vor dem Start eigene Projektprofile für Analyse und Umsetzung anlegen und ihre Modell-/Thinking-Werte, Tools und `inheritProjectContext: true` prüfen. Die Standardagenten sind bewusst deaktiviert; derzeit sind noch keine eigenen Profile eingerichtet. Standardagenten nicht für den Testlauf wieder aktivieren.
- Zwei unabhängige Analyseaufträge auf demselben Ausgangscommit, jeweils in eigenem Worktree: Dokumentationsrelevanz/Redundanzen/erledigte Issues sowie Tests und ein eng eingegrenzter Codebereich. Befunde mit Quellen und vorgeschlagenem Änderungsumfang zurückgeben, noch nichts bereinigen.
- Mindestens eine begrenzte Supervisor-Rückfrage zum weiteren Vorgehen stellen und in der ursprünglichen Hauptsession beantworten. Jeder Agent meldet seinen tatsächlichen cwd, Branch, Ausgangscommit und Scratch-Pfad; lokale `AGENTS.md` und effektive Kontextvererbung prüfen.
- Der Hauptagent wählt daraus höchstens zwei kleine, unabhängige Änderungen im freigegebenen Pflegeumfang aus und weist exakte Schreibgrenzen zu. Ein mögliches Refactoring vor Umsetzung konkret eingrenzen und mit dem Nutzer klären, falls es über den Auftrag hinausgeht. Kein künstlicher Änderungsbedarf nur für den Testlauf.
- Schreibende Agenten prüfen und committen getrennt. Der Hauptagent reviewed, integriert nacheinander und prüft den kombinierten Stand risikogerecht. Issues bleiben ausschließlich in seiner Zuständigkeit.

## Abnahme

- Keine Änderungen im fremden Worktree; eigene `.tmp/`-Pfade auch für Logs/Hilfsprogramme, nichts Temporäres im Commit. Eigenständige Build-/Abhängigkeitsverzeichnisse, soweit benötigt.
- Die [Modellzuordnung](../subagents.md#modelle-und-thinking) mindestens mit Terra für einfache Erkundung und Sol für die gewählte Umsetzung prüfen: tatsächlich gestartetes Modell und Thinking müssen zum Auftrag passen und dürfen nicht unbemerkt vom Hauptagenten übernommen werden. Astra nicht allein zum Testen aufrufen.
- Asynchrone Zustellung einer Rückfrage, passende Antwort und Abschluss tatsächlich beobachtet; Verhalten bei Blockaden nicht aus einem Doctor-Report ableiten.
- Übergaben enthalten Commit, Dateiumfang, Testnachweise und offene Grenzen. Integration übernimmt ausschließlich geprüfte Änderungen; auch der zusammengeführte Stand ist geprüft.
- Erst nach beendeten Prozessen, gesicherter Integration und Übernahme dauerhafter Befunde aufräumen. Übrig gebliebene Runs, Branches oder Worktrees mit konkretem Zustand und nächster Aktion hier vermerken, nicht stillschweigend löschen.

Bei Start-/Toolfehlern den tatsächlichen Befund knapp hier ergänzen und den Lauf anhalten; kein stiller Wechsel auf eine andere CLI oder gemeinsame Arbeitsverzeichnisse. Nach erfolgreichem Testlauf und geklärten Restpunkten dieses Issue löschen.
