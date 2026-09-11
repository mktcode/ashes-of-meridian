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
| Simulation | Start, Auftragsersetzung ohne Befehlswarteschlange, Einzelarbeiter-Bau ohne Bauhilfe, Reparatur fertiger Ziele, Gebäude-Reparaturknopf mit nächstem Arbeiter, Verkauf/Erstattung/Queues/HQ-Schutz/Versorgung/Vent und Checkpoints, entfernte Forschung/Missionsobjekte, einheitlicher Gefechtsstart/HQ-Sieg/Niederlage/Wellen, feste frühere Standard-Werte ohne Schwierigkeit, unveränderte Fraktions-/Veteranenboni und permanente Upgrades, Produktion, Ressourcenlieferung, Snapshot-Isolation, aktueller Checkpoint/Restore ohne Kontrollgruppen/Auftragsketten/Forschung, ungültige Eingaben |
| Persistence | Profilnormalisierung, Speichern/Laden, Backup, Fehlerfälle und flüchtiger Storage-Ersatz |
| Präsentation | Welt-/Effektgrenzen, Terrain-/Effekt-Zeichenreferenzen, Effektablauf und RNG |
| Steuerung | Entfernte Desktop-Kamerapfade/Rechteckauswahl/Kontrollgruppen/Shift-Funktionen/Hotkeys, Touch-Auswahl/Doppel-/Dreifachtippen mit Typ-/Combat-Filter, Zeitgrenze und Gestenabbruch, Touch-Ziehen/Pinch/Limits, Kameraknöpfe/Minimap, Gestenabbruch, Befehls-/Menübuttons, drei Reiter ohne Forschung, sieben normale Bauaktionen, Auswahl ohne Armor-Forschungslevel, Cancel für alle Zielmodi, Pausenschutz, Gebäude-Panel/Randbegrenzung/Kameraleiste/Buttonstatus/Verkaufsbestätigung, entferntes Tooltip-System, zugängliche Buttonnamen ohne `title`, Hinweise und Home-/Neustart-Aktionen ohne Kampagne, kostenlose permanente Upgrades/Maximalstufen/Persistenz |
| Renderer | Shader-Quellvertrag, MSAA-Allokation/Resolve/Resize/Fallback mit WebGL-Testdouble |

Keine Migrationstests, alten Operations-Fixtures oder Layout-Kompatibilitätsadapter. Spielstandtests prüfen den aktuellen Stand, nicht ältere Versionen. Feste Terrain-/Effekt-/RNG-Erwartungen werden weiterhin nicht zur Reparatur fehlgeschlagener Tests neu erzeugt.

## Aktueller Prüfstand

Nachtrag: Auch der äußere 1px-Deckrahmen und die Spaltentrennlinien sind entfernt. 170 Node-Tests und die nachfolgend beschriebene Fünf-Größen-`file://`-Touch-Probe erneut bestanden; Portrait-Screenshot betrachtet, keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Logs: `/tmp/meridian-deck-borderless-tests.log`, `/tmp/meridian-deck-borderless-browser.log`. Weiterhin kein Echtgerät-Nachweis.

Nach randbündigem Deck und flächenfüllender Minimap: **170 Node-Tests bestanden**, vollständiger obiger Befehl. Keine Fixtures neu erzeugt; alle Terrain-/Welt-/Effekt-Zeichenreferenzen und fünf weiterhin passenden Effekt-/RNG-Fälle unverändert. Der frühere kombinierte Waffenfall mit Avatar entfällt; normale Waffen werden separat geprüft. [Referenzabgrenzung](reference-tests.md).

Aktuelle Layoutänderung nur in `styles.css`: Deck links/rechts/unten ohne Außenabstand; Minimap ohne Padding oder eigenen Innenrahmen, mit 100 % Breite/Höhe ihrer Spalte. Alte feste Canvas-Maße und Abstandsausnahmen an den Breakpoints entfernt. Deckhöhen, Spaltenaufteilung, Auswahl-Sichtbarkeit, Aktionen und Produktion bleiben unverändert. Der dunkle Hintergrund liegt auf der Minimap-Spalte statt dem Canvas; eine im ersten Chromium-Portraitcheck beobachtete zusätzliche Fehlfläche oben links trat damit im abschließenden Check nicht mehr auf.

