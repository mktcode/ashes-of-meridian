# Ashes of Meridian

Lokaler, touchorientierter Echtzeitstrategie-Roguelite-Prototyp mit drei Fraktionen und WebGL 2. Der Core Loop ist implementiert: **Basis aufbauen → Gefecht gewinnen → Expeditionsvorteil wählen → weiter vordringen → Aether in permanente Flottenupgrades investieren**. Bedienbarkeit auf echten Geräten und Langzeitbalancing sind noch zu validieren.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) für erste Playtests; Profile bleiben lokal im jeweiligen Browser.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt über `file://` in einem Browser mit WebGL 2 öffnen. Ein Server ist nicht erforderlich. HTML, Styles, Build-Ausgabe und lokale Laufzeitassets gemeinsam mitführen; es ist kein Ein-Datei-Paket. `npm run build:zip` erzeugt das direkt hochladbare HTML5-Paket `release/ashes-of-meridian-prototype.zip` für itch.io. Quellen und Ladevertrag: [Architektur](docs/architecture.md), Webhosting und Veröffentlichung: [Deployment](docs/deployment.md).

## Spielen

Mit **New expedition** eine freigeschaltete Fraktion wählen; Gegner, Karte und Seed werden für jedes Gefecht neu bestimmt. Ohne Startworker zuerst unter **Infantry** einen Worker rekrutieren. Worker liefern Alloy, Raffinerien an Vents erzeugen Aether. Das gegnerische HQ zerstören führt zur Vorteilswahl und zum nächsten Gefecht; das letzte eigene HQ beendet die Expedition.

Fingerziehen/Pinch oder Mausziehen/Mausrad bewegt die Kamera; Tap bzw. Linksklick wählt, Rechtsklick erteilt Kontextbefehle. Basis- und Zoomknöpfe liegen unter der Minimap; der mittige Schwerter-Schalter aktiviert Attack-move. Das Gruppensymbol wählt alle eigenen Kampfeinheiten außer Workern. Bau und Rekrutierung liegen rechts, Fähigkeiten mittig, Minimap links. **Cancel** beendet eine Zielauswahl.

Reserve, Upgrades, Expeditionstiefe und Einstellungen bleiben gespeichert. Eine laufende Expedition wird **zwischen Gefechten** automatisch gesichert; Reload oder Schließen verwirft nur das aktuelle Gefecht und setzt am letzten Übergang fort. Genaue Regeln und Bedienung: [Gameplay](docs/gameplay.md).

## Entwicklung

- [AGENTS.md](AGENTS.md): Arbeitsregeln für KI-Agenten.
- [Architektur](docs/architecture.md): technische Grenzen und nicht offensichtliche Verträge.
- [Grafik und Assets](docs/rendering.md): Modell-/Texturpflege und Darstellungsgrenzen.
- [Prüfungen](docs/testing.md): gezielte Tests, Gesamtsuite und Aussagegrenzen.
- [Feste Testreferenzen](docs/reference-tests.md): Umgang mit Fixtures.
- [Issues](docs/issues/): offene Aufgaben und Entscheidungen, darunter [Geräte-/Run-Validierung](docs/issues/playtest-validation.md).

### Pi-Subagents

[pi-subagents](https://github.com/nicobailon/pi-subagents) ist projektlokal eingerichtet. Der Hauptagent verteilt abgegrenzte Aufgaben auf eigene Worktrees, beantwortet Rückfragen und integriert die Ergebnisse. [Einrichtung und Arbeitsablauf](docs/subagents.md); verbindliche Grenzen in [AGENTS.md](AGENTS.md#parallele-arbeit-und-subagents).

### Manuelle Zuschauerpartie

`npm run simulate:visible` baut und öffnet eine persönliche KI-gegen-KI-Zuschauerpartie über `file://` im normalen Standardbrowser, ohne vorgegebene Fenstergröße. Das flüchtige Profil berührt keine normalen Browserdaten. Jeder Run startet mit 1× und wechselt nach zehn Echtzeitsekunden auf 2×; Tab/Fenster selbst schließen. **Kein Test- oder Agentenabnahmebefehl, nie automatisch ausführen.**
