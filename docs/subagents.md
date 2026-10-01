# Subagent-Arbeitsablauf

Verbindliche Rollen-/Freigabegrenzen: [AGENTS](../AGENTS.md#delegation). Hier stehen nur projektspezifische Durchführung und Fallen.

## Einrichtung und Projektkontext

Pi-Subagents ist als gepinntes Benutzerpaket installiert; das Repository enthält keine Extension-Kopie. Projektwerte in [`.pi/settings.json`](../.pi/settings.json), eigene Profile in [`.pi/agents/`](../.pi/agents/) überschreiben Defaults. Builtins sind nur projektlokal deaktiviert; eine Diagnoseanzeige deaktivierter Rollen bedeutet keine Verfügbarkeit.

Vor Start effektives Profil (`action: "get"`), Rollenverfügbarkeit (`action: "list", capabilities: true`) und Kontextvererbung prüfen. Worktrees erhalten die ausgecheckte AGENTS-Version, keine live geteilten Regeln. Einrichtung vor einer Welle committen; ein Gesprächs-Fork ersetzt keinen Worktree/Identitätscheck.

Audit-Profile besitzen nur Lesewerkzeuge und bleiben auch bei Folgefragen lesend. Spätere Umsetzung braucht einen freigegebenen Schreibauftrag, keine spontane Werkzeugerweiterung. Hauptagent liefert bei fehlender Shell den Git-Nachweis; kein `npm ci`/Build für reine Audits.

## Modelle und Thinking

Hauptmodell- und Kinddefaults sind getrennt in den Projekteinstellungen. Vor Start effektive Profil-/Overridewerte prüfen; Luna/low für kleine klare Aufgaben, Sol/medium oder high für fachliche Unsicherheit/Reviews. Modellkatalog beweist noch keinen erfolgreichen Provideraufruf.

Explizite Ausnahme je Run providerqualifiziert mit Thinking-Suffix, etwa `openai-codex/gpt-6-luna:low`; kein separates Dispatch-`thinking`-Feld. Native Kinder sind durch `modelScope`/`maxThinking` begrenzt; externe CLI ist kein Ausweichweg. `resume` behält den Modellvertrag: vor einem Modellwechsel Zustand sichern und neu beauftragen. Konfigurationsänderungen über `/reload` prüfen; keine globalen Einstellungen nebenbei ändern.

## Worktrees und Aufträge

1. Sauberen Ausgangscommit festhalten; fremde Änderungen nicht committen/stashen.
2. Eindeutigen Branch/absoluten Worktree außerhalb Hauptcheckout und Pi-Suchpfaden anlegen: `git worktree add -b <branch> <pfad> <commit>`.
3. Auftrag mit Ziel, Issue, Pfad/Branch/Commit, Grenzen, Abhängigkeiten, Prüfung und Stopbedingungen übergeben. Ignorierte Dateien werden nicht mitgenommen; bei tatsächlichem Buildbedarf eigene Abhängigkeiten installieren, keine geteilten Symlinks.
4. Kind mit eigenem `cwd` und explizitem `worktree: false` starten. Extension-eigene `worktree: true`-Bereinigung passt nicht zur erhaltenen Branchintegration. Identität/Status vor Arbeit abgleichen.
5. Nacharbeit im selben erhaltenen Worktree, aber erst nach Ende des vorherigen Bearbeiters. Hauptagent verändert keinen aktiv bearbeiteten Kind-Worktree.

Abhängige Pakete starten erst mit vereinbartem Vertrag bzw. integriertem Ergebnis; verschiedene Verzeichnisse beweisen keine Unabhängigkeit. Reine Analyse erzeugt weder Änderungen noch leeren Commit.

## Temporäre Isolation

Pro Lauf eigenes `<worktree>/.tmp/<lauf>/` anlegen und `TMPDIR`, `TMP`, `TEMP` sowie Profile/Logs/Ausgabewege absolut dorthin setzen. Shell-Exports wirken nicht auf spätere Toolaufrufe oder die laufende Pi-Instanz. Auch steuerbare Runtime-`output`-Felder explizit setzen; bloße Dateiangaben im Auftrag reichen nicht.

Pi-eigene Sessions/IPC/automatische Toolausgaben haben separate Laufzeitpfade. Diese nicht global umbiegen/löschen; `.tmp/` ist keine Sandbox. Fest kodierte externe Toolpfade vor paralleler Nutzung klären. Nötige dauerhafte Befunde vor Bereinigung ins Issue übernehmen.

## Kommunikation und Integration

Koordinierte Welle als asynchrones WorkflowScript, unabhängige Runs über `runs.all`, maximal drei gleichzeitig. Syntax gegen installierte Hilfe prüfen und vor Start validieren. Rückfragen via `contact_supervisor`; Hauptagent antwortet im nativen Supervisor mit konkreter `replyTo`-ID. Abschluss kommt nativ: keine Polling-/Sleep-Schleifen, kein zusätzliches Intercom/Worklog.

Bei Start-/Kommunikationsfehlern Run-ID und Git-Zustand sichern, nicht unisoliert oder per Ersatz-CLI fortfahren. Übergabe nennt Branch/Commit, Diffumfang, tatsächliche Prüfungen, Risiken/Entscheidungen. Hauptagent prüft Diff seit Ausgangscommit und Status, integriert einzeln (bevorzugt `git merge --no-ff`) und prüft kombiniert nach [Risiko/Zeitbudget](testing.md), nicht automatisch per Vollsuite.

Nach gesicherter Integration/Verwerfung und beendeten Prozessen ignorierte Dateien prüfen, Belege sichern, regulär `git worktree remove` und bei nachgewiesenem Merge `git branch -d` verwenden. Kein pauschales Force/Clean oder Löschen fremder Arbeit. Bei Unklarheit Branch/Worktree erhalten und Entscheidung im Issue festhalten.
