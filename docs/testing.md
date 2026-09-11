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
| Kristalle | Modellgeometrie, Abbaugröße, Vorschau, fünf getrennte Vorkommen je Standort für Fraktionen/Biome, Startmengen/IDs/RNG, aktuelle Save-Roundtrips |
| Harness/Core | Skriptloader, Isolation, Pfadvertrag, Matrizen, Vektoren, Seed-RNG |
| Simulation | Start, Auftragsersetzung ohne Befehlswarteschlange, Einzelarbeiter-Bau ohne Bauhilfe, Reparatur fertiger Ziele, Gebäude-Reparaturknopf mit nächstem Arbeiter, Verkauf/Erstattung/Queues/HQ-Schutz/Versorgung/Vent und Checkpoints, entfernte Forschung/Missionsobjekte, einheitlicher Gefechtsstart/HQ-Sieg/Niederlage/Wellen, Basiswerte und permanente Upgrades, Produktion, Ressourcenlieferung, Snapshot-Isolation, aktueller Checkpoint/Restore ohne Kontrollgruppen/Auftragsketten/Forschung, ungültige Eingaben |
| Persistence | Profilnormalisierung, Speichern/Laden, Backup, Fehlerfälle und flüchtiger Storage-Ersatz |
| Präsentation | Welt-/Effektgrenzen, Terrain-/Effekt-Zeichenreferenzen, Effektablauf und RNG |
| Steuerung | Entfernte Desktop-Kamerapfade/Rechteckauswahl/Kontrollgruppen/Shift-Funktionen/Hotkeys, Touch-Auswahl/Doppel-/Dreifachtippen mit Typ-/Combat-Filter, Zeitgrenze und Gestenabbruch, Touch-Ziehen/Pinch/Limits, Kameraknöpfe/Minimap, Gestenabbruch, Befehls-/Menübuttons, drei Reiter ohne Forschung, sieben normale Bauaktionen, Auswahl ohne Armor-Forschungslevel, Cancel für alle Zielmodi, Pausenschutz, Gebäude-Panel/Randbegrenzung/Kameraleiste/Buttonstatus/Verkaufsbestätigung, entferntes Tooltip-System, zugängliche Buttonnamen ohne `title`, Hinweise und Home-/Neustart-Aktionen ohne Kampagne, kostenlose permanente Upgrades/Maximalstufen/Persistenz |
| Renderer | Shader-Quellvertrag, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

Keine Migrationstests, alten Operations-Fixtures oder Layout-Kompatibilitätsadapter. Spielstandtests prüfen den aktuellen Stand, nicht ältere Versionen. Feste Terrain-/Effekt-/RNG-Erwartungen werden weiterhin nicht zur Reparatur fehlgeschlagener Tests neu erzeugt.

## Aktueller Prüfstand

Nach Ergänzung der Dreifachtap-Auswahl: **166 Node-Tests bestanden**, vollständiger obiger Befehl. Keine Fixtures neu erzeugt; alle Terrain-/Welt-/Effekt-Zeichenreferenzen und fünf weiterhin passenden Effekt-/RNG-Fälle unverändert. Der frühere kombinierte Waffenfall mit Avatar entfällt; normale Waffen werden separat geprüft. [Referenzabgrenzung](reference-tests.md).

Aktueller gezielter Chromium-`file://`-Touch-Check bei 960×600, Performance: Einzel-/Doppel-/Dreifachtap auf dieselbe Einheit wählt eine Einheit, ihren Typ, dann gemischte Combat-Einheiten ohne Worker; kein Befehl, Zeitablauf setzt zurück. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch-Ereignisse wurden zeitversetzt eingereiht; kein Echtgerät- oder zuverlässiger Timing-Nachweis. [Details und Grenzen](mobile-triple-tap.md).