Aktueller Chromium-152-Headless/CDP-Check direkt über `file://`, Performance, frisches Profil, ohne abgeschwächte Sicherheitsflags: 960×600, 844×390, 390×844, 1280×800 und 1700×960. Deckkanten am Viewport und lückenlose Canvas-Ausdehnung innerhalb der Spaltenrahmen per DOM-Messung bestätigt. Native Minimap-Taps auf Mitte/Ecke und Drag bis zum Kameralimit ohne Einheitenbefehle; außerdem Attack-move/Worker-Bewegung, Fähigkeiten/Rally/Bau-Cancel und unveränderte Rekrutierung geprüft. Queue-Abbruch per Touch im Querformat, per API im weiterhin ausgeblendeten Portrait-Queuebereich. Abschließende Screenshots 844×390 und 390×844 betrachtet; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. `git diff --check` bestanden. Probe `/tmp/meridian-deck-flush-check.cjs`, Logs `/tmp/meridian-deck-flush-browser.log` und `/tmp/meridian-deck-flush-tests.log`. Kontrolliertes Setup mit angehaltener Simulation und programmatischer Auswahl; keine Echtgeräte-, andere Browser-/Qualitätsstufen- oder Langzeitprüfung.

Vorherige Deck-Bereinigung: Minimap-Titel/-Kartenname/-Statuszeile, Selection-Überschrift/Leertext, redundante Gruppen-/Gebäude-/Produktionsmeldungen und Reiter-Zusatztexte entfernt. Die sechs Buttons Attack-move, Move, Hold, Stop, Combat force und Next worker samt UI-Aktionspfaden sind gelöscht. Boden-Taps erteilen Attack-move, für Worker in der Simulation zu normaler Bewegung umgewandelt; gemeinsame Formation und Ziel-Kontextbefehle bleiben erhalten. Die Simulation kennt weiterhin ihre regulären Move-/Hold-/Stop-Aufträge. Die beiden expliziten Bewegungs-Zielmodi entfallen; Cancel bleibt für Bau, Rally und vier Fähigkeiten. Layout, Reiter, Fähigkeitszugriff und Rekrutierungs-/Queue-Zuordnung bleiben ansonsten unverändert; keine globale Queue implementiert.

Vorheriger Chromium-152-Headless/CDP-Check direkt über `file://`, Performance, frisches Profil, ohne abgeschwächte Sicherheitsflags: bei 960×600, 844×390 und 390×844 per Touch gemischte Auswahl auf Boden befohlen (Kampfeinheit Attack-move, Worker Move), Minimap-Navigation, alle vier Fähigkeiten/Rally/Bau mit Cancel, Rekrutierung und Rückerstattung geprüft. Rekrutierung einer Rifle-Einheit bei ausgewähltem HQ erfolgt weiterhin über eine Kaserne. Queue-Abbruch im Querformat per Touch; bei 390px Breite bleibt die Queue durch bestehendes CSS verborgen, dort nur über die Simulations-API abgebrochen. Screenshots 960×600 und 390×844 betrachtet. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Logs `/tmp/meridian-deck-cleanup-tests.log` und `/tmp/meridian-deck-cleanup-browser.log`, Probe `/tmp/meridian-deck-cleanup-check.cjs`. Kontrolliertes Setup mit angehaltener Simulation und programmatischer Auswahl; kein Echtgerät-, Langzeitkampf- oder erneuter Dreifachtap-Browsernachweis. `git diff --check` bestanden.

Vorheriger Chromium-`file://`-Touch-Check: Gefechtswahl/Start ohne Schwierigkeitsauswahl, Feld oder HUD-Label; Gratis-Upgrades, Bau-Cancel, Reparaturauftrag/×, Produktion, Version-3-Save/Load, Verkauf, Sieg/Neustart/Niederlage/Retry. 960×600; Gefechtsstart/Home zusätzlich 844×390 und 390×844. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrolliertes Setup, Performance, kein Echtgerät. Zusätzlich entsprechen Zustand, Effekte und Folge-RNG nach 120 Sekunden für drei Fraktionen exakt dem vor der Änderung aufgezeichneten Standard-Verhalten (ohne Schema-/Schwierigkeitsfeld). [Prüfung und Grenzen](difficulty-removal.md).

