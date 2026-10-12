# Ashes of Meridian

Lokaler, touchorientierter RTS-Roguelite-Prototyp mit zwei Fraktionen — The Cinder Pact und The Manyroot — und WebGL 2: **Basis bauen → Gefecht gewinnen → Außenposten ausbauen und verteidigen → Einheiten und Upgrades evakuieren → weiterziehen**. Der Core Loop ist implementiert; Bedienbarkeit, Langzeitbalance und Zielgeräteperformance bleiben offen.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) · Profile bleiben lokal im jeweiligen Browser.

## Starten

Voraussetzung: Node.js 24 (regulär unterstützt, `.nvmrc`; Mindestversion 24.0.0). Mit NVM aktiviert `nvm use` die Projektversion; CI und Docker bauen ebenfalls mit Node 24.

```bash
npm ci
npm run build
```

Danach `index.html` direkt im Browser öffnen (`file://`, kein Server nötig). HTML, Styles, Build-Ausgabe und Laufzeitassets gemeinsam mitführen. `npm run build:zip` erstellt das itch.io-Paket; [Deployment](docs/deployment.md) beschreibt die Veröffentlichung.

**Karten ohne Gefecht betrachten:** `map-viewer.html` öffnen, Karte/Seed wählen und mit der normalen Spielkamera navigieren – mit erweitertem Zoom und Gesamtansicht. Kein Zugriff auf das Spielprofil. Ansicht als JSON exportieren und automatisiert aufnehmen: [Kartenbetrachter und Capture](docs/scene-capture.md).

## Spielen

**New expedition** startet einen Run mit festem Vierer-Command-Loadout. Alle Parteien landen mit Workern und bauen ihr HQ selbst. Beim ersten Tutorial liegen Ressourcen in Sicht, später wird vor der Basiswahl erkundet. Fünf Landschaftsfamilien des gemeinsamen prozeduralen Generators stehen als seedbasierte Expeditionskarten zur Verfügung. Militärische Siege schalten unmittelbar die nächste Stage frei.

Automatisch wachsende Zivilisationsgebäude bieten jeweils drei feste Zufallsangebote aus ihrem Wohn-/Forschungspool. Im Info-Modal wird ein Effekt aktiviert; lokales Echo kauft weitere Ränge im HUD und Ausbau bis zum Turm. Boni stapeln sich über die abgeschlossenen Welten des Runs, nicht über neue Expeditionen.

Außenposten werden von endlos stärker werdenden Wellen angegriffen. Am Command Center startet nach Bestätigung eine irreversible Evakuierung von 60 Sekunden **Simulationszeit**: Einheiten auswählen und per Ziel-Tap/Rechtsklick auf genau dieses HQ einschiffen, bis zu drei zivile Gebäude samt aktuellem Upgrade-Rang sichern. Danach bleibt die Stage als eingefrorene Hintergrundszene im Startbildschirm erhalten, ist aber dauerhaft nicht mehr betretbar; nur die Rettung verstärkt die höchste Gefechts-Stage, nicht gesicherte Boni und Vorräte gehen verloren. Pause hält Wellen und Countdown an; unbesuchte Welten laufen nicht weiter. **Outpost guide** im Außenposten-Pausenmenü erklärt den Ablauf erneut; [vollständige Rettungsregeln](docs/gameplay.md#außenposten-verteidigung-und-evakuierung).

Bereits gestartete Gefechte übernehmen neue Upgrades bei der Rückkehr aus einer Bauwelt; neue Lieferungen werden dabei nur einmal gewährt. Eine Gefechtsniederlage beendet den Run; der Verlust eines Außenpostens nicht. **Continue expedition** setzt das zuletzt gespeicherte Gefecht direkt ohne Pausemenü fort. Laufende Gefechte werden automatisch gespeichert und können nicht neu gestartet werden; [Speichergrenzen](docs/gameplay.md#speichern-und-lebenszyklus). Die Checkpoint-Pfeile wählen frühere Stages samt gespeicherter Szene; **Enter world** lädt eine abgeschlossene Welt pausiert zum Weiterbauen, ohne die aktuelle Expedition zurückzusetzen oder erneut zu vergüten. Bereits ältere reine Landschaftsvorschauen besitzen keinen betretbaren Weltstand. **Codex** zeigt alle Fraktionen und Modelle unabhängig von Freischaltungen.

Ein-Finger-/Rechtsmausziehen verschiebt die Kamera, Zwei-Finger-Drehen/Mittelmausziehen dreht sie, Pinch/Mausrad zoomt; Tap/Linksklick wählt, Linksmausziehen oder Halten-und-Ziehen auf Touch wählt mehrere Einheiten. Ziel-Tap/Rechtsklick erteilt Kontextbefehle. Minimap links, Fähigkeiten mittig, Bau/Rekrutierung rechts. [Regeln und Bedienung](docs/gameplay.md).

Das Spiel ist **Singleplayer-only** und benötigt keinen Backenddienst. Eine spätere [Multiplayer-Neubewertung](docs/issues/multiplayer.md) ist zurückgestellt, bis die grundlegenden Spielmechaniken feststehen.

## Entwicklung

- [AGENTS.md](AGENTS.md): verbindliche Arbeitsregeln.
- [Architektur](docs/architecture.md): Systemgrenzen, Lade-, Zustands- und RNG-Verträge.
- [Grafik und Assets](docs/rendering.md): Erweiterung, Besitz und Pflege.
- [Audio und Sprachinhalte](docs/audio.md): Aufnahmen, Texte und Wiedergabeverträge.
- [Prüfungen](docs/testing.md): `npm run check:quality` für das kurze Qualitätsnetz, gezielte Tests, Freigaben und Diagnose.
- [Subagents](docs/subagents.md): isolierte parallele Arbeit.
- [Projektprioritäten](docs/issues/projektfahrplan.md), [Performance](docs/issues/performance-und-mobilstabilitaet.md) und [offene Issues](docs/issues/).
- [Geschichte](docs/story.md): deutsche interne Fassung; englische Spielfassung im Codex.

Landschaften, arrangierte Modell-/Gefechtsbilder und mehrere Kameraperspektiven aufnehmen: [Szenen-Capture](docs/scene-capture.md) (`npm run capture:scene -- --scene scripts/scenes/map-overview.json`). Begrenzte Echtzeitmessungen mit Szenenrezept und automatischem JSON-Export: [Chromium-Diagnose](docs/diagnostic-capture.md) (`npm run diagnose:scene -- --angle gl --require-hardware`).

Isolierte Kartenstarts und Diagnose: [Prüfwerkzeuge](docs/testing.md#manuelle-probeläufe). `npm run simulate:visible` öffnet eine persönliche KI-Zuschauerpartie; **kein Testbefehl, nie automatisch durch Agenten starten**.
