# Ashes of Meridian

Lokaler, touchorientierter Echtzeitstrategie-Prototyp mit drei Fraktionen und WebGL 2. Der Core Loop ist implementiert: **Basis aufbauen → Gefecht → ungenutzten Aether evakuieren → permanente Upgrades → neues Gefecht**. Bedienbarkeit auf echten Geräten und Langzeitbalancing sind noch zu validieren.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) für erste Playtests; Profile bleiben lokal im jeweiligen Browser.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt über `file://` in einem Browser mit WebGL 2 öffnen. Ein Server ist nicht erforderlich. HTML, Styles, Build-Ausgabe und lokale Laufzeitassets gemeinsam mitführen; es ist kein Ein-Datei-Paket. Quellen und Ladevertrag: [Architektur](docs/architecture.md), Webhosting: [Deployment](docs/deployment.md).

## Spielen

Mit **New battle** Fraktion, Gegner und Karte wählen. Ohne Startworker zuerst unter **Infantry** einen Worker rekrutieren. Worker liefern Alloy, Raffinerien an Vents erzeugen Aether. Das gegnerische HQ zerstören gewinnt; das letzte eigene HQ verlieren beendet das Gefecht als Niederlage.

Fingerziehen/Pinch bewegt die Kamera, Tap wählt oder erteilt einen Kontextbefehl. Der Schwerter-Schalter neben ⌂ aktiviert Attack-move. Bau und Rekrutierung liegen rechts, Fähigkeiten mittig, Minimap links. **Cancel** beendet eine Zielauswahl.

Nur Reserve, Upgrades, Fraktionsfreischaltungen und Einstellungen bleiben gespeichert, **keine Runs**. Reload oder Schließen verwirft das Gefecht. Genaue Regeln und Bedienung: [Gameplay](docs/gameplay.md).

## Entwicklung

- [AGENTS.md](AGENTS.md): Arbeitsregeln für KI-Agenten.
- [Architektur](docs/architecture.md): technische Grenzen und nicht offensichtliche Verträge.
- [Grafik und Assets](docs/rendering.md): Modell-/Texturpflege und Darstellungsgrenzen.
- [Prüfungen](docs/testing.md): gezielte Tests, Gesamtsuite und Aussagegrenzen.
- [Feste Testreferenzen](docs/reference-tests.md): Umgang mit Fixtures.
- [Issues](docs/issues/): offene Aufgaben und Entscheidungen, darunter [Geräte-/Run-Validierung](docs/issues/playtest-validation.md).

`npm run simulate:visible` baut und öffnet eine persönliche KI-gegen-KI-Zuschauerpartie über `file://` im normalen Standardbrowser, ohne vorgegebene Fenstergröße. Das flüchtige Profil berührt keine normalen Browserdaten. Jeder Run startet mit 1× und wechselt nach zehn Echtzeitsekunden auf 2×; Tab/Fenster selbst schließen. **Kein Test- oder Agentenabnahmebefehl, nie automatisch ausführen.**
