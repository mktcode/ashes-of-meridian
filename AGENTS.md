# Einstieg für KI-Agenten

## Orientierung

1. [README.md](README.md) für Start und Projektüberblick lesen, `git status --short` prüfen.
2. Betroffenes [Issue](docs/issues/), Quellen und Tests erkunden; `rg`/`find` statt einer gepflegten Codekarte nutzen.
3. Fachreferenzen nur nach Bedarf lesen: [Spielregeln](docs/gameplay.md), [Architektur](docs/architecture.md), [Grafik/Assets](docs/rendering.md), [Prüfverfahren](docs/testing.md). Vor strukturellen Änderungen Architektur lesen.

## Leitplanken

- Kleinste sinnvolle Änderung; Formatierung, strukturelles Refactoring und Verhaltensänderungen getrennt halten. Keine beiläufigen Änderungen an Balancing, Darstellung oder Regeln; bekannte Probleme nicht stillschweigend korrigieren.
- Breites Refactoring und weitere TypeScript-Migration bleiben ohne neuen Auftrag pausiert. Issues und Prüfprioritäten sind keine automatische Implementierungsfreigabe.
- Seedbasierte Hindernisverteilung, Kollisionsradien und RNG-Aufrufreihenfolge schützen. Auch kosmetische Effekte nutzen teilweise den Simulations-RNG. [Referenzwerte](docs/reference-tests.md) nicht zur Reparatur fehlgeschlagener Tests neu erzeugen.
- Entwicklungsprototyp: keine Rückwärtskompatibilität, Migrationen oder Legacy-Adapter ohne ausdrücklichen Auftrag.
- Quellen statt Build-Ausgaben bearbeiten; `dist/` nie direkt bearbeiten oder einchecken. Die generierte `src/renderer/assets.js` ausschließlich mit `npm run embed:textures` aus den Texturquellen aktualisieren.
- Bildassets ausschließlich als WebP mit Qualität 80 pflegen, keine PNGs einchecken. Assets nicht wegen vermeintlicher Redundanz löschen oder austauschen; [Pflegeverfahren](docs/rendering.md) beachten.
- Direkte `file://`-Auslieferung erhalten: kein erforderlicher Server, CDN, Laufzeit-Import oder abgeschwächte Browser-Sicherheitsflags.
- Zusammenhängende, geprüfte Änderungen eigenständig committen. Fremde oder unzusammenhängende vorhandene Änderungen nicht aufnehmen.

## Parallele Arbeit und Subagents

