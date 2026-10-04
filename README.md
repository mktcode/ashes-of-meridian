# Ashes of Meridian

Lokaler, touchorientierter RTS-Roguelite-Prototyp mit drei Fraktionen und WebGL 2: **Basis bauen → Gefecht gewinnen → Expeditionsvorteil wählen → Nachhall in Flottenupgrades investieren**. Der Core Loop ist implementiert; Bedienbarkeit, Langzeitbalance und Zielgeräteperformance bleiben offen.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) · Profile bleiben lokal im jeweiligen Browser.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt im Browser öffnen (`file://`, kein Server nötig). HTML, Styles, Build-Ausgabe und Laufzeitassets gemeinsam mitführen. `npm run build:zip` erstellt das itch.io-Paket; [Deployment](docs/deployment.md) beschreibt die Veröffentlichung.

## Spielen

**New expedition** startet einen Run mit festem Vierer-Command-Loadout. Alle Parteien landen mit Workern und bauen ihr HQ selbst. Beim ersten Tutorial liegen Ressourcen in Sicht, später wird vor der Basiswahl erkundet. Sechs Landschaftsfamilien des gemeinsamen prozeduralen Generators stehen als seedbasierte Expeditionskarten zur Verfügung. Siege liefern Vorteile für folgende Gefechte; Niederlage beendet den Run. **Continue expedition** stellt das zuletzt gespeicherte Gefecht pausiert wieder her. Laufende Gefechte werden automatisch gespeichert und können nicht neu gestartet werden; [Speichergrenzen](docs/gameplay.md#speichern-und-lebenszyklus). Die Checkpoint-Pfeile blättern nur durch Landschaftsvorschauen. **Codex** zeigt alle Fraktionen und Modelle unabhängig von Freischaltungen.

Ein-Finger-/Rechtsmausziehen verschiebt die Kamera, Zwei-Finger-Drehen/Mittelmausziehen dreht sie, Pinch/Mausrad zoomt; Tap/Linksklick wählt, Linksmausziehen oder Halten-und-Ziehen auf Touch wählt mehrere Einheiten. Ziel-Tap/Rechtsklick erteilt Kontextbefehle. Minimap links, Fähigkeiten mittig, Bau/Rekrutierung rechts. [Regeln und Bedienung](docs/gameplay.md).

Das Spiel ist **Singleplayer-only** und benötigt keinen Backenddienst. Eine spätere [Multiplayer-Neubewertung](docs/issues/multiplayer.md) ist zurückgestellt, bis die grundlegenden Spielmechaniken feststehen.

## Entwicklung

- [AGENTS.md](AGENTS.md): verbindliche Arbeitsregeln.
- [Architektur](docs/architecture.md): Systemgrenzen, Lade-, Zustands- und RNG-Verträge.
- [Grafik und Assets](docs/rendering.md): Erweiterung, Besitz und Pflege.
- [Audio und Sprachinhalte](docs/audio.md): Aufnahmen, Texte und Wiedergabeverträge.
- [Prüfungen](docs/testing.md): kurze gezielte Rückkopplung, Freigaben und Diagnose.
- [Subagents](docs/subagents.md): isolierte parallele Arbeit.
- [Projektprioritäten](docs/issues/projektfahrplan.md) und [offene Issues](docs/issues/).
- [Geschichte](docs/story.md): deutsche interne Fassung; englische Spielfassung im Codex.

Isolierte Kartenstarts und Diagnose: [Prüfwerkzeuge](docs/testing.md#manuelle-probeläufe). `npm run simulate:visible` öffnet eine persönliche KI-Zuschauerpartie; **kein Testbefehl, nie automatisch durch Agenten starten**.
