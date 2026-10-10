# Repository-Hygiene und Entwicklungswerkzeuge

Hygieneaudit auf `8a69e7f`: strikter TypeScript-Build erfolgreich; zwei gezielte Controls-Fälle und die Testauswahlprüfungen bestanden. Kein Vollsuite-, AI-/Simulations-, Browser- oder Deploymentnachweis. Diese Liste ist Planung, kein automatischer Umbauauftrag.

Fachliche Testaltlasten und wiederverwendbare `.tmp/`-Prüfroutinen stehen unter [Testpflege](teststrategie-review.md); Capture-/Assetwerkzeuge unter [Releasepflege](release-tooling.md). Kein zusätzliches Worklog oder doppelte Fehlerliste.

## Reproduzierbarkeit und kurze Rückkopplung

- [ ] Unterstützte Node-Version deklarieren, etwa über `package.json` und eine passende lokale Versionsdatei. Skripte verwenden moderne APIs wie `import.meta.dirname`; Docker baut mit Node 22, im Audit lief Node 23.11.1. Mindestversion und regulär unterstützte Version unterscheiden; vorhandenes Lockfile und gepinnte Abhängigkeiten erhalten.
- [ ] Minimale versionierte CI erwägen: Installation aus Lockfile, Build, ausdrücklich gewählte kurze Verträge und lokale Dokumentationslinks. Im Checkout liegt keine CI-Konfiguration; das beweist nicht das Fehlen externer Prüfungen. Keine automatische Aufnahme freigabepflichtiger AI-/Simulationsblöcke oder mehrminütiger Vollsuiten.
- [ ] Kleine automatisierte Prüfung lokaler Markdown-Dateiziele etablieren, falls sich tote Links wiederholen; Fragmente gesondert behandeln. Der Audit fand fehlende Musikherstellungs- und itch-Beschreibungsziele. Keine Netzanfragen oder neue umfangreiche Toolchain nur für Linkprüfung.

## Lesbarkeit und Besitz

- [ ] Verbindliche, schlanke Format-/Lintkonventionen abwägen. Es gibt keine konfigurierte Format-/Lintprüfung; stellenweise komprimierter Code und große gemischte Testdateien erschweren Reviews. Einführung und mechanische Formatierung getrennt von Verhaltensänderungen halten; Dateilänge allein rechtfertigt keinen Architekturumbau.
- [ ] Rechtslage für öffentliche Weiterverwendung ausdrücklich klären: keine projektweite Lizenzdatei im Checkout gefunden. Das ist für ein privates Projekt kein festgestellter Defekt; vorhandene Asset-/Schriftlizenzen und offene [Westmark-Quellenfreigabe](westmark-map.md) bleiben eigenständig. Keine Lizenz ohne Entscheidung des Rechteinhabers ergänzen.
- [ ] Generierte Ausgaben und Scratch-Besitz konsistent regeln. `.tmp/`, `dist/` und `node_modules/` sind bereits ignoriert; konkrete Capture-Ausgabe unter [Releasepflege](release-tooling.md). Browserprofile, Logs, persönliche Saves und Integrations-Backups nicht übernehmen. Sicherungspatches nicht pauschal löschen; sie können fremde Änderungen sichern.

Die klassischen globalen Skripte, feste Ladereihenfolge und Prototyp-Erweiterungen sind bewusst dokumentierte [Architekturverträge](../architecture.md#auslieferung), keine allein durch Abweichung vom Modulstandard belegten Fehler. Strikte Typprüfung, isolierte Testkontexte und geschützte RNG-Einstiege erhalten.
