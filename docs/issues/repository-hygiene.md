# Repository-Hygiene und Entwicklungswerkzeuge

Hygieneaudit auf `8a69e7f`: strikter TypeScript-Build erfolgreich; zwei gezielte Controls-Fälle und die Testauswahlprüfungen bestanden. Kein Vollsuite-, AI-/Simulations-, Browser- oder Deploymentnachweis. Diese Liste ist Planung, kein automatischer Umbauauftrag.

Fachliche Testaltlasten und wiederverwendbare `.tmp/`-Prüfroutinen stehen unter [Testpflege](teststrategie-review.md); Capture-/Assetwerkzeuge unter [Releasepflege](release-tooling.md). Kein zusätzliches Worklog oder doppelte Fehlerliste.

## Lesbarkeit und Besitz

- [x] Schlanker Einstieg: EditorConfig sowie ESLint/Prettier für die explizite Werkzeug-/Fixtureliste, geprüft im kurzen Qualitätsnetz. Dokumentationschecker/Test-Runner separat mechanisch formatiert; kein Gesamtumbau. [Umfang und Befehle](../testing.md#schlanke-werkzeugkonventionen).
- [ ] Größere gemischte Testdateien und weitere Quellbereiche bei fachlicher Pflege gezielt aufnehmen; Dateilänge allein rechtfertigt keinen Architekturumbau.
- [x] `check:repository` schützt ignorierte, unversionierte und nicht als Symlink geteilte Schreibwurzeln `.tmp/`, `dist/`, `node_modules/`. Neues Browserwerkzeug besitzt und entfernt ausschließlich seinen eigenen Scratch. Audit: keine versionierten Logs/Backup-Patches; vorhandene Integrationspatches unter `.tmp/` unverändert erhalten. Für Capture-Ausgaben gilt der [Auslieferungsvertrag](../deployment.md#itchio).
- [ ] Ältere Werkzeuge bei Bedarf auf denselben expliziten Scratch-Besitz umstellen. Keine pauschale Bereinigung: Browserprofile, persönliche Saves und Integrations-Backups können fremde Änderungen sichern.

Die klassischen globalen Skripte, feste Ladereihenfolge und Prototyp-Erweiterungen sind bewusst dokumentierte [Architekturverträge](../architecture.md#auslieferung), keine allein durch Abweichung vom Modulstandard belegten Fehler. Strikte Typprüfung, isolierte Testkontexte und geschützte RNG-Einstiege erhalten.
