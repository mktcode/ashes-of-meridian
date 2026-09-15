# Parallele Entwicklung mit Pi-Subagents

[AGENTS.md](../AGENTS.md#parallele-arbeit-und-subagents) legt Zuständigkeiten und Grenzen fest. Diese Referenz beschreibt die technische Durchführung; konkrete Aufträge, Entscheidungen und nötige Übergaben bleiben in [Issues](issues/), nicht in einem zweiten Aufgabenboard oder Worklog.

## Einrichtung und Projektkontext

[pi-subagents](https://github.com/nicobailon/pi-subagents) ist in [`.pi/settings.json`](../.pi/settings.json) auf einen Git-Commit gepinnt. Pi installiert fehlende Projektpakete nach Projektfreigabe; `.pi/git/` enthält den ignorierten Download, nicht eingecheckte Extension-Quellen. Nach Installation `/reload` ausführen, bei neuer Projektfreigabe Pi neu starten. `/subagents-doctor` prüft die Einrichtung. Updates bewusst mit `pi install -l git:github.com/nicobailon/pi-subagents@<neuer-Commit>` vornehmen und prüfen.

Die gemeinsame `AGENTS.md` ist **keine live geteilte Datei**: Jeder Worktree hat eine Kopie seines ausgecheckten Standes. Deshalb Regeln und Einrichtung vor dem Start einer Arbeitswelle committen. Notwendige spätere Regeländerungen ausdrücklich an laufende Agenten übermitteln und vor weiterer Arbeit bestätigen lassen.

Eingebaute Rollen erben laut Extension-Dokumentation den Repositorykontext. Eigene Profile unter `.pi/agents/` tun das nicht automatisch und müssen `inheritProjectContext: true` setzen. Vor jedem Start die effektive Definition mit `subagent({ action: "get", agent: "…" })` prüfen; lokale/globale Overrides können Profilwerte ersetzen. Der Auftrag nennt zusätzlich die zu lesende `AGENTS.md` im Zielworktree. Ein Fork des Gesprächs ersetzt weder diesen Check noch einen Git-Worktree.

Zum Einstieg reichen die eingebauten Rollen `scout` für Analyse und `worker` für schreibende Aufgaben, jeweils mit einem konkreten Bereichsauftrag. `docs-worker`, `test-worker` und bereichsspezifische Code-Aufträge sind zunächst Aufgabenarten, keine bereits installierten Spezialprofile. Ein unabhängiger Review erhält ausdrücklich einen Auftrag ohne Quelländerungen und ebenfalls einen eigenen Worktree auf dem zu prüfenden Commit.

## Modelle und Thinking

Maßgeblich für die Startwerte ist [`.pi/settings.json`](../.pi/settings.json): Pi-eigene `defaultProvider`, `defaultModel` und `defaultThinkingLevel` betreffen den Hauptagenten; `subagents.defaultModel`, `defaultThinking` und `agentOverrides` betreffen die Kinder. Die getrennte Vorgabe verhindert, dass normale Subagents unabsichtlich das teurere Hauptmodell übernehmen. Die Datei setzt für neue Hauptsessions Sol/medium; Sol oder Astra mit medium/high lassen sich bei Bedarf über `/model` und `/thinking` wählen. Bereits laufende oder fortgesetzte Sessions und explizite CLI-Vorgaben können davon abweichen.

Die Rollen sind nur Startpunkte: `scout` übernimmt einfache lokale Erkundung mit Terra, `worker` klar abgegrenzte Umsetzung mit Sol und niedrigem Thinking. Reviews brauchen mehr Abwägung; `oracle` ist für schwierige, begrenzte Analysen gedacht, nicht automatisch für Astra. Auch Dokumentation und Tests können anspruchsvoll sein: fachliche Unsicherheit, gemeinsame Verträge und kreative Entscheidungen sind wichtiger als Dateiendung oder Textmenge. Die jeweils konkreten Rollenwerte stehen in der Konfiguration, nicht in einer zweiten gepflegten Tabelle.

Bei einfachen mechanischen Änderungen kann der Hauptagent auch einen `worker` ausdrücklich auf Terra setzen. Schwierige Implementierungen oder Reviews erhalten Sol/medium bzw. high. Astra/medium oder high wird ausschließlich für sehr komplexe Aufgaben oder kreative Denkarbeit gezielt gewählt, mit begründetem Ziel und begrenztem Ergebnis im Auftrag; kein pauschaler Astra-Fanout und keine automatische Eskalation bei Fehlern oder langen Laufzeiten. Modellwechsel eines Kindes nicht über dessen `resume` versuchen: Fortsetzungen behalten den gespeicherten Modellvertrag. Erst Zustand/Übergabe sichern, dann gegebenenfalls einen neuen Auftrag mit begründeter Modellwahl starten.

Vor einer Welle `/subagents-models` bzw. `subagent({ action: "models" })` prüfen. Für Ausnahmen im jeweiligen `runs.run`-/`runs.all`-Eintrag ein **providerqualifiziertes Modell mit Thinking-Suffix** angeben, etwa `model: "openai-codex/gpt-5.6-sol:medium"` oder `model: "openai-codex/gpt-6-astra:high"`. Ein separates `thinking`-Feld ist kein unterstützter Dispatch-Parameter. Kein Modell am gesamten Workflow setzen, wenn die Kinder unterschiedliche Rollenstandards nutzen sollen. Die effektive Auswahl nach dem Start anhand der Laufzeitangaben kontrollieren, nicht nur anhand der angeforderten Werte.

`defaultThinking` ersetzt nicht das explizite Thinking einer eingebauten Rolle; deshalb überschreibt `agentOverrides` insbesondere den hohen Worker-Standard. Auch eigene Profile können Defaults überschreiben und sind vor dem Start zu prüfen. `modelScope` begrenzt native Kinder strikt auf die drei vorgesehenen Modelle; `maxThinking` weist Werte oberhalb high zurück. Die Einschätzung „sehr komplex oder kreativ“ ist eine Orchestrierungsregel, keine automatische Budgetkontrolle: Astra ist technisch erlaubt, wird aber nicht als Rollenstandard gesetzt. Externe CLI-Runner unterliegen diesen nativen Modell-/Thinking-Grenzen nicht und sind kein Ausweichweg.

Nach Konfigurationsänderungen `/reload` und `/subagents-models` verwenden; für einen Hauptsession-Startwert eine neue Sitzung bzw. explizite Modellwahl nutzen. Änderungen bleiben projektlokal, globale Einstellungen unangetastet. Modellkatalog und erfolgreiche Auflösung beweisen noch keinen erfolgreichen Provideraufruf; dieser Nachweis gehört in den realen Worktree-Testlauf.

## Arbeitspakete und Worktree-Lebenszyklus

Vor einer Welle hält der Hauptagent im betroffenen Issue knapp fest: Ziel/Nicht-Ziele, erlaubte Dateien oder Verträge, Abhängigkeiten, Abnahmekriterien und Zuständigkeit. Bei aktiver Delegation kommen Branch, Ausgangscommit, absoluter Worktree-Pfad und Run-ID hinzu, soweit für Wiederaufnahme nötig. Fachliche Abhängigkeiten entscheiden über Parallelität: Tests und Dokumentation zu einer noch offenen Verhaltensänderung brauchen zuerst einen vereinbarten Vertrag oder den fertigen Implementierungsstand.

Wir verwenden **vom Hauptagenten angelegte und bis zur Integration erhaltene Git-Worktrees**. Die Extension bietet zwar `worktree: true`, kann dabei aber nach Patch-/Manifest-Erfassung ihre temporären Worktrees und Branches automatisch entfernen. Dieser Lebenszyklus passt nicht zu unserer Branch-basierten Integration.

1. Hauptcheckout und Ausgangsstand prüfen. Fremde Änderungen weder mitnehmen noch automatisch committen/stashen. Für die Welle einen geprüften Commit festhalten.
2. Pro Aufgabe einen eindeutigen Branch, etwa `aom/<auftrag>-<teilaufgabe>`, und einen Worktree außerhalb des Hauptcheckouts und außerhalb der Pi-Extension-Suchpfade anlegen. Beispiel: `git worktree add -b <branch> <absoluter-pfad> <ausgangscommit>`. Pfade und Namen vorher auf bestehende Belegung prüfen.
3. Projektkontext, benötigte Pi-Ressourcen und Abhängigkeiten im neuen Worktree bereitstellen. Ignorierte Dateien werden von Git **nicht** mitgenommen. Bei Build-/Testbedarf `npm ci` im jeweiligen Worktree ausführen; `node_modules/` und `dist/` nicht aus einem anderen Worktree verlinken. Keine globale Pi-Konfiguration nebenbei ändern.
4. Den Subagenten über das native `subagent`-Tool mit dem **absoluten Worktree-Pfad als `cwd` und explizitem `worktree: false`** starten. Das deaktiviert nur die zusätzliche automatische Worktree-Erzeugung der Extension; der Prozess arbeitet bereits im zuvor isolierten Worktree. Niemals den Hauptcheckout als Subagent-`cwd` einsetzen.
5. Der Subagent prüft Identität und Arbeitsbaum, liest die lokalen Regeln, arbeitet im erlaubten Umfang und committet geprüfte Änderungen. Ein reiner Analyseauftrag erzeugt keine Quelländerungen und keinen leeren Commit.
6. Bei Nacharbeit bleibt derselbe Worktree erhalten. Erst sicherstellen, dass kein vorheriger Run mehr darin arbeitet, bevor ein neuer Bearbeiter übernimmt. Auch der Hauptagent verändert keinen aktiv bearbeiteten Subagent-Worktree.

Jeder Auftrag muss ohne Gesprächshistorie verständlich sein: Ziel, Issue, cwd/Branch/Ausgangscommit, Schreibgrenzen, maßgebliche Quellen/Verträge, Prüfungen, Ausgabe und Stop-/Rückfragebedingungen. Der Hauptagent prüft vor dem Start mit `action: "list", capabilities: true` die Rollenverfügbarkeit; eine reine Auflistung beweist noch keinen erfolgreichen Modellstart.

## Temporäre Isolation

`.gitignore` schließt `.tmp/` aus. Das verhindert versehentliches Einchecken, erzeugt aber weder das Verzeichnis noch eine Sandbox. Für selbst gestartete Hilfsprogramme im jeweiligen Worktree beispielsweise:

```bash
root="$(git rev-parse --show-toplevel)"
mkdir -p "$root/.tmp"
scratch="$(mktemp -d "$root/.tmp/task-XXXXXX")"
export TMPDIR="$scratch" TMP="$scratch" TEMP="$scratch"
# Hilfsprogramme in dieser Shell starten; Ausgabe-/Browserprofilpfade unter "$scratch".
```

Vorher muss der Worktree mit dem Auftrag abgeglichen sein. Bei späteren Shell-Toolaufrufen die absoluten Pfade und Umgebungsvariablen erneut setzen. Ein `export` in einem Toolaufruf verändert weder die bereits laufende Pi-Instanz noch automatisch spätere Aufrufe. Für explizite Ergebnisdateien im Subagent-Aufruf auch das tatsächliche `output`-Feld auf einen eindeutigen absoluten Pfad unter dem jeweiligen `.tmp/` setzen; eine Dateiangabe nur im Aufgabentext steuert die Runtime-Ausgabe nicht zuverlässig.

Pi-/Extension-eigene Sessions, IPC und automatisch erzeugte Tool-Ausgaben haben einen gesonderten Laufzeitvertrag und können weiterhin in benutzer-/laufbezogenen Systemverzeichnissen liegen. Diese Infrastruktur nicht durch globale Umgebungsänderungen oder Symlinks zwischen Agenten umbiegen oder löschen. Die Projektregel isoliert unsere selbst angelegten Arbeitsdateien und steuerbaren Hilfsprozesse; sie behauptet nicht, dass jede Runtime-Datei bereits im Worktree liegt. Fest kodierte externe Temp-Pfade eines benötigten Werkzeugs vor paralleler Nutzung klären, nicht stillschweigend auf gemeinsame Dateinamen ausweichen.

Eigene Browserprofile, Logs und Scratch-Skripte bleiben bis zum Abschluss benötigter Prüfungen erhalten. Relevante Befunde vor dem Aufräumen ins Issue übernehmen. Versionierte Fixtures gehören weiterhin zu den Tests; reguläre Build-Ausgaben bleiben im worktree-eigenen `dist/`.

## Asynchrone Kommunikation

Eine koordinierte Welle startet als ein `workflowScript` mit `async: true`; unabhängige Aufträge über `runs.all`, abhängige Schritte erst nach dem benötigten Ergebnis. Zunächst maximal drei gleichzeitige Kinder, im Workflow über `globalConcurrencyLimit: 3` begrenzen. Jeder Eintrag bekommt einen eindeutigen `key`, ein kurzes `label`, sein eigenes `cwd` und `worktree: false`. Die konkrete Syntax vor dem Start gegen die installierte Hilfe (`/subagents-guide workflows`, `/subagents-guide tool-reference`) prüfen und das Script mit `action: "validate"` ohne Kinderstart validieren. Das ist keine Worktree- oder Modellabnahme.

- Kinder stellen blockierende Rückfragen mit `contact_supervisor({ reason: "need_decision", message: "…" })`; relevante nichtblockierende Meldungen verwenden `reason: "progress_update"`.
- Der Hauptagent prüft offene Fragen mit `subagent_supervisor({ action: "pending" })` und antwortet mit `action: "reply"`, der konkreten `replyTo`-ID und `message`. Fragen gehören zur startenden Pi-Session; eine andere Session im selben Repository ist kein Ersatzempfänger. Fachliche Freigaben außerhalb des Auftrags gehen an den Nutzer.
- Nachträgliche Hinweise an laufende Kinder über `steer`, abgeschlossene Kinder nur nach geprüftem Status über `resume` oder einen neuen Auftrag fortsetzen. Zustellbestätigung beweist noch keine Umsetzung.
- Abschlussmeldungen liefert die Extension nativ. Keine Polling-/Sleep-Schleifen; wenn keine unabhängige Arbeit ansteht, auf die Benachrichtigung reagieren. `/subagents-fleet` und `action: "status"` dienen gezielter Diagnose.

Dafür ist keine zusätzliche Intercom-Extension nötig. Laufzeitstatus und Nachrichten transportieren Arbeit, sind aber kein paralleles fachliches Issue-System. Bei Start-, Kommunikations- oder Toolfehlern Fehler, Run-ID und Git-Zustand sichern; keine Ersatz-CLI oder unisolierten Runs starten. Ohne funktionierenden Supervisor-Kanal nicht mit entscheidungsabhängiger Arbeit weitermachen.

## Integration und Abschluss

Die Übergabe erfolgt im normalen Ergebnis: Status, Branch/Commit, geänderte Dateien, tatsächlich ausgeführte Prüfungen samt Resultat, Restprobleme und nötige Entscheidungen; bei größeren Logs zusätzlich der eigene `.tmp/`-Pfad. Der Hauptagent prüft den vollständigen Diff seit dem Ausgangscommit und den Status auf uncommittete oder unerwartete Dateien. Eine Erfolgsmeldung allein ist keine Merge-Freigabe.

Ergebnisse nacheinander in den sauberen Integrationsbranch übernehmen, vorzugsweise als `git merge --no-ff <aufgabenbranch>` nach Review. Abhängige Aufgaben starten auf dem dafür integrierten Stand; nicht auf zufällig fortgeschrittenem `HEAD`. Konflikte in gemeinsamen Verträgen inhaltlich lösen oder an den zuständigen Bearbeiter zurückgeben, nie pauschal eine Seite bevorzugen. Kein Push oder Deployment allein wegen erfolgreicher lokaler Integration.

Den kombinierten Stand gemäß [Prüfverfahren](testing.md) testen; Einzelprüfungen der Agenten reichen dafür nicht aus. Erst danach Issues aktualisieren bzw. erledigte Issue-Dateien löschen. Worktrees nur nach beendeten Runs/Hilfsprozessen, gesicherter Übergabe und nicht mehr benötigter Nachprüfung entfernen. Vorher auch ignorierte Dateien prüfen (`git status --short --ignored`), nötige Belege sichern und nur eigene entbehrliche Dateien löschen. Reguläres `git worktree remove <pfad>` und nach nachgewiesenem Merge `git branch -d <branch>` bevorzugen; kein pauschales `--force`, `git clean -fdx` oder Löschen fremder Worktrees. Bei unklarer Integration oder Verwerfung Worktree und Branch erhalten und die nächste Entscheidung im Issue festhalten.
