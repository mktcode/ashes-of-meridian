# Repository-Hygiene und Entwicklungswerkzeuge

Hygieneaudit auf `8a69e7f`: strikter TypeScript-Build erfolgreich; zwei gezielte Controls-Fälle und die Testauswahlprüfungen bestanden. Kein Vollsuite-, AI-/Simulations-, Browser- oder Deploymentnachweis. Diese Liste ist Planung, kein automatischer Umbauauftrag.

Fachliche Testaltlasten und wiederverwendbare `.tmp/`-Prüfroutinen stehen unter [Testpflege](teststrategie-review.md); Capture-/Assetwerkzeuge unter [Releasepflege](release-tooling.md). Kein zusätzliches Worklog oder doppelte Fehlerliste.

## Lesbarkeit und Besitz

- [ ] Verbindliche, schlanke Format-/Lintkonventionen abwägen. Es gibt keine konfigurierte Format-/Lintprüfung; stellenweise komprimierter Code und große gemischte Testdateien erschweren Reviews. Einführung und mechanische Formatierung getrennt von Verhaltensänderungen halten; Dateilänge allein rechtfertigt keinen Architekturumbau.
- [ ] Generierte Ausgaben und Scratch-Besitz konsistent regeln. `.tmp/`, `dist/` und `node_modules/` sind bereits ignoriert; für Capture-Ausgaben gilt der [Auslieferungsvertrag](../deployment.md#itchio). Browserprofile, Logs, persönliche Saves und Integrations-Backups nicht übernehmen. Sicherungspatches nicht pauschal löschen; sie können fremde Änderungen sichern.

Die klassischen globalen Skripte, feste Ladereihenfolge und Prototyp-Erweiterungen sind bewusst dokumentierte [Architekturverträge](../architecture.md#auslieferung), keine allein durch Abweichung vom Modulstandard belegten Fehler. Strikte Typprüfung, isolierte Testkontexte und geschützte RNG-Einstiege erhalten.
