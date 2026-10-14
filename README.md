# Ashes of Meridian

Lokaler, touchorientierter Singleplayer-RTS-Roguelite-Prototyp mit WebGL 2:
**Basis bauen → Gefecht gewinnen → Außenposten ausbauen/verteidigen → evakuieren → weiterziehen.**
Bedienbarkeit, Langzeitbalance und Zielgeräteperformance sind noch nicht vollständig abgenommen.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) · Profile bleiben lokal im jeweiligen Browser.

## Starten

Node.js 24 verwenden (`nvm use`, [`.nvmrc`](.nvmrc)):

```bash
npm ci
npm run build
```

Danach `index.html` direkt öffnen: kein Server, CDN oder Backend erforderlich.
HTML, Styles, `dist/`, Assets und Audio gemeinsam mitführen.

## Spielen

**New expedition** startet einen Run; **Continue expedition** setzt das gespeicherte Gefecht fort.
Nach dem Sieg bleibt die Welt als Außenposten zum Weiterbauen erhalten.
**Outpost guide** im Pausenmenü erklärt Bau und endgültige Evakuierung.
Einheiten müssen ausdrücklich zum Evakuierungs-HQ geschickt werden; bis zu drei zivile
Gebäude können ihre aktuellen Upgrade-Ränge sichern. Vorräte bleiben zurück.

Tap/Linksklick wählt, Ziel-Tap/Rechtsklick erteilt Kontextbefehle.
Ein-Finger-/Rechtsmausziehen verschiebt, Zwei-Finger-/Mittelmausdrehen rotiert,
Pinch/Mausrad zoomt. Linksziehen oder Halten-und-Ziehen auf Touch wählt mehrere Einheiten.
**Codex** zeigt Fraktionen und Modelle.

Saves sind lokal, ohne Offline-Fortschritt oder synchronisierte Mehrtab-Nutzung.
Niederlage/Abbruch beendet den Run; alte oder beschädigte Saves werden nicht migriert.
Bei Speicherfehlern bleibt Fortschritt nur im Tab; Reload kann ältere Werte laden.

## Entwicklung

- [Arbeitsregeln](AGENTS.md), [Systemgrenzen](docs/architecture.md), [Prüfverfahren](docs/testing.md).
- [Assets und Modelle](docs/assets.md), [Gestaltungsziele](docs/graphics-guideline.md).
- [Hosting und itch.io](docs/deployment.md), [Kartenbetrachter, Capture und Diagnose](docs/scene-capture.md).
- [Offene Arbeit](docs/issues/projektfahrplan.md), [Geschichte](docs/story.md) (deutsche interne Fassung).
- [3D-Planungskarten-Experiment](experiments/planning-map/README.md): unabhängig vom Spiel.

`map-viewer.html` zeigt Landschaften ohne Gefecht oder Profilzugriff.
Das separate Terrainlabor liegt im Parallelprojekt `../../aom-map-generator/` mit eigener README.
`npm run simulate:visible` ist eine persönliche Zuschauerpartie, kein automatischer Test.
