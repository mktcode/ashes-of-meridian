# Parallele Entwicklung mit Pi-Subagents

[AGENTS.md](../AGENTS.md#parallele-arbeit-und-subagents) legt Zuständigkeiten und Grenzen fest. Diese Referenz beschreibt die technische Durchführung; konkrete Aufträge, Entscheidungen und nötige Übergaben bleiben in [Issues](issues/), nicht in einem zweiten Aufgabenboard oder Worklog.

## Einrichtung und Projektkontext

[pi-subagents](https://github.com/nicobailon/pi-subagents) ist in [`.pi/settings.json`](../.pi/settings.json) auf einen Git-Commit gepinnt. Pi installiert fehlende Projektpakete nach Projektfreigabe; `.pi/git/` enthält den ignorierten Download, nicht eingecheckte Extension-Quellen. Nach Installation `/reload` ausführen, bei neuer Projektfreigabe Pi neu starten. `/subagents-doctor` prüft die Einrichtung. Updates bewusst mit `pi install -l git:github.com/nicobailon/pi-subagents@<neuer-Commit>` vornehmen und prüfen.

Die gemeinsame `AGENTS.md` ist **keine live geteilte Datei**: Jeder Worktree hat eine Kopie seines ausgecheckten Standes. Deshalb Regeln und Einrichtung vor dem Start einer Arbeitswelle committen. Notwendige spätere Regeländerungen ausdrücklich an laufende Agenten übermitteln und vor weiterer Arbeit bestätigen lassen.

Die eingebauten Agenten sind projektlokal mit `subagents.disableBuiltins: true` abgeschaltet, einschließlich externer CLI-Rollen und ihrer Aliase. Das entfernt keine Extension-Dateien und ändert andere Projekte nicht. Eigene sowie zusätzlich installierte Paket-/Benutzerprofile werden dadurch nicht deaktiviert. Eigene Projektprofile unter `.pi/agents/` müssen `inheritProjectContext: true` setzen, da sie den Repositorykontext nicht automatisch erben. Vor jedem Start die effektive Definition mit `subagent({ action: "get", agent: "…" })` prüfen; lokale/globale Overrides können Profilwerte ersetzen. Der Auftrag nennt zusätzlich die zu lesende `AGENTS.md` im Zielworktree. Ein Fork des Gesprächs ersetzt weder diesen Check noch einen Git-Worktree.

`/subagents-models` zeigt in der installierten Version auch deaktivierte Rollen samt Aliasen mit `source: …; disabled`; das ist eine Diagnoseansicht, keine Liste ausführbarer Agenten. Für die tatsächlich verfügbaren Agenten `subagent({ action: "list", capabilities: true })` verwenden. Die Modellregistry am Ende der Diagnose wird durch die Abschaltung ebenfalls nicht reduziert.

## Projektteam für lesende Audits

- [`aom-doc-auditor`](../.pi/agents/aom-doc-auditor.md) prüft Dokumentationsaussagen und Issue-Aktualität gegen Quellen und gelesene Tests.
- [`aom-code-auditor`](../.pi/agents/aom-code-auditor.md) untersucht Wartbarkeit, fragile Verträge und belegbare historische Altlasten.
- [`aom-perf-auditor`](../.pi/agents/aom-perf-auditor.md) untersucht statisch mögliche Laufzeit-/Skalierungsrisiken, ohne Messungen oder Optimierungen auszuführen.

Modelle und Thinking sind direkt in diesen Profilen definiert. Der fachliche Dokumentationsabgleich benötigt mehr als einfache Erkundung; die beiden Code-Audits müssen übergreifende Zusammenhänge beurteilen. Daher nutzen diese Rollen Sol mit medium bzw. high statt des allgemeinen low-Startwerts. Die Rollen erhalten frischen Kontext und Repositoryregeln. Ihre explizite Werkzeugliste besteht nur aus `read`, `grep`, `find`, `ls` und dem nativen `contact_supervisor`; ambient geladene Extensions sind abgeschaltet. Die Liste ersetzt keine Dateisystem-Sandbox: der Auftrag begrenzt die Lesewege auf den eigenen Worktree und die ausdrücklich benötigten Referenzen.

Die Audit-Profile bleiben auch bei Folgefragen ausschließlich lesend, schreiben keine Scratch-Berichte und führen keine Programme aus. Tests werden nur gelesen, Performancewirkungen ausdrücklich als ungemessen markiert. Ein späterer Umsetzungsauftrag benötigt ein gesondert freigegebenes Schreibprofil; Audit-Werkzeuge nicht für eine schnelle Korrektur erweitern. Die volle Testsuite läuft ausschließlich beim Hauptagenten ganz am Schluss, nach Integration aller freigegebenen Änderungen.

Da die Audits keine Shell haben, prüft der Hauptagent vor ihrem Start Git-Pfad, Branch, Ausgangscommit und sauberen Status und übergibt die konkreten Ausgaben im Auftrag. Die Agenten gleichen diesen Nachweis mit ihrem Kontext ab; bei fehlenden Angaben fragen sie nach, statt selbst Git auszuführen. Einrichtung und Git-Prüfung erfolgen vor der lesenden Analysephase; für diese ist kein `npm ci` oder Build nötig. Die Übergabe nennt untersuchte und ausgelassene Bereiche, priorisierte Befunde mit Pfad/Zeile, Auswirkungen, Unsicherheiten, kleinste mögliche Maßnahmen und spätere Prüfempfehlungen. Querverweise statt doppelter Befunde; keine künstliche Befundquote.

Ein unabhängiger Review erhält ausdrücklich einen Auftrag ohne Quelländerungen und ebenfalls einen eigenen Worktree auf dem zu prüfenden Commit.

## Modelle und Thinking

Maßgeblich für die Startwerte ist [`.pi/settings.json`](../.pi/settings.json): Pi-eigene `defaultProvider`, `defaultModel` und `defaultThinkingLevel` betreffen den Hauptagenten; `subagents.defaultModel`, `defaultThinking` und `agentOverrides` betreffen die Kinder. Die getrennte Vorgabe verhindert, dass normale Subagents unabsichtlich das teurere Hauptmodell übernehmen. Die Datei setzt für neue Hauptsessions Sol/medium; Sol oder Astra mit medium/high lassen sich bei Bedarf über `/model` und `/thinking` wählen. Bereits laufende oder fortgesetzte Sessions und explizite CLI-Vorgaben können davon abweichen.

Für eigene Profile gelten Sol/low als allgemeiner Startwert, Terra/low für einfache lokale Erkundung oder mechanische Änderungen und Sol/medium für Reviews mit mehr Abwägung. Auch Dokumentation und Tests können anspruchsvoll sein: fachliche Unsicherheit, gemeinsame Verträge und kreative Entscheidungen sind wichtiger als Dateiendung oder Textmenge. Abweichende Rollenwerte werden in den eigenen Profilen oder gezielten `agentOverrides` konfiguriert, nicht durch Reaktivieren der Standardagenten.

Bei einfachen mechanischen Änderungen kann der Hauptagent auch ein schreibendes Profil ausdrücklich auf Terra setzen. Schwierige Implementierungen oder Reviews erhalten Sol/medium bzw. high. Astra/medium oder high wird ausschließlich für sehr komplexe Aufgaben oder kreative Denkarbeit gezielt gewählt, mit begründetem Ziel und begrenztem Ergebnis im Auftrag; kein pauschaler Astra-Fanout und keine automatische Eskalation bei Fehlern oder langen Laufzeiten. Modellwechsel eines Kindes nicht über dessen `resume` versuchen: Fortsetzungen behalten den gespeicherten Modellvertrag. Erst Zustand/Übergabe sichern, dann gegebenenfalls einen neuen Auftrag mit begründeter Modellwahl starten.

Vor einer Welle `/subagents-models` bzw. `subagent({ action: "models" })` prüfen. Für Ausnahmen im jeweiligen `runs.run`-/`runs.all`-Eintrag ein **providerqualifiziertes Modell mit Thinking-Suffix** angeben, etwa `model: "openai-codex/gpt-5.6-sol:medium"` oder `model: "openai-codex/gpt-6-astra:high"`. Ein separates `thinking`-Feld ist kein unterstützter Dispatch-Parameter. Kein Modell am gesamten Workflow setzen, wenn die Kinder unterschiedliche Rollenstandards nutzen sollen. Die effektive Auswahl nach dem Start anhand der Laufzeitangaben kontrollieren, nicht nur anhand der angeforderten Werte.

`defaultThinking` ersetzt kein explizites Thinking eines Profils. Eigene Profile können Defaults überschreiben und sind vor dem Start zu prüfen; gezielte `agentOverrides` haben Vorrang vor Profilwerten. `modelScope` begrenzt native Kinder strikt auf die drei vorgesehenen Modelle; `maxThinking` weist Werte oberhalb high zurück. Die Einschätzung „sehr komplex oder kreativ“ ist eine Orchestrierungsregel, keine automatische Budgetkontrolle: Astra ist technisch erlaubt, wird aber nicht als Rollenstandard gesetzt. Externe CLI-Runner unterliegen diesen nativen Modell-/Thinking-Grenzen nicht und sind kein Ausweichweg.

Nach Konfigurationsänderungen `/reload` und `/subagents-models` verwenden; für einen Hauptsession-Startwert eine neue Sitzung bzw. explizite Modellwahl nutzen. Änderungen bleiben projektlokal, globale Einstellungen unangetastet. Modellkatalog und erfolgreiche Auflösung beweisen noch keinen erfolgreichen Provideraufruf; dieser Nachweis gehört in den realen Worktree-Testlauf.

## Arbeitspakete und Worktree-Lebenszyklus

Vor einer Welle hält der Hauptagent im betroffenen Issue knapp fest: Ziel/Nicht-Ziele, erlaubte Dateien oder Verträge, Abhängigkeiten, Abnahmekriterien und Zuständigkeit. Bei aktiver Delegation kommen Branch, Ausgangscommit, absoluter Worktree-Pfad und Run-ID hinzu, soweit für Wiederaufnahme nötig. Fachliche Abhängigkeiten entscheiden über Parallelität: Tests und Dokumentation zu einer noch offenen Verhaltensänderung brauchen zuerst einen vereinbarten Vertrag oder den fertigen Implementierungsstand.

Wir verwenden **vom Hauptagenten angelegte und bis zur Integration erhaltene Git-Worktrees**. Die Extension bietet zwar `worktree: true`, kann dabei aber nach Patch-/Manifest-Erfassung ihre temporären Worktrees und Branches automatisch entfernen. Dieser Lebenszyklus passt nicht zu unserer Branch-basierten Integration.

1. Hauptcheckout und Ausgangsstand prüfen. Fremde Änderungen weder mitnehmen noch automatisch committen/stashen. Für die Welle einen geprüften Commit festhalten.
2. Pro Aufgabe einen eindeutigen Branch, etwa `aom/<auftrag>-<teilaufgabe>`, und einen Worktree außerhalb des Hauptcheckouts und außerhalb der Pi-Extension-Suchpfade anlegen. Beispiel: `git worktree add -b <branch> <absoluter-pfad> <ausgangscommit>`. Pfade und Namen vorher auf bestehende Belegung prüfen.
3. Projektkontext, benötigte Pi-Ressourcen und Abhängigkeiten im neuen Worktree bereitstellen. Ignorierte Dateien werden von Git **nicht** mitgenommen. Bei Build-/Testbedarf `npm ci` im jeweiligen Worktree ausführen; `node_modules/` und `dist/` nicht aus einem anderen Worktree verlinken. Keine globale Pi-Konfiguration nebenbei ändern.
4. Den Subagenten über das native `subagent`-Tool mit dem **absoluten Worktree-Pfad als `cwd` und explizitem `worktree: false`** starten. Das deaktiviert nur die zusätzliche automatische Worktree-Erzeugung der Extension; der Prozess arbeitet bereits im zuvor isolierten Worktree. Niemals den Hauptcheckout als Subagent-`cwd` einsetzen.
5. Der Subagent prüft Identität und Arbeitsbaum (bei Audit-Profilen anhand des übergebenen Git-Nachweises), liest die lokalen Regeln und arbeitet im erlaubten Umfang. Schreibende Aufträge committen geprüfte Änderungen. Ein reiner Analyseauftrag erzeugt weder Änderungen noch einen leeren Commit.
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

Den kombinierten Stand gemäß [Prüfverfahren](testing.md) testen; Einzelprüfungen freigegebener Umsetzungsaufträge reichen dafür nicht aus. Die volle Testsuite führt nur der Hauptagent ganz zum Schluss aus, nie ein Audit-Subagent. Erst danach Issues aktualisieren bzw. erledigte Issue-Dateien löschen. Worktrees nur nach beendeten Runs/Hilfsprozessen, gesicherter Übergabe und nicht mehr benötigter Nachprüfung entfernen. Vorher auch ignorierte Dateien prüfen (`git status --short --ignored`), nötige Belege sichern und nur eigene entbehrliche Dateien löschen. Reguläres `git worktree remove <pfad>` und nach nachgewiesenem Merge `git branch -d <branch>` bevorzugen; kein pauschales `--force`, `git clean -fdx` oder Löschen fremder Worktrees. Bei unklarer Integration oder Verwerfung Worktree und Branch erhalten und die nächste Entscheidung im Issue festhalten.
