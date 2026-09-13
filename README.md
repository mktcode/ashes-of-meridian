# Ashes of Meridian

Lokaler, touchorientierter Echtzeitstrategie-Prototyp mit drei Fraktionen und WebGL 2. Der **Core Gameplay Loop ist implementiert**: Basis aufbauen → gegnerisches HQ zerstören oder verlieren → ungenutzten Aether evakuieren → permanente Upgrades kaufen → erneut antreten. Bedienbarkeit auf echten Geräten und Langzeitbalancing sind noch zu validieren.

## Öffentliche Testversion

Die Dokploy-Testinstanz ist unter [aom.markus-kottlaender.de](https://aom.markus-kottlaender.de/) erreichbar. Sie dient dem Projektinhaber und ersten Playtestern; Browserprofile werden weiterhin nur lokal auf dem jeweiligen Gerät gespeichert.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt über `file://` in einem Browser mit WebGL 2 öffnen. Ein Server ist nicht erforderlich. `src/`, `styles/` und `index.html` sind Quellen; `dist/src/` wird lokal erzeugt und nicht eingecheckt. Das Spiel ist kein Ein-Datei-Paket: HTML, Styles, Build-Ausgabe sowie Laufzeitbilder und Audioquellen gemeinsam mitführen. Laufzeittexturen sind eingebettet; ihre kanonischen WebP-Quellen (Qualität 80) liegen unter `assets/textures/`. Nach Texturänderungen erzeugt `npm run embed:textures` zentral `src/renderer/assets.js`, anschließend aktualisiert `npm run build` die Auslieferung. Für ein statisches Webdeployment steht ein Multi-Stage-[Dockerfile](Dockerfile) bereit; Dokploy-Konfiguration und Auslieferungsgrenzen beschreibt [Statisches Webdeployment](docs/deployment.md).

## Spielen

- Start: HQ, **0–5 Worker** und **250–500 Alloy** je nach Upgrade, immer **0 Aether**. Ohne Startworker den ersten unter **Infantry** für 50 Alloy rekrutieren. Worker liefern Alloy; Raffinerien an Vents erzeugen Aether.
- Kamera mit Fingerziehen, Pinch, Zoom-/Basisknöpfen oder Minimap bewegen. Tap wählt; Doppel-/Dreifachtap gruppiert eigene Einheiten. Boden-Tap erteilt Bewegung, der **Schwerter-Schalter neben ⌂** aktiviert Attack-move. **Cancel** beendet Zielauswahl.
- Unten: Minimap links, Werkzeuge/Fähigkeiten mittig, Bau-/Rekrutierungsmenüs rechts. Gebäudeauswahl bietet Reparatur, Verkauf und Rallypoint; Queue-Symbole über der Minimap erlauben Stornierung. Tempo direkt unter der Uhr antippen.
- Gegnerisches HQ zerstören gewinnt; Verlust des letzten eigenen HQs verliert. Ein Free-Marches-Sieg schaltet die Verdant Choir frei; ein anschließender Sieg mit ihr öffnet dauerhaft die Veiled Court.
- Nach jedem Ergebnis wird ungenutzter Aether bis zum Evakuierungslimit in die Reserve übertragen. **Fleet Upgrades** erhöht Start-Alloy, Startworkerzahl und Evakuierungslimit; Käufe gelten ab dem nächsten Gefecht/Neustart.
- **Keine Run-Speicherung:** Pause gilt nur in der geöffneten Seite. Tab-Wechsel pausiert automatisch; Hauptmenü, Reload oder Schließen verwerfen den Run. Nur Reserve, Upgrades, Freischaltungen und Einstellungen bleiben im Browserprofil. Bei eingeschränktem Browserspeicher ist auch dieses Profil nur flüchtig.

## Orientierung und Entwicklung

- **KI-Agenten:** mit [AGENTS.md](AGENTS.md) beginnen.
- [Spiel und Bedienung](docs/gameplay.md): genaue Regeln und priorisierte nächste Prüfungen.
- [Architektur](docs/architecture.md): Codekarte, Zustände und Speicherung.
- [Statisches Webdeployment](docs/deployment.md): Docker-/Dokploy-Build, Port und Zustandsgrenzen.
- [Grafik und Assets](docs/rendering.md): Texturen, Qualitätsstufen, Viewport und Menüs.
- [Prüfungen](docs/testing.md): `npm test`, Abdeckung, Browserchecks und Grenzen.
- [Feste Testreferenzen](docs/reference-tests.md): Zweck und Pflege der Fixtures.
- [Arbeitsprotokoll](docs/worklog.md): kompakter Übergabestand und letzte Nachweise; ältere Entwicklung in Git.

Breites Refactoring und weitere TypeScript-Migration sind pausiert. Als Nächstes stehen echte Mobilgeräte und vollständige Runs einschließlich Upgradeökonomie im Vordergrund, nicht zusätzliche Systeme.
