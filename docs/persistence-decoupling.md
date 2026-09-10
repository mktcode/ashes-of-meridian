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

## Geplanter nächster Schritt

Eine eigenständig ladbare Speicherkomponente erhält Storage-Zugriff und Profilregeln als ausdrückliche Abhängigkeiten. `app.js` verdrahtet diese Instanz mit der UI. JSON, Schlüssel und Profilverarbeitung gehören dann der Speicherkomponente; DOM, Dateien/Downloads, Meldungen und Anwendungsübergänge bleiben in der UI. Die bisherige Reihenfolge und Fehlerbehandlung, insbesondere der nicht atomare Import, bleiben erhalten. Keine neue Schema-Strenge und keine Save-Migration im Refactoring.
