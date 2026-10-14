# Arbeitsregeln

## Worktrees und Integration

- Standard ist ein eigener Aufgaben-Worktree mit eigenem Branch vom aktuellen lokalen
  `main`, auch für Analyse, Dokumentation, Kleinständerungen und Folgeaufträge.
  Fehlt er, selbst anlegen. Fremde/aktive Worktrees nicht übernehmen.
- Vor Arbeit absoluten Pfad, Branch und `git status --short` prüfen; fremde Änderungen erhalten.
  Direkt in `main/` nur auf ausdrückliche Nutzeranweisung für den aktuellen Auftrag.
  Aktueller Ordner, frühere Integration oder „kümmere dich darum“ ist keine Ausnahme.
- Geprüfte eigene Änderungen committen, nicht automatisch integrieren/pushen/deployen.
  Ein Implementierungs-/Abschlussauftrag ist keine Integrationsfreigabe.
- Bei „nach main integrieren“ zuerst im Aufgaben-Worktree `git merge main`, Konflikte dort
  lösen und gezielt prüfen. Danach im bestehenden Schwester-Worktree `main/` auf Branch
  `main` den Aufgabenbranch integrieren und relevant prüfen. Ändert sich `main`, Vorbereitung
  wiederholen. Aufgaben-Worktree bleibt auf seinem Branch, kein Ersatz-Zielworktree.
- Vor Zielmerge Pfad, Branch und Status erneut prüfen. Bei blockierenden fremden Änderungen
  oder falschem Zielbranch stoppen/rückfragen; nichts überschreiben, mitcommitten oder stashen.
  Kein automatischer Push und keine automatische Worktree-/Branchlöschung.
- Abschluss einer Integration nennt Kurz-IDs und kompakte Änderungen aller neu enthaltenen
  inhaltlichen Feature-Commits, keine bereits enthaltenen oder rein technischen Merge-Commits.

## Einstieg und Änderungen

[README](README.md) lesen, betroffenes [Issue](docs/issues/) sowie Quellen/Tests erkunden.
Vor strukturellen Änderungen [Systemgrenzen](docs/architecture.md) lesen.

- Kleinster sinnvoller Umfang; Formatierung, Struktur und Verhalten trennen.
  Kein beiläufiges Balancing, Darstellungs-/Regelkorrekturen oder Backlogabarbeiten.
  Issues sind keine Implementierungsfreigabe.
- Hindernisverteilung, Körperradien und RNG-Reihenfolge schützen; auch Kosmetik kann
  Simulations-RNG ziehen. [Referenzen](docs/reference-tests.md) nicht zum Grünmachen regenerieren.
- Prototyp: keine Migrationen, Rückwärtskompatibilität oder Legacy-Adapter ohne Auftrag.
- Quellen statt `dist/` bearbeiten. [Asset-/Modellpflege](docs/assets.md) beachten;
  Rasterassets nur WebP/Qualität 80, keine unbeauftragte Löschung/Ersetzung.
- Direkte `file://`-Auslieferung ohne Server, CDN, Laufzeit-Imports oder gelockerte Sicherheit erhalten.

## Prüfungen

- Kurze gezielte Rückkopplung: Dokumentation mit Diff/Links/Angaben, mechanische
  Quelländerung mit Build/Diff, lokale Logik mit Build/betroffenen Fällen.
  [Befehle und Aussagegrenzen](docs/testing.md).
- Mehrminütige oder zeitlich unbekannte breite Läufe nur mit aktueller ausdrücklicher
  Freigabe und konkretem Erkenntnisziel. Gemeinsame Verträge sind kein Vollsuiteauftrag.
  Breite Integrationstests nur einmal am integrierten Stand durch den Hauptagenten;
  Wiederholung braucht neues relevantes Risiko.
- `test:ai`/`test:simulation` immer nur durch den Hauptagenten auf ausdrücklichen aktuellen
  Auftrag, auch direkte/gefilterte Fälle. Implementierung/Abschluss ist keine Freigabe.
  Bedarf vorschlagen, sonst als nicht ausgeführt nennen.
- Browserchecks nur für konkrete technische Fragen, keine Screenshotserien auf Vorrat.
  `simulate:visible` nie automatisch starten. Visuelle/akustische und Echtgeräteabnahme
  bleibt menschlich; tatsächliche Prüfungen und relevante Grenzen im Abschluss nennen.

## Performance

*Was würde John Carmack tun?* Suchräume und globale Invalidierung reduzieren,
unveränderte Arbeit vermeiden, Gelände/Kollision/Modellaufbau anhand konkreter Messungen
untersuchen. Kreative Caches, LOD, Pooling oder asynchrone Verfahren sind Kandidaten,
kein vorsorglicher Engineumbau. [Diagnosewerkzeuge](docs/scene-capture.md) und
[offene Messfragen](docs/issues/performance-und-mobilstabilitaet.md) nutzen;
Software-WebGL ist kein Geräteperformancebeleg. Prüfregeln gelten unverändert.

