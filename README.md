# Ashes of Meridian

Statischer Echtzeitstrategie-Prototyp auf dem Weg zum Mobile-Roguelite: drei Fraktionen, wiederholbare Gefechte gegen ein gegnerisches HQ. Kein Build, keine npm-Abhängigkeiten und kein erforderlicher Server.

## Spielen

Neue Gefechte starten mit dem Hauptgebäude und je nach permanentem Upgrade **0–5 Workern**. **250 Alloy und 0 Aether** bleiben auf jeder Stufe erhalten; das reicht für fünf weitere Worker zu je 50 Alloy. Ohne Startworker den ersten über **Infanterie** rekrutieren. Worker bauen automatisch Alloy ab, Raffinerien liefern Aether.

`index.html` direkt in einem Browser mit WebGL 2 öffnen. Die JavaScript-Quellen unter `src/`, `styles.css` und die separaten Bildquellen müssen mitgeführt werden. Die Laufzeittexturen sind in `src/renderer/assets.js` eingebettet. Das Spiel ist kein Ein-Datei-Paket.

- Kamera: mit einem Finger ziehen, Pinch-to-Zoom, Zoom-/Basisknöpfe oder Minimap.
- Auswahl: einmal tippen; zweimal für sichtbare eigene Einheiten desselben Typs; dreimal für sichtbare eigene Nicht-Worker. Jeweils weniger als 330 ms zwischen den Releases.
- Boden-Tap: Kampfeinheiten erhalten Attack-move, Worker normale Bewegung; ausgewählte Gebäude werden abgewählt. Rallypoints nur über **Rally point** im Aktionsmenü setzen. **Cancel** bricht Bau-/Fähigkeits-/Rally-Zielauswahl ab.
- Portrait-Deck: links die Minimap auf halber Bildschirmbreite; rechts **Gebäude / Infanterie / Fahrzeuge / Flugzeuge** und Untermenüs mit **Zurück**. Arbeiter und Kommandant stehen unter Infanterie.
- Fertige eigene Gebäude: **Sell**, **Repair / Stop repair** und **Rally point** im rechten Menü. Reparatur braucht einen Arbeiter; Verkauf erfolgt nach Bestätigung. Fähigkeiten bleiben in der Leiste darüber verfügbar.
- Queue-Symbole links über der Minimap zählen offene Aufträge je Einheitentyp. Der kreisförmige Fortschritt zeigt die nächste Fertigstellung; Tap storniert einen Auftrag.
- **Fleet Upgrades → Starting workers**: kostenlos bis Stufe 5, ein zusätzlicher Startworker pro Stufe. Wirkt erst im nächsten Gefecht oder Neustart. Alloy/Aether bleiben begrenzt; noch keine erspielbare Upgrade-Währung.

Weitere Regeln und offene Punkte: [Spiel und Bedienung](docs/gameplay.md).

Optional für lokale Entwicklung: `python3 -m http.server 8080 --bind 127.0.0.1`, dann [localhost:8080](http://127.0.0.1:8080/) öffnen. Direktes `file://` bleibt das Auslieferungsziel.

## Runs und Pausen

Runs werden nicht gespeichert. **Ⅱ** pausiert das laufende Gefecht; beim Wechsel in einen anderen Tab wird ebenfalls pausiert. Fortsetzen geht nur, solange diese Seite geöffnet bleibt. Hauptmenü, Schließen oder Reload verwerfen den Run. Nach Sieg oder Niederlage bleiben **Neustart** und **Hauptmenü**.

Nur permanente Upgrades und Einstellungen bleiben im Browserspeicher. Kein Checkpoint, Autosave, Resume nach Reload oder Backup-Import/-Export. Unter `file://` kann der Browserspeicher eingeschränkt sein; der flüchtige Profilersatz überlebt keinen Reload. Technische Details: [Speicherung](docs/architecture.md#speicherung).

## Entwicklung

- [Architektur](docs/architecture.md): Codekarte, Schnittstellen, Speicherung und Risiken.
- [Grafik und Assets](docs/rendering.md): Texturen, Skybox und Qualitätsstufen.
- [Prüfungen](docs/testing.md): Testbefehl, Abdeckung und angemessener Prüfaufwand.
- [Arbeitsprotokoll](docs/worklog.md): zentrale kurze Änderungshistorie und letzte Prüfnachweise.
- [Arbeitsregeln](AGENTS.md).
