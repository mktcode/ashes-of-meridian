# Prüfungen

## Automatisierte Tests

Ohne Paketinstallation oder Build:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs tests/ashes-of-meridian-persistence.check.cjs tests/ashes-of-meridian-presentation.check.cjs tests/ashes-of-meridian-controls.check.cjs tests/ashes-of-meridian-renderer.check.cjs
```

Ein Worker; das Heaplimit begrenzt den JS-Heap, nicht den gesamten Prozessspeicher.

| Bereich | Abdeckung |
| --- | --- |
| Terrain | Syntax, eingebettete Skybox, Felsgeometrie, feste Karten-/Platzierungsreferenzen |
| Kristalle | Modellgeometrie, Abbaugröße, Vorschau, fünf getrennte Vorkommen je Standort in Kampagnen/Gefechten, Startmengen/IDs/RNG, aktuelle Save-Roundtrips |
| Harness/Core | Skriptloader, Isolation, Pfadvertrag, Matrizen, Vektoren, Seed-RNG |
| Simulation | Start, Auftragsersetzung ohne Befehlswarteschlange, Einzelarbeiter-Bau ohne Bauhilfe, Reparatur fertiger Ziele, Produktion, Ressourcenlieferung, Snapshot-Isolation, aktueller Checkpoint/Restore ohne Kontrollgruppen/Auftragsketten, ungültige Eingaben |
| Persistence | Profilnormalisierung, Speichern/Laden, Backup, Fehlerfälle und flüchtiger Storage-Ersatz |
| Präsentation | Welt-/Effektgrenzen, Terrain-/Effekt-Zeichenreferenzen, Effektablauf und RNG |
| Steuerung | Entfernte Desktop-Kamerapfade/Rechteckauswahl/Kontrollgruppen/Shift-Funktionen/Hotkeys, Touch-Auswahl/Doppeltippen, Touch-Ziehen/Pinch/Limits, Kameraknöpfe/Minimap, Gestenabbruch, Befehls-/Menübuttons, Cancel für alle Zielmodi, Pausenschutz, Hinweise und Home-Aktionen |
| Renderer | Shader-Quellvertrag, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

Keine Migrationstests, alten Operations-Fixtures oder Layout-Kompatibilitätsadapter. Spielstandtests prüfen den aktuellen Stand, nicht ältere Versionen. Feste Terrain-/Effekt-/RNG-Erwartungen werden weiterhin nicht zur Reparatur fehlgeschlagener Tests neu erzeugt.

## Aktueller Prüfstand

Nach Entfernung der Spiel-Hotkeys und Bauhilfe sowie Ergänzung des Touch-Abbrechens: **134 Node-Tests bestanden**, vollständiger obiger Befehl. Terrain-/Effekt-/RNG-Referenzen unverändert.

Chromium 152 unter `file://`, Headless mit Touch-Emulation und Qualitätsstufe Performance: Aktionsbuttons/Cancel für alle Zielmodi bei 960×600, Cancel zusätzlich bei 844×390 und 390×844, wirkungslose DOM-Hotkey-Ereignisse, Pause/Speichern/Laden/Hilfe/Resume per Touch geprüft. Regulärer Einzelarbeiter-Bau und entfernter Bauhilfe-Kontextbefehl über die Live-API geprüft. Keine erfassten Laufzeit-/Ressourcen-/Log- oder GL-Fehler. Kein echtes Mobilgerät oder vollständiger Spielablauf. [Umfang, bekannter Pausenmenü-Ablauf und Grenzen](mobile-touch-controls.md).

Vorheriger Auswahl-/Kamera-Browserablauf, nicht vollständig erneut ausgeführt: [Auswahl-Bereinigung](mobile-selection-cleanup.md). Dort dokumentiert ist auch die bei High überschrittene Doppeltipp-Zeitschwelle; die Touch-Emulationsprüfung gelang damals mit Performance.

Vorheriger Kamera-Schritt: [Kamera-Bereinigung und damalige Prüfungen](mobile-camera-cleanup.md).

Vorheriger, nicht erneut ausgeführter Browsernachweis nach Entfernung der Kompatibilitätsschichten: Start, 100 Simulationsschritte, aktueller Snapshot/Restore und direktes Effektrendering in Chromium 152 unter `file://` bestanden. Die damaligen 121 Node-Tests sind durch den aktuellen Gesamtlauf oben abgelöst.

Browsernachweise für die Darstellung: [Kristalle](crystal-spacing.md), [Modelltexturen](model-textures.md), [MSAA](msaa.md), [Home](home-redesign.md). Diese Berichte sind historische Nachweise ihrer jeweiligen Änderungen, keine automatisch erneut ausgeführte Browser-Testserie.

## Manuelle Browser-Prüfung

Eigenes Testprofil ohne wichtige Daten verwenden. `index.html` direkt unter `file://` öffnen, ohne Server oder abgeschwächte Sicherheitsflags.

- Start, Skybox, Menüs, Konsole und WebGL-Ausgabe prüfen.
- Neue Partie: Touch-Auswahl/-Befehle, Kamera per Fingerziehen/Pinch, Zoom-/Basisknöpfe, Minimap, Pause, Bau, Rekrutierung, Abbau und Kampf. Doppeltippen muss sichtbare eigene Einheiten desselben Typs auswählen. Mausziehen darf kein Auswahlrechteck erzeugen; Kontrollgruppentasten/Shift dürfen keine Auswahl hinzufügen oder Befehle anhängen. Entfernte Desktop-Kameraeingaben dürfen die Kamera nicht bewegen; einfache Mausklicks/Rechtsklick-Befehle bleiben bis zu ihrer separaten Bereinigung prüfbar.
- Bauplatzierung, Bewegung, Attack-Move, Sammelpunkt und alle Fähigkeiten aktivieren und per Cancel abbrechen: kein Verbrauch, keine Befehle, kein versehentliches Platzieren. Spiel-Hotkeys dürfen keine eigenen Aktionen auslösen; native Browser-/Formularbedienung bleibt möglich.
- Regulärer Gebäudebau mit einem Arbeiter; keine Bauhilfe durch weitere Arbeiter und kein Weiterbau durch Reparatur. Reparatur fertiger beschädigter Ziele prüfen.
- Qualität wechseln, Fenstergröße ändern; Einheiten, Effekte und HUD prüfen.
- Aktuellen Spielstand speichern/laden, Backup exportieren/importieren.
- Audio tatsächlich anhören; Audio-API-Prüfungen ersetzen keinen Hörtest.

Node führt kein GLSL aus und prüft weder echte Browser-Eingaben noch GPU-Rasterisierung. Andere Browser/Grafikhardware, vollständige Kampagnen und systematische Performanceprüfungen bleiben separat zu testen. Alte Spielstände sind ausdrücklich kein Kompatibilitätsziel.
