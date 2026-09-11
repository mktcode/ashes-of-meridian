# Mobile-Kamera: Desktop-Code entfernt

Erster Umsetzungsschritt aus der [Desktop-Bestandsaufnahme](mobile-desktop-inventory.md). Fokus ist das Entfernen unnötiger Desktop-Kamerasteuerung, nicht ein neues Touch-System oder HUD-Layout.

Dieser Bericht beschreibt den damaligen Schritt. Die hier noch erhaltenen Maus-Rechteckauswahl, Shift-Auswahl, Kontrollgruppen und Auftragsketten wurden anschließend separat entfernt: [Auswahl-/Befehlsbereinigung](mobile-selection-cleanup.md). Aktueller Gesamtprüfstand: [testing.md](testing.md).

## Änderungen

- WASD-Kamerabewegung einschließlich gehaltenem Tastensatz, `keyup`-Listener und zugehörigen Reset-Aufrufen entfernt.
- Edge Scrolling aus dem UI-Tick und den Einstellungen entfernt.
- Mausrad-Zoom und Kameraziehen mit mittlerer Maustaste im Hauptspielfeld entfernt. Die mittlere Taste wird dort bereits beim Drücken ignoriert, damit sie nicht versehentlich Auswahl oder Befehle auslöst.
- Leertaste/Home als Kamerakürzel und das Zentrieren beim doppelten Kontrollgruppenaufruf entfernt. Dadurch entfallen auch `lastGroup` und die nur von diesen Kürzeln verwendete Methode `centerSelection()`.
- Profilvorgabe `edge` und die bereits ungenutzte Vorgabe `cameraSpeed` entfernt. Keine Migration, kein Legacy-Adapter und keine Änderung der allgemeinen Behandlung unbekannter Profileinstellungen.
- Kamera-Hinweise in HTML, Live-Steuerungsleiste, Handbuch und Basis-Schaltflächen angepasst; README und aktuelle Dokumentation nachgezogen. Der alte WASD-Bericht ist als historisch markiert.

Betroffene Quellen: `ui.js`, `index.html`, `persistence.js`.

## Bewusst unverändert

- Ein-Finger-Ziehen und seine Bewegungsschwelle; Pinch-Zoom mit bisheriger Berechnung.
- Kameragrenzen von −72 bis 72 für X/Z, Zoomgrenzen von 32 bis 115.
- Zoom-/Basisknöpfe, Command-view-Aktion, Minimap-Navigation und Zielanwendung über die Minimap.
- Gemeinsame Pointer-Events und bereits vorhandene Touch-Auswahl/-Befehle.
- Automatische Kamerazentrierung der Arbeiterauswahl, die auch über eine Schaltfläche erreichbar ist.
- Übrige Desktop-Befehle, insbesondere Rechtsklick, Auswahlrechteck, Shift, Kontrollgruppenauswahl und Nicht-Kamera-Hotkeys. Deren Bereinigung bleibt ein eigener Schritt.
- Layout, Gameplay, Balancing, Assets, Hindernisverteilung und RNG-Aufrufreihenfolge.

## Prüfungen

### Automatisiert

Der vollständige Befehl aus [testing.md](testing.md#automatisierte-tests), mit 128-MB-Heap und einem Testworker: **125 Tests bestanden**.

`tests/ashes-of-meridian-controls.check.cjs` prüft jetzt statt der alten WASD-Bewegung:

- Kamera bleibt bei entfernten Kameratasten und Zeigerpositionen am Spielfeldrand unverändert.
- Kein Mausrad-/Tastenfreigabe-Listener; mittlere Maustaste im Hauptspielfeld ohne Kamera-, Auswahl- oder Befehlswirkung.
- Gruppenabruf wählt weiterhin aus, aber zentriert nicht mehr.
- Touch-Ziehen, Kamera-Limits, Pinch und Zoom-Limits; keine Befehle beim Loslassen nach diesen Gesten.
- Touch-Tap-Befehl, Pause sowie vorhandene Cancel-/Blur-Schutzpfade.
- Zoom-/Basisknöpfe und Minimap-Antippen/-Ziehen über die gebundenen Handler.
- Verbleibende Hotkeys, Fokus/Modifier, Home-Menü und aktualisierte Kamera-Texte.

Die Tests verwenden DOM-/Renderer-Testdoubles, aber die reale `clamp`-Implementierung und UI-Eingabelogik. Profiltests erwarten die bereinigten Vorgaben. Feste Layout-/Effekt-/RNG-Referenzen wurden nicht geändert.

### Browser unter `file://`

Chromium `152.0.7977.75`, Linux/headless, frisches temporäres Profil, keine abgeschwächten Sicherheitsflags. Direkter Dateistart ohne Server. Temporäre CDP-Probe: `/tmp/meridian-mobile-camera-check.cjs`.

Bei 960×600 mit Touch-Emulation geprüft:

- Spielstart und WebGL-2-Kontext.
- Über Browser-Eingabeereignisse zugestellte Tastatur-, Mausrad-, mittlere-Maustasten- und Randbewegungen verändern die Kamera im Hauptspielfeld nicht.
- Emuliertes Ein-Finger-Ziehen und Zweifinger-Pinch verändern Position beziehungsweise Zoom; keine unbeabsichtigten Spielbefehle, Gestenzustand nach Loslassen aufgeräumt.
- Zoom-/Basisknöpfe sowie Minimap-Antippen und -Ziehen mit Touch-Ereignissen.
- Edge-Einstellung verschwunden; Handbuch beschreibt Touch-Kamera ohne frühere Kamerakürzel.
- Keine erfassten Laufzeit-, Ressourcen- oder Log-Fehler; abschließendes `gl.getError()` war 0.
- Screenshot `/tmp/meridian-mobile-camera.png` gesichtet: HUD und geänderter Kamerahinweis sichtbar. Kein Layout-Redesign und keine umfassende visuelle Prüfung.

Die temporäre Probe und das Bild sind keine eingecheckten Testwerkzeuge. Das Browser-Testprofil wurde entfernt.

**Nicht geprüft:** echte Mobilgeräte oder Fingerbedienung, andere Browser, Hochformat und umfassende Viewport-Abdeckung, hörbares Audio, vollständiger Spielablauf, erneuter Save-/Backup-Browserablauf oder systematische Performanceprüfung. Touch-Emulation ist kein Nachweis für tatsächliche Gerätebedienbarkeit.
