# Spiel und Bedienung

## Gefecht und Fortschritt

- Ein wiederholbares Ziel: gegnerisches HQ zerstören. Verlust aller eigenen HQs bedeutet Niederlage, auch bei gleichzeitiger Zerstörung beider Seiten. Kommandantenverlust allein beendet das Gefecht nicht.
- **New battle** wählt eigene Fraktion, Gegner, Biom und Seed. Vorgaben: Fraktion 0 gegen 2, Ash, zufälliger Seed. Drei Fraktionen, sieben baubare Gebäude, acht Einheitentypen; normale Bau-/Produktionsvoraussetzungen gelten.
- Keine Kampagne, Sondermodi, Missionsobjekte, Ingame-Forschung oder Schwierigkeitseinstellung. Fraktionsboni/-schilde, Veteranenstatus nach fünf Abschüssen und Star-Biom-Eruptionen bleiben erhalten.
- Provisorisches Spieleraufgebot: HQ, Kaserne, Raffinerie, Fabrik, zwei Depots; Kommandant, fünf Worker, sieben Rifle, zwei Medics, zwei Tanks, Scout. Gegner: HQ, zwei Türme, Kaserne, Fabrik, fünf Rifle, Artillerie, Tank. Noch kein fertiges Roguelite-Balancing.
- Feste Startressourcen: 1100 Alloy / 400 Aether plus permanente Boni. Erste Welle nach 95 s; danach Abstand `80 × max(0.68, 1 − wave × 0.01)` s. Wellenzielgröße `min(24, ceil(6.75 + wave × 0.65))`, zusätzlich durch Budget und Einheitenlimit begrenzt. Wellen kommen vom Gegner-HQ und enden mit dessen Verlust.
- **Fleet Upgrades**: kostenlos bis Stufe 3, gespeichert und nur in neue Gefechte kopiert. Veterans: Infanterie; Stores: +100 Start-Alloy/Stufe; Logistics: Worker; Command: Energieregeneration; Resolve: Kommandantenhülle; Industry: Rekrutierungstempo. Laufende/geladene Gefechte bleiben unverändert; Neustart übernimmt aktuelle Upgrade-Stufen.
- Kein gespeichertes `Infinity`, keine erspielte Upgrade-Währung und keine Ergebnisbelohnung. Score ist nur Statistik; Alloy/Aether im Gefecht bleiben begrenzt.

## Touch und HUD

- Kamera: Fingerziehen, Pinch, Zoom-/Basisknöpfe und Minimap-Tap/-Drag. X/Z-Grenzen −72 bis 72, Zoom 32 bis 115.
- Einfacher Tap wählt; Doppeltap auf dieselbe eigene Einheit wählt sichtbare eigene Einheiten ihres Typs; Dreifachtap sichtbare eigene Nicht-Worker, einschließlich Support und Kommandant. Ein Worker kann die Folge auslösen, gehört aber nicht zur Combat-Auswahl. Gebäude/Gegner lösen diese Gruppengeste nicht aus; Maus-Dreifachklick bleibt typgebunden.
- Jeweils **weniger als 330 ms zwischen Releases**. Weitere schnelle Taps halten die Combat-Auswahl. Andere Ziele/Zeigerarten, Pan, Pinch, Abbruch, Boden-/Zielauftrag und Start/Load unterbrechen die Folge. Sichtfilter: projizierter Mittelpunkt `0 < x < innerWidth`, `55 < y < innerHeight − 210`; keine zusätzliche Verdeckungsprüfung.
- Boden-Taps mit Auswahl erteilen Attack-move, für Worker normale Bewegung; gemeinsame Formation bleibt erhalten. Ziel-Taps auf nicht-eigene Objekte nutzen Kontextbefehle, z. B. Angriff oder Worker-Abbau. Eigene Ziele werden ausgewählt. Neue Befehle ersetzen den aktuellen Auftrag, keine Befehlswarteschlangen.
- **Cancel** beendet Bauplatzierung, Rally- oder Fähigkeitszielwahl ohne Aktion/Verbrauch. Erfolgreiche Anwendung beendet den Modus; gescheiterte Platzierung erlaubt einen weiteren Versuch.
- Deck ohne Außenabstand, Außenrahmen oder Spaltentrennlinien; Minimap füllt ihre Spalte. Reiter bleiben **COMMAND / BUILD / RECRUIT**. Fähigkeiten Orbital strike, Repair field, Recon scan und Reinforcements sowie Rally point und Command view sind weiterhin allgemein im COMMAND-Reiter verfügbar, noch nicht HQ-gebunden.
- Entfernt: Steuerungsfußleiste, dekorative Deck-Texte und Buttons Attack-move, Move, Hold, Stop, Combat force, Next worker. Die Simulation kennt weiterhin reguläre Bewegungs-/Hold-/Stop-Aufträge.
- Keine Spiel-Hotkeys, Desktop-Kameragesten, Rechteck-/Shift-Auswahl, Kontrollgruppen oder Beschreibungs-/Browser-Tooltips. Native Browserbedienung, zugängliche Buttonnamen, Kosten, Fortschritt, Handbuch, Meldungen und Welt-/CSS-Hover bleiben erhalten. Rechtsklick bleibt vorerst für Kontextbefehle verfügbar.

