# Mobile-Auswahl: Rechteckauswahl, Kontrollgruppen und Auftragsketten entfernt

Zweiter Schritt aus der [Desktop-Bestandsaufnahme](mobile-desktop-inventory.md), nach der [Kamera-Bereinigung](mobile-camera-cleanup.md).

Dieser Bericht beschreibt den damaligen Stand. Anschließend wurden Spiel-Hotkeys und Bauhilfe entfernt und Touch-Abbrechen ergänzt: [Touch-Befehle](mobile-touch-controls.md). Die unten beschriebene Bauhilfe ist nicht mehr Teil des aktuellen Spiels.

## Umsetzung

- Maus-Rechteckauswahl und deren Canvas-Darstellung entfernt. Ziehen mit der linken Maustaste verändert weder Auswahl noch Befehle; ein einfacher Klick bleibt über die gemeinsame Pointer-Verarbeitung möglich.
- Touch-Einzelauswahl und Doppeltippen zur Auswahl sichtbarer eigener Einheiten desselben Typs unverändert. Die bestehende 330-ms-Schwelle und Bildschirmfilterung bleiben erhalten.
- Shift-Hinzufügen/-Entfernen in der Auswahl entfernt, auch bei Einheitenporträts. `select(ids)` ersetzt die Auswahl weiterhin mit deduplizierten, gültigen IDs.
- Kontrollgruppen vollständig entfernt: keine Ziffern-/Ctrl+Ziffern-Verarbeitung, keine `groups`-Vorgabe im Operationszustand.
- Befehls-Auftragsketten vollständig entfernt: kein `orders`-Feld an Entitäten, kein Append-Parameter in `command()`/`setOrder()`, keine Folgeauftrags-Verarbeitung in `finishOrder()` und keine gezeichneten Folge-Wegpunkte.
- Neue Befehle ersetzen den aktuellen `order` und setzen wie bisher Ziel-/Navigationszustand zurück. Nach Abschluss wird die Einheit untätig; bestehende automatische Verhaltensweisen wie Arbeiter-Abbau bleiben erhalten.
- Shift beeinflusst Zielbestätigung nicht mehr: Erfolgreiche Anwendung beendet den Modus, erfolglose Platzierung erlaubt weiterhin einen neuen Versuch.
- Handbuch, Steuerungsleiste, leere Auswahlansicht und Attack-Move-Tooltip angepasst. Keine neuen Auswahlbuttons.

Quellen: `ui.js`, `simulation.js`, `index.html`. Keine Migration oder Altspielstand-Adapter. Aktuell erzeugte Snapshots/Checkpoints enthalten weder Kontrollgruppen noch Auftragsketten.

## Bewusst nicht geändert

- **Produktionswarteschlangen** (`queue`), Rekrutierung, Forschung und Sammelpunkte sind keine Befehls-Auftragsketten und bleiben bestehen.
- Rechtsklick-Kontextbefehle im Spielfeld und auf der Minimap bleiben vorerst erhalten. Übermittlung erfolgt nun ohne Append-Option.
- Touch-Kamera, Pinch-Zoom, Kamera-/Minimap-Schaltflächen und übrige Hotkeys bleiben erhalten.
- Die vorhandene Aktion „Combat force“ bleibt bestehen; ein eigener Button für alle Kampfeinheiten im Bildausschnitt und eine spätere Gestaltung der Auswahlbuttons sind nicht umgesetzt.
- Reparatur und Bauhilfe bleiben unverändert; über ihre Vereinfachung oder Automatisierung wird separat entschieden.
- Keine Änderungen an Balancing, Hindernissen, Kollisionsradien, RNG-Aufrufreihenfolge, Assets oder HUD-Layout.

## Was bedeutete Bauhilfe im damaligen Spiel?

Beim Platzieren eines Gebäudes wählt `build()` bereits einen Arbeiter aus und gibt ihm den Bauauftrag. Ein Kontextbefehl auf ein unfertiges eigenes oder verbündetes Gebäude kann weitere Arbeiter zuweisen (`command()` → `smart` → `build`).

