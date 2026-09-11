# Ashes of Meridian

Statischer Echtzeitstrategie-Prototyp auf dem Weg zum Mobile-Roguelite: drei Fraktionen, wiederholbare Gefechte gegen ein gegnerisches HQ. Kein Build, keine npm-Abhängigkeiten und kein erforderlicher Server.

## Spielen

`index.html` direkt in einem Browser mit WebGL 2 öffnen. Alle lokalen JavaScript-Dateien und `styles.css` müssen neben dem HTML bleiben; die separaten Bildquellen ebenfalls mitführen. Die Laufzeittexturen sind in `renderer.js` eingebettet. Das Spiel ist kein Ein-Datei-Paket.

- Kamera: mit einem Finger ziehen, Pinch-to-Zoom, Zoom-/Basisknöpfe oder Minimap.
- Auswahl: einmal tippen; zweimal für sichtbare eigene Einheiten desselben Typs; dreimal für sichtbare eigene Nicht-Worker. Jeweils weniger als 330 ms zwischen den Releases.
- Boden-Tap: Kampfeinheiten erhalten Attack-move, Worker normale Bewegung. **Cancel** bricht Bau-/Fähigkeits-/Rally-Zielauswahl ab.
- Fertige eigene Gebäude: **Repair / Stop repair** und **Sell** am Gebäude. Reparatur braucht einen Arbeiter; Verkauf erfolgt nach Bestätigung.
- **Fleet Upgrades** sind zum Testen kostenlos bis Stufe 3 und wirken in neuen Gefechten. Alloy/Aether bleiben begrenzt; noch keine erspielbare Upgrade-Währung.

Weitere Regeln und die noch offene UI-/Rekrutierungsplanung: [Spiel und Bedienung](docs/gameplay.md).

Optional für lokale Entwicklung: `python3 -m http.server 8080 --bind 127.0.0.1`, dann [localhost:8080](http://127.0.0.1:8080/) öffnen. Direktes `file://` bleibt das Auslieferungsziel.

## Spielstände sichern

Unter **Settings → Export Backup / Import Backup** lassen sich permanente Upgrades und Checkpoints übertragen. Vor Browserwechsel oder Verschieben der Dateien exportieren: Browserspeicher wird nicht automatisch übernommen und kann unter `file://` eingeschränkt sein. Ohne dauerhaften Speicher geht der flüchtige Ersatz beim Schließen verloren.

Checkpoints verwenden Version 3; ältere Spielstände werden nicht übernommen. Permanente Upgrades bleiben erhalten. Technische Details: [Speicherung](docs/architecture.md#speicherung).

## Entwicklung

- [Architektur](docs/architecture.md): Codekarte, Schnittstellen, Speicherung und Risiken.
- [Grafik und Assets](docs/rendering.md): Texturen, Skybox und Qualitätsstufen.
- [Prüfungen](docs/testing.md): Testbefehl, Abdeckung und angemessener Prüfaufwand.
- [Arbeitsprotokoll](docs/worklog.md): zentrale kurze Änderungshistorie und letzte Prüfnachweise.
- [Arbeitsregeln](AGENTS.md).