Vorheriger gezielter Chromium-`file://`-Touch-Check bei 960×600, Performance: Einzel-/Doppel-/Dreifachtap auf dieselbe Einheit wählt eine Einheit, ihren Typ, dann gemischte Combat-Einheiten ohne Worker; kein Befehl, Zeitablauf setzt zurück. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch-Ereignisse wurden zeitversetzt eingereiht; kein Echtgerät- oder zuverlässiger Timing-Nachweis. [Details und Grenzen](mobile-triple-tap.md).

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
- Boden-Taps mit Kampfeinheiten, Workern und gemischten Gruppen prüfen: Attack-move nur für Nicht-Worker, normale Bewegung für Worker; Ziel-Taps auf Gegner/Rohstoffe behalten ihre Kontextbefehle. Bauplatzierung, Sammelpunkt und alle vier Fähigkeiten aktivieren und per Cancel abbrechen: kein Verbrauch, keine Befehle, kein versehentliches Platzieren. Spiel-Hotkeys dürfen keine eigenen Aktionen auslösen; native Browser-/Formularbedienung bleibt möglich.
- Regulärer Gebäudebau mit einem Arbeiter; keine Bauhilfe durch weitere Arbeiter und kein Weiterbau durch Reparatur. Reparatur fertiger beschädigter Ziele prüfen.
- Ein fertiges eigenes Gebäude antippen: Repair schickt genau den nächsten Arbeiter, Stop bricht ab, ohne Arbeiter/Alloy und bei voller Hülle gesperrt. Sell/Keep/Bestätigung, 50-%-Gebäudeerstattung plus volle offene Rekrutierung, letztes fertiges HQ, Versorgungsverlust und aktuelle Checkpoints prüfen. Panel an kleinen Bildschirmrändern erreichbar, Kamera-/Hilfe-Buttons frei; bei Auswahl von Fundamenten/Einheiten/mehreren Objekten, Zielmodus und Pause ausgeblendet.
- Nur Command/Build/Recruit und sieben baubare Gebäude; keine Forschung, kein Labor und keine Missionsgeneratoren. Keine Kampagnenauswahl, Sondermodi, Missionsobjekte oder Sterne. Neues Gefecht mit Fraktions-/Gegner-/Biom-/Seed-Wahl ohne Schwierigkeitseinstellung starten: Sieg bei zerstörtem Gegner-HQ, Niederlage beim letzten eigenen HQ. Neustart und Home prüfen.
- Fleet Upgrades kostenlos bis Stufe 3 kaufen: keine Credit-Abbuchung oder Ergebniswährung; Stufen speichern und im nächsten Gefecht wirksam, laufendes/geladenes Gefecht unverändert. Gefechts-Alloy/Aether bleiben begrenzt. Version-3-Checkpoint laden; ältere Checkpoints werden nicht übernommen.
- Keine Beschreibungs-/Browser-Tooltips bei Aktions-, Kamera-, Porträt- und Produktionsbuttons; zugängliche Namen erhalten. Porträtauswahl, Produktionsabbruch mit Rückerstattung, sichtbare Kosten und Warn-/Toast-Rückmeldungen prüfen.
- Qualität wechseln, Fenstergröße ändern; Einheiten, Effekte und HUD prüfen.
- Aktuellen Spielstand speichern/laden, Backup exportieren/importieren.
- Audio tatsächlich anhören; Audio-API-Prüfungen ersetzen keinen Hörtest.

Node führt kein GLSL aus und prüft weder echte Browser-Eingaben noch GPU-Rasterisierung. Andere Browser/Grafikhardware, vollständige Gefechte und systematische Performance-/Balancingprüfungen bleiben separat zu testen. Alte Spielstände sind ausdrücklich kein Kompatibilitätsziel.
