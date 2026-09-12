# Ashes of Meridian

Statischer Echtzeitstrategie-Prototyp auf dem Weg zum Mobile-Roguelite: drei Fraktionen, wiederholbare Gefechte gegen ein gegnerisches HQ. TypeScript erzeugt lokale klassische Laufzeitskripte; ein Server ist nicht erforderlich.

## Spielen

Neue Gefechte starten mit dem Hauptgebäude und je nach permanentem Upgrade **0–5 Workern**. **250 Alloy und 0 Aether** bleiben auf jeder Stufe erhalten; das reicht für fünf weitere Worker zu je 50 Alloy. Ohne Startworker den ersten über **Infanterie** rekrutieren. Worker bauen automatisch Alloy ab, Raffinerien liefern Aether.

Einmalig die Entwicklungsabhängigkeiten installieren und die Laufzeitskripte erzeugen:

```bash
npm install
npm run build
```

Danach `index.html` direkt in einem Browser mit WebGL 2 öffnen. Die handgepflegten Quellen liegen unter `src/`, die generierten klassischen Skripte unter `dist/src/`. Stylesheets und separate Bildquellen müssen ebenfalls mitgeführt werden. Die Laufzeittexturen sind derzeit in `src/renderer/assets.js` eingebettet. Das Spiel ist kein Ein-Datei-Paket; `dist/` wird nicht eingecheckt.

- Kamera: mit einem Finger ziehen, Pinch-to-Zoom, Zoom-/Basisknöpfe oder Minimap. Die Welt liegt zwischen Ressourcenleiste und Fähigkeitenleiste, nicht hinter dem unteren Menü. Die Kamera zentriert diesen freien Bereich; Objektgrößen pro Zoomstufe bleiben erhalten.
- Tempo: Button links über der Fähigkeitenleiste zeigt die aktuelle Geschwindigkeit. Antippen wechselt **1× → 1,5× → 2× → 0,75× → 1×**. Gilt nur für das aktuelle Gefecht; Pause behält das Tempo, neues Gefecht/Neustart beginnt mit 1×. Nicht mehr in den Settings.
- Auswahl: einmal tippen; zweimal für sichtbare eigene Einheiten desselben Typs; dreimal für sichtbare eigene Nicht-Worker. Jeweils weniger als 330 ms zwischen den Releases.
- Boden-Tap: normale Bewegung, auch zum Rückzug. Das **Schwerter-Symbol links neben ⌂** schaltet Attack-move ein/aus: gold = unterwegs Gegner bekämpfen. Startet pro Gefecht ausgeschaltet; Worker bewegen sich immer normal. Ausgewählte Gebäude werden abgewählt. Rallypoints nur über **Rally point** im Aktionsmenü setzen. **Cancel** bricht Bau-/Fähigkeits-/Rally-Zielauswahl ab.
- Portrait-Deck: links die Minimap auf halber Bildschirmbreite; rechts **Gebäude / Infanterie / Fahrzeuge / Flugzeuge** und Untermenüs mit **Zurück**. Arbeiter und Kommandant stehen unter Infanterie.
- Worker ausgewählt → eigenes Fundament antippen: weiterbauen; beschädigtes eigenes Gebäude/Einheit antippen: reparieren. Genau ein ausgewählter Worker übernimmt, bestehende Bauarbeiter werden dabei abgelöst. Ohne Worker-Auswahl werden diese Ziele normal ausgewählt.
- Automatische Bau-/Repair-Zuweisung nutzt nur Worker ohne Bau-/Reparaturauftrag (Abbau zählt als frei). Ist keiner frei, wird nichts platziert oder bezahlt.
- Fertige eigene Gebäude: **Sell**, **Repair / Stop repair** und **Rally point** im rechten Menü. Verkauf erfolgt nach Bestätigung. Fähigkeiten bleiben in der Leiste darüber verfügbar.
- Queue-Symbole links über der Minimap zählen offene Aufträge je Einheitentyp. Der kreisförmige Fortschritt zeigt die nächste Fertigstellung; Tap storniert einen Auftrag.
- Fraktionen: Zu Beginn ist nur **The Free Marches** spielbar. Ein Sieg mit ihnen schaltet **Verdant Choir** und **Veiled Court** gemeinsam und dauerhaft für dieses Browserprofil frei. Gegner dürfen weiterhin frei gewählt werden.
- **Aether-Reserve und Fleet Upgrades**: Verbleibender Aether wird nach jedem Ergebnis in die permanente Reserve evakuiert. Die Grenze startet bei **100 pro Gefecht** und wächst mit **Aether evacuation** über fünf Stufen auf 1.000; diese kosten 500 / 800 / 1.200 / 1.800 / 2.600 Aether. **Starting workers** kostet 300 / 450 / 650 / 900 / 1.200 Aether pro Stufe und gibt je einen Startworker, maximal fünf. Upgrades wirken erst im nächsten Gefecht oder Neustart.

Weitere Regeln und offene Punkte: [Spiel und Bedienung](docs/gameplay.md).

Optional für lokale Entwicklung nach dem Build: `python3 -m http.server 8080 --bind 127.0.0.1`, dann [localhost:8080](http://127.0.0.1:8080/) öffnen. Direktes `file://` bleibt das Auslieferungsziel.

## Runs und Pausen

Runs werden nicht gespeichert. **Ⅱ** pausiert das laufende Gefecht; beim Wechsel in einen anderen Tab wird ebenfalls pausiert. Fortsetzen geht nur, solange diese Seite geöffnet bleibt. Hauptmenü, Schließen oder Reload verwerfen den Run. Nach Sieg oder Niederlage stehen **Neustart**, **Fleet Upgrades** und **Hauptmenü** direkt bereit. Aus den Upgrades führt **Return** zurück zum Ergebnis; Änderungen gelten beim nächsten Start.

Nur permanente Aether-Reserve, Upgrades, Fraktionsfreischaltungen und Einstellungen bleiben im Browserspeicher. Kein Checkpoint, Autosave, Resume nach Reload oder Backup-Import/-Export. Unter `file://` kann der Browserspeicher eingeschränkt sein; der flüchtige Profilersatz überlebt keinen Reload. Technische Details: [Speicherung](docs/architecture.md#speicherung).

## Entwicklung

- [Architektur](docs/architecture.md): Codekarte, Schnittstellen, Speicherung und Risiken.
- [Grafik und Assets](docs/rendering.md): Texturen, Skybox und Qualitätsstufen.
- [Prüfungen](docs/testing.md): Testbefehl, Abdeckung und angemessener Prüfaufwand.
- [Arbeitsprotokoll](docs/worklog.md): zentrale kurze Änderungshistorie und letzte Prüfnachweise.
- [Arbeitsregeln](AGENTS.md).
