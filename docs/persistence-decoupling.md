# Erste Entkopplung: Speicherung und UI

## Referenztests vor dem Umbau

Ausgangspunkt ist `b09717e`. Zunächst nur 13 Tests in `tests/ashes-of-meridian-persistence.check.cjs` ergänzt, noch ohne Änderung der Spielquellen. Über den vorhandenen Loader werden bisherige Profilfunktionen und ausgewählte UI-Methoden in einer VM ausgeführt. Keine echte UI-Konstruktion, kein DOM, Audio, Renderer oder laufende Simulation: Diese äußeren Schnittstellen sind gezielte Testdoubles mit Aufrufprotokoll.

Abgesichert sind:

- Vollständige, unabhängige Standardprofile; bestehende Normalisierung mit Coercions, Grenzen, Nachkommastellen und unbekannten Feldern.
- Ungültiges JSON/Versionen sowie bisherige Teilnormalisierung bei einem Fehler mitten im Profil.
- Exakte Storage-Schlüssel und JSON-Texte, Save-Bedingungen, Snapshot-Aufruf, Rückgabewert, Meldungen und Zeitstempel.
- Fehlender, fehlerhafter und JSON-`null`-Checkpoint; Restore-Fehler und UI-Nachbereitung.
- Verweigerter Storage-Zugriff einschließlich werfendem `localStorage`-Getter, flüchtiger Ersatz und unabhängige Instanzen. Bei erfolgreichem Lesen wird weiterhin der Browserwert bevorzugt, auch nach einem fehlgeschlagenen Schreibversuch.
- Backup-Export bevorzugt den aktiven Snapshot; andernfalls vorhandenen Checkpoint, bei fehlerhaftem gespeicherten JSON `null`.
- Importgrößenlimit 4.000.000 Bytes, Format-/Versionsprüfung, Entitätsarray bis einschließlich 1.500 Einträge; ungültige Eingaben schreiben nichts.
- Import behält die Profilobjekt-Identität bei. Zunächst wird das rohe Profil gespeichert, anschließend erneut gelesen und normalisiert; Audio und Renderer werden vor einem enthaltenen Checkpoint aktualisiert. Profile-only-Backups und falsy Operationswerte lassen den alten Checkpoint stehen.
- Bestehendes **nicht transaktionales** Verhalten bei Storage-/Renderer-Fehlern, einschließlich möglicher Teiländerungen und Erfolgsmeldung trotz verweigerter dauerhafter Speicherung. Dies wird im Strukturumbau nicht beiläufig korrigiert.

