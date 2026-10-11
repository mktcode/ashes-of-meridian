# Ashes of Meridian

Lokaler, touchorientierter RTS-Roguelite-Prototyp mit drei Fraktionen und WebGL 2: **Basis bauen → Gefecht gewinnen → Expeditionsvorteil wählen → Nachhall in Flottenupgrades investieren**. Der Core Loop ist implementiert; Bedienbarkeit, Langzeitbalance und Zielgeräteperformance bleiben offen.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) · Profile bleiben lokal im jeweiligen Browser.

## Starten

Voraussetzung: Node.js 24 (regulär unterstützt, `.nvmrc`; Mindestversion 24.0.0). Mit NVM aktiviert `nvm use` die Projektversion; CI und Docker bauen ebenfalls mit Node 24.

```bash
npm ci
npm run build
```

Danach `index.html` direkt im Browser öffnen (`file://`, kein Server nötig). HTML, Styles, Build-Ausgabe und Laufzeitassets gemeinsam mitführen. `npm run build:zip` erstellt das itch.io-Paket; [Deployment](docs/deployment.md) beschreibt die Veröffentlichung.

## Spielen

**New expedition** startet einen Run mit festem Vierer-Command-Loadout. Alle Parteien landen mit Workern und bauen ihr HQ selbst. Beim ersten Tutorial liegen Ressourcen in Sicht, später wird vor der Basiswahl erkundet. Sechs Landschaftsfamilien des gemeinsamen prozeduralen Generators stehen als seedbasierte Expeditionskarten zur Verfügung. Militärische Siege schalten unmittelbar die nächste Stage frei. Automatisch wachsende Zivilisationsgebäude bieten jeweils drei feste Zufallsangebote aus ihrem Wohn-/Forschungspool. Im Info-Modal wird ein Effekt aktiviert; lokales Echo kauft weitere Ränge im HUD und Ausbau bis zum Turm. Boni stapeln sich über die abgeschlossenen Welten des Runs, nicht über neue Expeditionen. Bereits gestartete Gefechte übernehmen neue Upgrades bei der Rückkehr aus einer Bauwelt; neue Lieferungen werden dabei nur einmal gewährt. Niederlage beendet den Run. **Continue expedition** setzt das zuletzt gespeicherte Gefecht direkt ohne Pausemenü fort. Laufende Gefechte werden automatisch gespeichert und können nicht neu gestartet werden; [Speichergrenzen](docs/gameplay.md#speichern-und-lebenszyklus). Die Checkpoint-Pfeile wählen frühere Stages samt gespeicherter Szene; **Enter world** lädt eine abgeschlossene Welt pausiert zum Weiterbauen, ohne die aktuelle Expedition zurückzusetzen oder erneut zu vergüten. Bereits ältere reine Landschaftsvorschauen besitzen keinen betretbaren Weltstand. **Codex** zeigt alle Fraktionen und Modelle unabhängig von Freischaltungen.

Ein-Finger-/Rechtsmausziehen verschiebt die Kamera, Zwei-Finger-Drehen/Mittelmausziehen dreht sie, Pinch/Mausrad zoomt; Tap/Linksklick wählt, Linksmausziehen oder Halten-und-Ziehen auf Touch wählt mehrere Einheiten. Ziel-Tap/Rechtsklick erteilt Kontextbefehle. Minimap links, Fähigkeiten mittig, Bau/Rekrutierung rechts. [Regeln und Bedienung](docs/gameplay.md).

Das Spiel ist **Singleplayer-only** und benötigt keinen Backenddienst. Eine spätere [Multiplayer-Neubewertung](docs/issues/multiplayer.md) ist zurückgestellt, bis die grundlegenden Spielmechaniken feststehen.

## Entwicklung

- [AGENTS.md](AGENTS.md): verbindliche Arbeitsregeln.
- [Architektur](docs/architecture.md): Systemgrenzen, Lade-, Zustands- und RNG-Verträge.
- [Grafik und Assets](docs/rendering.md): Erweiterung, Besitz und Pflege.
- [Audio und Sprachinhalte](docs/audio.md): Aufnahmen, Texte und Wiedergabeverträge.
- [Prüfungen](docs/testing.md): `npm run check:quality` für das kurze Qualitätsnetz, gezielte Tests, Freigaben und Diagnose.
- [Subagents](docs/subagents.md): isolierte parallele Arbeit.
- [Projektprioritäten](docs/issues/projektfahrplan.md), [Performance](docs/issues/performance/README.md) und [offene Issues](docs/issues/).
- [Geschichte](docs/story.md): deutsche interne Fassung; englische Spielfassung im Codex.

Einzelne arrangierte Grafik-/Modellszenen aufnehmen: [Szenen-Capture](docs/scene-capture.md) (`npm run capture:scene -- --scene scripts/scenes/model-lineup.json`). Begrenzte Echtzeitmessungen mit Szenenrezept und automatischem JSON-Export: [Chromium-Diagnose](docs/diagnostic-capture.md) (`npm run diagnose:scene -- --angle gl --require-hardware`).

Isolierte Kartenstarts und Diagnose: [Prüfwerkzeuge](docs/testing.md#manuelle-probeläufe). `npm run simulate:visible` öffnet eine persönliche KI-Zuschauerpartie; **kein Testbefehl, nie automatisch durch Agenten starten**.