## Bau und Produktion

- Bau weist genau einen Worker zu. Keine Bauhilfe, automatische Nachbesetzung oder Weiterbau durch Reparatur. Verlassene Fundamente bleiben stehen; **Cancel build** erstattet 75 %. Das ist nicht der Cancel-Button vor der Platzierungsbestätigung.
- Rekrutierung zeigt derzeit alle produzierbaren Typen unabhängig von der Auswahl. `train(type, preferred)` bevorzugt ein passendes ausgewähltes Gebäude, weicht aber auf ein anderes geeignetes mit freier Queue aus. **Warteschlangen sind weiterhin je Gebäude**, maximal fünf Aufträge, mit paralleler Produktion.
- Queue-Anzeige sammelt offene Aufträge aller eigenen Gebäude, die ausgewählte Queue zuerst. Abbrechen erstattet gespeicherte Rekrutierungskosten vollständig. Versorgung wird bereits durch offene Aufträge reserviert.
- Worker bauen automatisch Alloy ab und liefern es am HQ ab. Raffinerien benötigen einen Vent in Reichweite, keinen zugewiesenen Worker. Fünf getrennte Alloy-Vorkommen je Standort; am östlichen Standort bleibt Platz zur Startfabrik.

## Gebäudeaktionen

- Ein einzelnes fertiges eigenes Gebäude zeigt **Repair / Stop repair** und **Sell** an seiner Weltposition. Nicht bei Fundamenten, fremden Gebäuden oder Mehrfachauswahl; vorübergehend verborgen bei Pause/Dialog/Zielmodus. **×** oder Verlassen des Sichtfelds schließt bis zur ausdrücklichen Neuauswahl, ohne Abwahl/Reparaturabbruch.
- Repair schickt den nächsten lebenden eigenen Worker nach Luftlinienentfernung, auch wenn er beschäftigt ist. Kein Sofortheilen. Erst am Ziel: 38 HP/s für 0,1 Alloy/HP. Start gesperrt ohne Worker, bei voller Hülle oder Alloy ≤ 0,1. Stop beendet die laufenden eigenen Worker-Reparaturen dieses Gebäudes.
- Vorherige Worker-Aufträge werden ersetzt, nicht wieder aufgenommen. Das kann Bau unterbrechen. Keine Nachbesetzung bei Tod; die normale Abbau-Automatik bleibt erhalten.
- Sell pausiert zur Bestätigung und bleibt an die ursprüngliche Gebäude-ID gebunden. Erstattung: 50 % des gezahlten Gebäudepreises (Startgebäude: Normalpreis), plus 100 % aller offenen Rekrutierungen. Bruchteile bleiben erhalten, keine HP-Abwertung.
- Verkauf entfernt das Gebäude, Queue und Navigationshindernis, gibt Raffinerie-Vent/Reparaturarbeiter frei; keine Kampftötung, Explosion, Statistik- oder RNG-Effekte. Truppen bleiben trotz gesunkener Versorgung bestehen. Das letzte fertige eigene HQ ist geschützt; ein unfertiger Ersatz genügt nicht.
- Panel und kleine Schließenfläche sind noch kein fertiges Mobile-Design. Reparaturaufträge, Kaufbelege und Queues reichen für die Speicherung; Bestätigungen/Schließzustand sind flüchtig.

## Offen, nicht zur Umsetzung freigegeben

- **Rekrutierung und Deck-Neugestaltung warten auf Entscheidung des Nutzers.** Globale Warteschlangen und Reiter nach Einheitentyp sind in Diskussion, nicht implementiert. Keine gebäudegenau erzwungene Rekrutierung einführen.
- Auswahlbereich bleibt bei Breite ≤ 850 px ausgeblendet, Queue bei ≤ 600 px; viele HUD-Bedienelemente sind klein. Kompakte mobile Darstellung aller Bereiche nebeneinander ist noch offen.
- HQ-gebundene Fähigkeiten, gebäudebezogene Rally-Anzeige und Zugang zum Baumenü sind noch nicht umgestellt. Reinforcements soll erhalten bleiben.
- Einheitenreparatur per Touch festlegen, dann Rechtsklickpfade bereinigen; Welt-Hover und Zielvorschauen weiter prüfen.
- Separate erspielbare Upgrade-Ressource, Gebäude-Freischaltungen und deutlich härtere Startbasis fehlen. Keine Übertragung entfernter Forschungsboni vereinbart.
- Bekannter Pausenmenüablauf: Load-Verfügbarkeit wird beim Öffnen ermittelt; nach dem ersten Save gegebenenfalls Menü erneut öffnen. Echtgerätebedienung, Tap-Timing unter Last und Langzeitbalancing sind nicht belegt.