Jeder Arbeiter in Arbeitsreichweite erhöht dessen Baufortschritt um seinen zeitabhängigen Beitrag. Zusätzliche Arbeiter beschleunigen somit den Bau oder können ihn fortsetzen, wenn der ursprüngliche Arbeiter ausfällt. Dafür werden nicht erneut die Gebäudekosten bezahlt; die eingesetzten Arbeiter bauen währenddessen kein Alloy ab.

**Reparatur** betrifft dagegen bereits fertige, beschädigte eigene oder verbündete Ziele: Arbeiter stellen Lebenspunkte wieder her und verbrauchen dabei Alloy. Der gemeinsame Worker-Zweig verarbeitet beide Tätigkeiten. Eine automatische Helferzuteilung oder automatische Reparatur ist in diesem Schritt nicht hinzugekommen.

## Prüfungen

### Node

Vollständiger Pflichtbefehl aus [testing.md](testing.md#automatisierte-tests): **129 Tests bestanden**. Terrain-/Effekt-/RNG-Referenzen unverändert.

Ergänzt beziehungsweise angepasst:

- Keine Wirkung von Kontrollgruppentasten; keine Rechteckzeichnung oder Auswahländerung beim Mausziehen.
- Touch-Einzel-/Doppeltippen einschließlich Typ-, Team- und Bildschirmfilter.
- Auswahlersetzung bei Shift-Klick und Porträtklick; Deduplizierung gültiger IDs.
- Kein Append-Argument aus Spielfeld-/Minimap-Befehlen; Zielmodus endet nach Erfolg, bleibt bei gescheiterter Platzierung offen.
- Sofortige Auftragsersetzung, Navigationsreset und Rückkehr zu `idle` bei Abschluss.
- Aktuelle Snapshots und wiederhergestellte Zustände ohne `groups`/`orders`; Produktionswarteschlangen und Save-Roundtrips weiterhin geprüft.
- Aktualisierte Hinweise; bisherige Touch-Kamera- und übrige Befehlstests weiterhin bestanden.

### Browser unter `file://`

Chromium `152.0.7977.75`, Linux/headless, 960×600, Touch-Emulation, frisches temporäres Profil, ohne Server oder abgeschwächte Sicherheitsflags. Temporäre CDP-Probe: `/tmp/meridian-mobile-selection-check.cjs`.

Erfolgreicher vollständiger Lauf in Qualitätsstufe **Performance**:

- WebGL-2-Start; Kamera-Prüfablauf mit entfernten Desktop-Eingaben, Touch-Ziehen, Pinch, Kameraknöpfen und Minimap erneut bestanden.
- Einzel- und Doppeltippen über Browser-Touch-Ereignisse; Mausziehen zeichnet kein Auswahlrechteck und ändert die Auswahl nicht. Kontrollgruppentasten wirkungslos.
- Shift-bestätigter Bewegungsmodus endet; ein folgender Touch-Befehl ersetzt den aktuellen Auftrag.
- Zwei Produktionsaufträge bleiben in der Warteschlange. Aktueller Checkpoint gespeichert und geladen; keine Kontrollgruppen-/Auftragskettenfelder.
- Handbuch und Steuerungsleiste ohne entfernte Auswahl-/Gruppenhinweise.
- Keine erfassten Laufzeit-, Ressourcen- oder Log-Fehler; abschließendes `gl.getError()` war 0.
- Screenshot `/tmp/meridian-mobile-selection.png` gesichtet: aktualisierte Auswahlhinweise und Produktionswarteschlange sichtbar.

**Einschränkung des Browsernachweises:** Erste Proben mit High-Qualität erreichten die Doppeltipp-Schwelle nicht. Eine instrumentierte Probe zeigte rund 898 ms zwischen den verarbeiteten Touch-Enden, also deutlich mehr als die unveränderten 330 ms. Nach Wechsel auf Performance lagen sie im erfolgreichen Lauf rund 314 ms auseinander. Die Spielschwelle wurde nicht angepasst. Das ist kein Nachweis für zuverlässiges Doppeltippen unter High oder auf echten Geräten.

Die temporären Proben/Bilder sind nicht eingecheckt; Browser-Testprofile wurden entfernt. Nicht geprüft: echte Mobilgeräte, andere Browser/Orientierungen, neue Mechanik-Automatisierung, hörbares Audio, vollständige Missionen, erneuter Backup-Import/-Export oder systematische Performanceanalyse.
