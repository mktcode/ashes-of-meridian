# Ashes of Meridian

Lokaler, touchorientierter Echtzeitstrategie-Prototyp mit drei Fraktionen und WebGL 2. Der **Core Gameplay Loop ist implementiert**: Basis aufbauen → gegnerisches HQ zerstören oder verlieren → ungenutzten Aether evakuieren → permanente Upgrades kaufen → erneut antreten. Bedienbarkeit auf echten Geräten und Langzeitbalancing sind noch zu validieren.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt über `file://` in einem Browser mit WebGL 2 öffnen. Ein Server ist nicht erforderlich. `src/`, `styles/` und `index.html` sind Quellen; `dist/src/` wird lokal erzeugt und nicht eingecheckt. Das Spiel ist kein Ein-Datei-Paket: HTML, Styles, Build-Ausgabe und Bildquellen gemeinsam mitführen. Laufzeittexturen sind eingebettet.

## Spielen

- Start: HQ, **0–5 Worker** je nach Upgrade, **250 Alloy / 0 Aether**. Ohne Startworker den ersten unter **Infanterie** für 50 Alloy rekrutieren. Worker liefern Alloy; Raffinerien an Vents erzeugen Aether.
- Kamera mit Fingerziehen, Pinch, Zoom-/Basisknöpfen oder Minimap bewegen. Tap wählt; Doppel-/Dreifachtap gruppiert eigene Einheiten. Boden-Tap erteilt Bewegung, der **Schwerter-Schalter neben ⌂** aktiviert Attack-move. **Cancel** beendet Zielauswahl.
- Unten: Minimap links, Werkzeuge/Fähigkeiten mittig, Bau-/Rekrutierungsmenüs rechts. Gebäudeauswahl bietet Reparatur, Verkauf und Rallypoint; Queue-Symbole über der Minimap erlauben Stornierung. Tempo direkt unter der Uhr antippen.
- Gegnerisches HQ zerstören gewinnt; Verlust des letzten eigenen HQs verliert. Ein Free-Marches-Sieg schaltet die Verdant Choir frei; ein anschließender Sieg mit ihr öffnet dauerhaft die Veiled Court.
- Nach jedem Ergebnis wird ungenutzter Aether bis zum Evakuierungslimit in die Reserve übertragen. **Fleet Upgrades** erhöht Startworkerzahl und Evakuierungslimit; Käufe gelten ab dem nächsten Gefecht/Neustart.
- **Keine Run-Speicherung:** Pause gilt nur in der geöffneten Seite. Tab-Wechsel pausiert automatisch; Hauptmenü, Reload oder Schließen verwerfen den Run. Nur Reserve, Upgrades, Freischaltungen und Einstellungen bleiben im Browserprofil. Bei eingeschränktem Browserspeicher ist auch dieses Profil nur flüchtig.

## Orientierung und Entwicklung

- **KI-Agenten:** mit [AGENTS.md](AGENTS.md) beginnen.
- [Spiel und Bedienung](docs/gameplay.md): genaue Regeln und priorisierte nächste Prüfungen.
- [Architektur](docs/architecture.md): Codekarte, Zustände und Speicherung.
- [Grafik und Assets](docs/rendering.md): Texturen, Qualitätsstufen, Viewport und Menüs.
- [Prüfungen](docs/testing.md): `npm test`, Abdeckung, Browserchecks und Grenzen.
- [Feste Testreferenzen](docs/reference-tests.md): Zweck und Pflege der Fixtures.
- [Arbeitsprotokoll](docs/worklog.md): kompakter Übergabestand und letzte Nachweise; ältere Entwicklung in Git.

Breites Refactoring und weitere TypeScript-Migration sind pausiert. Als Nächstes stehen echte Mobilgeräte und vollständige Runs einschließlich Upgradeökonomie im Vordergrund, nicht zusätzliche Systeme.