- Der Hauptagent orchestriert freigegebene Arbeitspakete, beantwortet Rückfragen, pflegt Issues und integriert Änderungen. Delegation ist innerhalb des erteilten Auftrags erlaubt, keine Freigabe zum selbstständigen Abarbeiten des Backlogs. Zunächst höchstens drei Subagents gleichzeitig; keine weitere Delegation durch Subagents.
- Jeder Subagent arbeitet in einem eigenen, vom Hauptagenten angelegten Git-Worktree mit eigenem Branch, auch bei Analyse-, Dokumentations- oder Testaufträgen. Pro Worktree nur ein aktiver Bearbeiter. Vor Arbeitsbeginn absoluten Worktree-Pfad, Branch, Ausgangscommit und `git status --short` gegen den Auftrag prüfen; bei Abweichung stoppen und rückfragen.
- Alle Subagents befolgen diese `AGENTS.md` in der Version ihres Worktrees. Der Hauptagent stellt die Projektkontext-Vererbung sicher; eigene Agentenprofile benötigen `inheritProjectContext: true`. Regeln während einer Arbeitswelle nicht nebenbei ändern.
- Modellwahl nach Aufgabenschwierigkeit, nicht nach dem gerade aktiven Hauptmodell: Terra oder Sol mit niedrigem Thinking für einfache Arbeit, Sol mit medium/high für anspruchsvolle Aufgaben; Astra mit medium/high ausschließlich für sehr komplexe Aufgaben oder kreative Denkarbeit. Der Hauptagent begründet Ausnahmen vom Rollenstandard im Auftrag und prüft vor dem Start die effektive Zuordnung. Konfiguration und Aufrufsyntax: [Modelle und Thinking](docs/subagents.md#modelle-und-thinking).
- Jeder Auftrag benennt Ziel, erlaubte Dateien/Verträge, Nicht-Ziele, Abhängigkeiten, Prüfungen und erwartete Übergabe. Überschneidungen und gemeinsame Simulations-/RNG-/Ladeverträge vorab klären; unterschiedliche Verzeichnisse allein beweisen keine Unabhängigkeit. Umfangserweiterungen und unklare Entscheidungen an den Hauptagenten melden statt raten.
- Subagents committen ausschließlich ihre geprüften Änderungen im eigenen Branch. Keine Änderungen in anderen Worktrees, keine Merges, eigenständigen Rebases, Pushes, Branch-/Worktree-Löschungen oder Änderungen gemeinsamer Git-Konfiguration. `docs/issues/` und die gemeinsamen Arbeitsregeln pflegt nur der Hauptagent; Befunde und Folgearbeiten an ihn zurückmelden.
- Rückfragen und relevante Zwischenmeldungen über den nativen Supervisor-Kanal senden; Abschluss über das normale Ergebnis. Übergabe enthält Branch/Commit, geänderte Dateien, ausgeführte Prüfungen samt Ergebnis, offene Risiken und nötige Entscheidungen. Bei Fehlern oder unklarer Prozesszuständigkeit Arbeit erhalten, keinen zweiten Bearbeiter starten oder stillschweigend den Ausführungsmodus wechseln.
- Nur der Hauptagent integriert geprüfte Ergebnisse einzeln, prüft den kombinierten Stand und schließt Issues. Worktrees erst nach gesicherter Übergabe, beendeten Prozessen und abgeschlossener Integration bzw. geklärter Verwerfung bereinigen. Einrichtung, Kommunikation und Merge-Verfahren: [Subagent-Arbeitsablauf](docs/subagents.md).

## Temporäre Arbeit

- Für Hauptagent und Subagents gilt: selbst angelegte temporäre Skripte, Downloads, Diagnosebilder, Browserprofile, Logs und sonstige Scratch-Dateien ausschließlich unter `<eigener-Worktree>/.tmp/` ablegen, nie unter gemeinsam benannten `/tmp/`-Pfaden. Pro Aufgabe/Lauf ein eigenes Unterverzeichnis verwenden. `.tmp/` ist ignoriert und wird auch nicht mit `git add -f` eingecheckt.
- Bei gestarteten Hilfsprogrammen `TMPDIR`, `TMP` und `TEMP` auf das absolute eigene Scratch-Verzeichnis setzen; explizite Ausgabe-/Profilpfade ebenfalls dorthin richten. Shell-Exports gelten nicht automatisch im nächsten Toolaufruf. Einrichtung und Grenzen für Pi-eigene Laufzeitdateien: [temporäre Isolation](docs/subagents.md#temporäre-isolation).
- Keine schreibend geteilten `.tmp/`-, `dist/`- oder `node_modules/`-Verzeichnisse/Symlinks zwischen Worktrees. Nur eigene temporäre Dateien bereinigen, nachdem die zugehörigen Prozesse beendet sind. Dauerhafte Befunde gehören über den Hauptagenten ins Issue, nicht ausschließlich in vergängliche Logs.

## Risikobasiert prüfen

- Prüfungen nach betroffenem Verhalten und Reichweite wählen, nicht pauschal nach Dateiendung. Lokale Änderungen brauchen meist Build und gezielte Tests; mechanische, verhaltensneutrale Kleinständerungen können mit Build und Diff geprüft werden.
- Gesamtsuite bei gemeinsamen Simulations-/RNG-/Ladeverträgen, breiten Eingriffen oder nicht sinnvoll eingrenzbaren Auswirkungen. Längere Simulationen gezielt für Langzeitverhalten, KI, Navigation und Ökonomie einsetzen; nicht bei jeder Kleinigkeit.
- Dokumentation mit Diff und betroffenen Links/Angaben prüfen. Browserchecks nur bei einer konkreten technischen Fragestellung; keine automatischen Screenshotserien auf Vorrat.
- Visuelle und akustische Abnahme erfolgt durch den Menschen. Technische Prüfung ist keine Darstellungs-, Hör- oder Echtgerätebestätigung. Ausgeführte Prüfungen und relevante offene Grenzen im Abschluss nennen; nötige Folgearbeiten ins Issue. Details und Befehle: [Prüfverfahren](docs/testing.md).

## Dokumentation pflegen

- Dokumentiere dauerhafte Entscheidungen, Begründungen, nicht offensichtliche Fallen und Pflegeverfahren; keine vollständigen Datei-/Methodenlisten, aus Code ablesbaren Wertetabellen oder nacherzählten Tests.
- Jede Information hat einen maßgeblichen Ort. Andere Stellen verlinken dorthin. README bleibt Einstieg, AGENTS.md Regelwerk; offene Arbeit gehört in Issues, abgeschlossene Historie nach Git. Kein zusätzliches Worklog.
- Bei Änderungen nur tatsächlich betroffene Dokumentation aktualisieren und dort veraltete Angaben, Wiederholungen und tote Links entfernen. Keine routinemäßigen Änderungsberichte oder Testzahlen an Fachreferenzen anhängen.
- Dokumentationsbereinigung ist eine regelmäßige Wartungsaufgabe: bei Wartungsrunden `docs/` auf Relevanz, Redundanzen und erledigte Issues durchsehen. Größere Bereinigungen als eigenen Auftrag bzw. eigenes Issue bündeln, nicht als Nebenarbeit jedes Codeauftrags.

## Issues

- Offene Aufgaben, Entscheidungen, Kommentare und nötige Übergaben ausschließlich in `docs/issues/` führen. Tatsächliche Befunde knapp mit Prüfkontext festhalten, nicht jeden Arbeitsschritt protokollieren.
- Auswirkungen auf andere bestehende Issues dort ergänzen. Erledigte Issue-Dateien löschen; ihre Historie bleibt in Git.