## Delegation

- Innerhalb freigegebener Arbeit erlaubt; Hauptagent orchestriert, beantwortet Rückfragen,
  pflegt Issues und integriert. Maximal drei Kinder gleichzeitig, keine Weiterdelegation.
- Jedes Kind erhält eigenen vom Hauptagenten angelegten Worktree/Branch, auch bei Analyse.
  Vor Start Pfad, Branch, Ausgangscommit und Status prüfen; Abweichung → stoppen/rückfragen.
  Audit ohne Shell erhält diesen Git-Nachweis vom Hauptagenten.
- Lokale AGENTS-Version und `inheritProjectContext: true` sicherstellen; Regeln während
  einer Welle nicht nebenbei ändern. Effektive Rollen/Profile/Overrides vor Start prüfen.
  Projektprofile und Defaults stehen in `.pi/agents/` und `.pi/settings.json`;
  Luna/low für kleine klare Aufgaben, Sol/medium oder high für Abwägung/Reviews.
  Ausnahmen begründen; bei Modell-/Providerfehlern kein Ersatz-CLI oder Scope-Ausweichen.
- Auftrag nennt Ziel/Nicht-Ziele, Pfad/Branch/Commit, Schreibgrenzen, Verträge, Abhängigkeiten,
  Prüfung und Übergabe. Überschneidungen vorher klären, Erweiterungen an Hauptagenten melden.
- Erste Auditphase nur lesend: keine Änderungen/Scratch-Dateien, Befehle, Installationen,
  Builds, Tests, Benchmarks oder Browserläufe durch Audit-Kinder. Ausführungsbedarf vorschlagen.
  Auditprofile bleiben lesend; Umsetzung braucht neuen freigegebenen Schreibauftrag.
- Kind mit eigenem `cwd` und `worktree: false` starten; ein Fork ersetzt keine Isolation.
  Abhängige Pakete erst nach vereinbartem Vertrag/Ergebnis; aktive Kinder-Worktrees nicht bearbeiten.
- Rückfragen über nativen Supervisor, mit konkreter `replyTo`-ID beantworten. Asynchrone
  koordinierte Wellen mit WorkflowScript, unabhängige Runs über `runs.all`; Syntax vorher
  gegen installierte Hilfe prüfen. Keine Polling-/Sleep-Schleifen oder paralleles Intercom/Worklog.
- Kinder committen nur geprüfte eigene Änderungen; keine fremden Worktrees, Merges/Rebases,
  Pushes, gemeinsame Git-Konfiguration oder Löschungen. Issues und Arbeitsregeln nur Hauptagent.
  Übergabe: Branch/Commit, Dateien, Prüfungen/Resultat, Risiken/Entscheidungen.
- Fehlerzustand/Run-ID erhalten, nicht still Ausführungsmodus wechseln. Hauptagent prüft Diff
  seit Ausgangscommit und Status, integriert/prüft nach Risiko, nicht automatisch per Vollsuite.
  Bereinigung erst nach gesicherter Übergabe/Integration oder Verwerfung und beendeten Prozessen:
  ignorierte Belege prüfen/sichern, reguläres `git worktree remove` und bei nachgewiesenem Merge
  `git branch -d`. Kein Force/Clean oder Löschen fremder Arbeit; bei Unklarheit erhalten.

## Temporäre Isolation

Eigene Skripte, Downloads, Profile, Bilder und Logs nur unter `<worktree>/.tmp/<lauf>/`.
Keine gemeinsam benannten `/tmp/`-Pfade oder schreibend geteilten `node_modules/`, `dist/`, `.tmp/`
und keine Symlinks zwischen Worktrees. `TMPDIR`, `TMP`, `TEMP`, steuerbare Runtime-Ausgabewege
und Profile in jedem Toolaufruf explizit worktree-lokal setzen; Shell-Exports gelten nicht dauerhaft.
Nur eigene Dateien nach Prozessende bereinigen, persönliche Saves/Backups erhalten.
Pi-eigene Sessions/IPC/Toolausgaben nicht global umbiegen/löschen; `.tmp/` ist keine Sandbox.
Fest kodierte externe Toolpfade vor Parallelbetrieb klären; dauerhafte Befunde vor Bereinigung sichern.

## Dokumentation

Code erklärt das Was, knappe Kommentare nur nötiges Warum. Markdown nur für Einstieg,
übergreifende Entscheidungen, externe Verfahren, Gestaltungsziele und offene Arbeit.
Keine Codekarten, Wertetabellen, parallelen Sollregeln oder Test-/Änderungschroniken.
Ein maßgeblicher Ort je Information: README Einstieg, AGENTS Regeln, `docs/issues/` offene
Befunde mit relevantem Prüfkontext, Git abgeschlossene Historie. Kein zusätzliches Worklog.
Redundanzen/Altlasten bei Pflege entfernen, erledigte Issues löschen; offene menschliche
Abnahme nicht aufgrund technischer Tests schließen.