Vorheriger Chromium-152-`file://`-Touch-Check, nicht vollständig erneut ausgeführt, Performance: alle 18 Gratis-Upgrade-Käufe samt Maximalgrenzen/Persistenz, Gefechtswahl, ein HQ-Ziel, Bau-Cancel, Arbeiter-Reparaturauftrag/×, Rekrutierung, aktueller Checkpoint, Verkauf/Erstattung, Sieg ohne Währungsgewinn, Neustart/Niederlage/Retry. Hauptablauf 960×600, Gefechtsstart/Home zusätzlich 844×390 und 390×844. Keine erfassten Laufzeit-/Ressourcen-/Log- oder GL-Fehler. Kein echtes Mobilgerät oder erspielter Sieg; kontrolliertes Setup/HQ-Schaden und DOM-Scrollhilfen. [Umfang und Grenzen](campaign-removal.md).

Vorheriger gezielter Chromium-`file://`-Touch-Check nach 161 Node-Tests, nicht vollständig erneut ausgeführt: × schließt ohne Abwahl, Kamera weg/zurück öffnet nicht erneut, erneutes Antippen öffnet wieder; × bei 960×600, 844×390 und 390×844 erreichbar. Keine erfassten Laufzeit-/Ressourcen-/GL-Fehler. Echte Mobilgeräte testet der Nutzer. [Nachprüfung](mobile-building-actions.md#nachprüfung-panel-schließen).

Vorheriger Gebäudeaktions-Check, nicht vollständig erneut ausgeführt: Chromium 152 unter `file://`, Headless mit Touch-Emulation und Qualitätsstufe Performance: Gebäudewahl, Repair/Stop, nächster Arbeiter mit Anmarsch und Reparatur, gesperrte Zustände, pausierende Verkaufsbestätigung/Abbruch, Erstattung einschließlich aktiver Rekrutierung, HQ-Schutz und aktuelles Save/Load geprüft. Panel an allen vier Spielfeldrändern bei 960×600, 844×390 und 390×844: Buttons mindestens 44×44 CSS-Pixel, im Spielfeld erreichbar, Kamera-/Hilfe-Buttons frei. Keine erfassten Laufzeit-/Ressourcen-/Log- oder GL-Fehler. Kein echtes Mobilgerät oder vollständiges Durchspielen; Modal-Scroll per DOM-Hilfe. [Umfang und Grenzen](mobile-building-actions.md).

Beim vorherigen Gebäudeaktions-Schritt wurde die Tooltip-Browserprobe ebenfalls erneut bestanden: zugängliche Symbolbutton-Namen, Porträtauswahl, Produktionsabbruch und Meldungsnavigation per Touch; Forschungs-/Touch-Cancel-/Menü-/Einzelarbeiter-Bauablauf einschließlich Fleet-Upgrades, aktueller Checkpoints und Belagerungs-Schild-/Siegfolge. [Ursprünglicher Umfang](tooltip-removal.md).

Vorheriger Forschungsschritt mit Erläuterung der Missionsgeneratoren und Tier-3-RNG-Referenz: [Forschungsentfernung](research-removal.md).

Vorheriger Hotkey-/Bauhilfe-Schritt einschließlich unverändertem Pausenmenü-Ablauf: [Touch-Befehle](mobile-touch-controls.md).

Vorheriger Auswahl-/Kamera-Browserablauf, nicht vollständig erneut ausgeführt: [Auswahl-Bereinigung](mobile-selection-cleanup.md). Dort dokumentiert ist auch die bei High überschrittene Doppeltipp-Zeitschwelle; die Touch-Emulationsprüfung gelang damals mit Performance.

Vorheriger Kamera-Schritt: [Kamera-Bereinigung und damalige Prüfungen](mobile-camera-cleanup.md).

Vorheriger, nicht erneut ausgeführter Browsernachweis nach Entfernung der Kompatibilitätsschichten: Start, 100 Simulationsschritte, aktueller Snapshot/Restore und direktes Effektrendering in Chromium 152 unter `file://` bestanden. Die damaligen 121 Node-Tests sind durch den aktuellen Gesamtlauf oben abgelöst.

Browsernachweise für die Darstellung: [Kristalle](crystal-spacing.md), [Modelltexturen](model-textures.md), [MSAA](msaa.md), [Home](home-redesign.md). Diese Berichte sind historische Nachweise ihrer jeweiligen Änderungen, keine automatisch erneut ausgeführte Browser-Testserie.

## Manuelle Browser-Prüfung

Eigenes Testprofil ohne wichtige Daten verwenden. `index.html` direkt unter `file://` öffnen, ohne Server oder abgeschwächte Sicherheitsflags.

- Start, Skybox, Menüs, Konsole und WebGL-Ausgabe prüfen.
- Neue Partie: Touch-Auswahl/-Befehle, Kamera per Fingerziehen/Pinch, Zoom-/Basisknöpfe, Minimap, Pause, Bau, Rekrutierung, Abbau und Kampf. Doppeltippen muss sichtbare eigene Einheiten desselben Typs auswählen, Dreifachtippen alle sichtbaren eigenen Nicht-Worker einschließlich Supporteinheiten. Zeitabstand, andere Ziele, Pan/Pinch und Abbruch prüfen. Mausziehen darf kein Auswahlrechteck erzeugen; Kontrollgruppentasten/Shift dürfen keine Auswahl hinzufügen oder Befehle anhängen. Entfernte Desktop-Kameraeingaben dürfen die Kamera nicht bewegen; einfache Mausklicks/Rechtsklick-Befehle bleiben bis zu ihrer separaten Bereinigung prüfbar.
- Bauplatzierung, Bewegung, Attack-Move, Sammelpunkt und alle Fähigkeiten aktivieren und per Cancel abbrechen: kein Verbrauch, keine Befehle, kein versehentliches Platzieren. Spiel-Hotkeys dürfen keine eigenen Aktionen auslösen; native Browser-/Formularbedienung bleibt möglich.
- Regulärer Gebäudebau mit einem Arbeiter; keine Bauhilfe durch weitere Arbeiter und kein Weiterbau durch Reparatur. Reparatur fertiger beschädigter Ziele prüfen.
- Ein fertiges eigenes Gebäude antippen: Repair schickt genau den nächsten Arbeiter, Stop bricht ab, ohne Arbeiter/Alloy und bei voller Hülle gesperrt. Sell/Keep/Bestätigung, 50-%-Gebäudeerstattung plus volle offene Rekrutierung, letztes fertiges HQ, Versorgungsverlust und aktuelle Checkpoints prüfen. Panel an kleinen Bildschirmrändern erreichbar, Kamera-/Hilfe-Buttons frei; bei Auswahl von Fundamenten/Einheiten/mehreren Objekten, Zielmodus und Pause ausgeblendet.
- Nur Command/Build/Recruit und sieben baubare Gebäude; keine Forschung, kein Labor und keine Missionsgeneratoren. Keine Kampagnenauswahl, Sondermodi, Missionsobjekte oder Sterne. Neues Gefecht mit Fraktions-/Gegner-/Biom-/Seed-/Schwierigkeitswahl starten: Sieg bei zerstörtem Gegner-HQ, Niederlage beim letzten eigenen HQ. Neustart und Home prüfen.
- Fleet Upgrades kostenlos bis Stufe 3 kaufen: keine Credit-Abbuchung oder Ergebniswährung; Stufen speichern und im nächsten Gefecht wirksam, laufendes/geladenes Gefecht unverändert. Gefechts-Alloy/Aether bleiben begrenzt. Version-2-Checkpoint laden; alte Kampagnen-Checkpoints werden nicht übernommen.
- Keine Beschreibungs-/Browser-Tooltips bei Aktions-, Kamera-, Porträt- und Produktionsbuttons; zugängliche Namen erhalten. Porträtauswahl, Produktionsabbruch mit Rückerstattung, sichtbare Kosten und Warn-/Toast-Rückmeldungen prüfen.
- Qualität wechseln, Fenstergröße ändern; Einheiten, Effekte und HUD prüfen.
- Aktuellen Spielstand speichern/laden, Backup exportieren/importieren.
- Audio tatsächlich anhören; Audio-API-Prüfungen ersetzen keinen Hörtest.

Node führt kein GLSL aus und prüft weder echte Browser-Eingaben noch GPU-Rasterisierung. Andere Browser/Grafikhardware, vollständige Gefechte und systematische Performance-/Balancingprüfungen bleiben separat zu testen. Alte Spielstände sind ausdrücklich kein Kompatibilitätsziel.