Vollständiger [Testbefehl](testing.md#automatisierte-tests): **72 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux. Bisherige Layout-Prüfsummen und Save-Fixture unverändert.

Ein frischer Ausgangslauf der temporären erweiterten Chromium-Probe (`/tmp/meridian-split-browser.cjs`, Phase `persistence-before`) über `file://` bestand: acht Layout-Messsätze, Shader-/Textur-/Qualitätsprüfungen, Spiel-/Save-/Reload-/Backup-Ablauf, zusätzliche Eingabe- und Audio-API-Probe wie in der [Auslagerungsserie](script-extraction.md#frische-chromium-prüfungen-über-file). Chromium `152.0.7977.75`, frisches temporäres Profil, ohne abgeschwächte Sicherheitsflags. Drei bekannte Skybox-Ausnahmen, eine je Seitenladung. Kein Hörtest, HTTP-Nachweis oder vollständiger E2E-Test.

## Umgesetzte Schnittstelle

Nach dem separaten Testcommit `1efcc2b` wurde `persistence.js` ergänzt. Das klassische Skript lädt nach `audio` und vor `ui`; die bisherige relative Reihenfolge bleibt erhalten. Kein Modul-Import, Build oder erforderlicher Server.

`createMeridianPersistence({ getStorage, clamp, upgrades, difficulties, warn })` erzeugt eine unabhängige Instanz. `getStorage()` liefert ein Objekt mit `getItem`, `setItem`, `removeItem` und wird erst beim Zugriff aufgerufen, damit auch ein verweigerter Browser-Getter abgefangen wird. `upgrades` liefert pro Schlüssel `.max`; `difficulties` die bisherige Gültigkeitsabfrage. `warn` erhält Präfix und Fehlermeldung. Keine impliziten Zugriffe auf `META`, `DIFFICULTY`, `localStorage`, DOM, Renderer oder Spielzustand.

`app.js` übergibt die vorhandenen Regeln und `() => localStorage`, lädt das Profil über die Instanz und reicht diese als fünftes Argument an `MeridianUI(game, renderer, audio, profile, persistence)` weiter. Kein stiller globaler Standarddienst. Die bisherigen globalen Speicherhelfer und Schlüssel sind nun innerhalb der Factory privat; `window.Meridian` bleibt verfügbar, der laufende Dienst ist über `Meridian.ui.persistence` erreichbar.

| API | Vertrag |
| --- | --- |
| `loadProfile()` | Neues Profilobjekt mit bisheriger Normalisierung/Fehlerbehandlung; schreibt nichts |
| `saveProfile(profile)` | Speichert unverändertes Profil-JSON; Boolean zeigt Erfolg der dauerhaften Speicherung an |
| `hasCheckpoint()` | Bisherige Truthiness des gespeicherten Texts, noch keine Formatvalidierung |
| `readCheckpoint()` | Ein Storage-Lesezugriff; `{ exists, state }`, wirft bei ungültigem JSON. Gespeichertes JSON-`null` ist vorhanden und wird weiterhin an `game.restore(null)` übergeben |
| `saveCheckpoint(state)` | Serialisiert den vom Aufrufer gelieferten Snapshot; Boolean wie `saveProfile` |
| `removeCheckpoint()` | Entfernt nativen und flüchtigen Eintrag mit bisheriger Ausnahmebehandlung |
| `serializeBackup(profile, operation)` | Liefert Backup-JSON, bei falsy Operation mit bisherigem Fallback auf den gespeicherten Checkpoint |
| `parseBackup(text)` | Bisherige JSON-/Format-/Versions-/Entitätszahlprüfung; keine Schreibzugriffe, keine zusätzliche Schema-Strenge |
| `available` | Lesbarer bisheriger Status: nach Lese-/Schreibfehler dauerhaft `false`; ein reiner Löschfehler ändert ihn weiterhin nicht |

Die UI kennt weder Storage-Schlüssel noch Profilnormalisierung oder Backup-Codec. Bei ihr bleiben Snapshot-/Restore-Aufrufe, Fortschrittsregeln, DOM, Dateigrößenlimit, Lesen einer `File`, Blob-Download, Meldungen sowie die Reihenfolge der Profil-/Audio-/Renderer-/Checkpoint-Übernahme. Die Speicherkomponente löst keine UI- oder Spielaktionen aus. Die nicht atomare Übernahme wird bewusst nicht zu einem vermeintlich besseren Import zusammengezogen.

## Prüfungen nach der Entkopplung

- Die 13 bestehenden Charakterisierungen behalten ihre Erwartungen; nur die gemeinsame Verdrahtung des Testaufbaus wurde angepasst. Vier zusätzliche Tests prüfen isolierte Ausführung mit eigenen Regeln, privaten und verzögert verwendeten Abhängigkeiten, Checkpoint-Löschfehler/Status, Backup-Codec sowie UI-Konstruktor und Speicherbefehle mit Fake-Dienst ohne Storage- oder Codec-Globals. Bei der UI sind Binding-/DOM-Methoden gezielt ersetzt, nicht alle UI-Methoden browserfrei.
- Vollständiger Befehl: **76 bestanden, 0 fehlgeschlagen**. Bisherige Tests, Layout-Erwartungen und Save-Fixture unverändert. Core, Renderer, Content, World, Simulation, Audio, CSS und alle vier Assets bytegleich zu `b09717e` geprüft.
- Vier temporäre, nur beim VM-Laden eingesetzte Mutationen wurden erkannt: fehlende In-Memory-Schreibkopie, falsche Credit-Obergrenze, versteckter globaler `META`-Zugriff und Checkpoint-Schreiben vor Renderer-Aktualisierung. Kein mutierter Spielcode auf Platte und keine Mutationen eingecheckt.
- Frischer `file://`-Nachher-Lauf (`/tmp/meridian-persistence-browser.cjs`, Phase `persistence-after`): alle neun lokalen Skripte erfolgreich geladen, erwartete Reihenfolge, erweiterte Spiel-/Storage-/Eingabe-/Audio-API-Probe bestanden. Acht Layout-Messsätze, GPU-/Textur-Resultate und Qualitätswerte ohne variable Frame-Nummern stimmen mit dem frischen Ausgangslauf überein. Erneut genau drei bekannte Skybox-Ausnahmen; keine neuen erfassten Fehler. Menü bei 1280×800 und HUD bei 800×700 zusätzlich als Screenshots gesichtet, kein Pixelvergleich animierter Szenen.
- Zusätzliche Chromium-`file://`-Probe mit **testseitig werfendem `window.localStorage`-Getter** (`/tmp/meridian-persistence-denied.cjs`): Start funktioniert, Speichern meldet fehlenden dauerhaften Speicher, Laden stellt einen zuvor absichtlich veränderten Alloy-Wert aus der flüchtigen Kopie wieder her. API-Aufruf von `importBackup(new File(...))` übernimmt Profil/Checkpoint; ein vollständiger Reload verliert anschließend erwartungsgemäß alle flüchtigen Daten. Kein nativer Importdialog in dieser Zusatzprobe. Nach Anpassung der Probe an CDPs hier ausschließlich als `exceptionDetails.text` gelieferte Fehlermeldung bestanden; zwei bekannte Skybox-Ausnahmen bei zwei Seitenladungen, keine neue Spielausnahme.
- Dokumentationslinks/Anker und `git diff --check` geprüft. Browserprofile und heruntergeladene Backups der Probe wieder entfernt; keine echten Nutzerstände verwendet. Temporäre Browserinstrumentierung ist keine neue Projektabhängigkeit oder eingecheckte E2E-Suite.

Weiterhin offen: HTTP, andere Browser, hörbare Audioausgabe, natürliche Browser-Storage-Verweigerung/Quota-Szenarien, native Dialoge, vollständige Kampagnen-/Bedien-/Performanceprüfung und breite Save-Kompatibilität. Keine exakte deterministische Fortsetzung nach Laden zugesichert. Skybox, RNG, Balancing und Assets blieben unangetastet.

## Noch nicht entkoppelt

Weltberechnung und Renderdaten, Simulation und kosmetische RNG-Verwendung sowie die übrigen UI-Abläufe bleiben gekoppelt. Auch die Speicherkomponente verwendet absichtlich noch die bisherigen teils schwachen Validierungen. Strengere Schemas oder transaktionaler Import wären eigene Verhaltensänderungen mit zusätzlicher Kompatibilitätsplanung, nicht Teil dieses Schritts.
