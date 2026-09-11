# Spiel und Bedienung

## Gefecht und Fortschritt

- Ein wiederholbares Ziel: gegnerisches HQ zerstören. Verlust aller eigenen HQs bedeutet Niederlage, auch bei gleichzeitiger Zerstörung beider Seiten. Kommandantenverlust allein beendet das Gefecht nicht.
- **New battle** wählt eigene Fraktion, Gegner, Biom und Seed. Vorgaben: Fraktion 0 gegen 2, Ash, zufälliger Seed. Drei Fraktionen, sieben baubare Gebäude, sieben Einheitentypen; normale Bau-/Produktionsvoraussetzungen gelten.
- Kein Aufklärer mehr in Katalog, Startaufgebot, Vorschau oder Wellen. Sein bisheriger Wellenanteil fällt auf Rifle; Startversorgung sinkt um 2. Ein reserviertes Start-RNG-Sample schützt die Kristallmengen. Keine Kampagne, Sondermodi, Missionsobjekte, Ingame-Forschung oder Schwierigkeitseinstellung. Fraktionsboni/-schilde, Veteranenstatus nach fünf Abschüssen und Star-Biom-Eruptionen bleiben erhalten.
- Provisorisches Spieleraufgebot: HQ, Kaserne, Raffinerie, Fabrik, zwei Depots; Kommandant, fünf Worker, sieben Rifle, zwei Medics, zwei Tanks. Gegner: HQ, zwei Türme, Kaserne, Fabrik, fünf Rifle, Artillerie, Tank. Noch kein fertiges Roguelite-Balancing.
- Feste Startressourcen: 1100 Alloy / 400 Aether plus permanente Boni. Erste Welle nach 95 s; danach Abstand `80 × max(0.68, 1 − wave × 0.01)` s. Wellenzielgröße `min(24, ceil(6.75 + wave × 0.65))`, zusätzlich durch Budget und Einheitenlimit begrenzt. Wellen kommen vom Gegner-HQ und enden mit dessen Verlust.
- **Fleet Upgrades**: kostenlos bis Stufe 3, gespeichert und nur in neue Gefechte kopiert. Veterans: Infanterie; Stores: +100 Start-Alloy/Stufe; Logistics: Worker; Command: Energieregeneration; Resolve: Kommandantenhülle; Industry: Rekrutierungstempo. Laufende/geladene Gefechte bleiben unverändert; Neustart übernimmt aktuelle Upgrade-Stufen.
- Kein gespeichertes `Infinity`, keine erspielte Upgrade-Währung und keine Ergebnisbelohnung. Score ist nur Statistik; Alloy/Aether im Gefecht bleiben begrenzt.

## Touch und HUD

- Kamera: Fingerziehen, Pinch, Zoom-/Basisknöpfe und Minimap-Tap/-Drag. X/Z-Grenzen −72 bis 72, Zoom 32 bis 115.
- Einfacher Tap wählt; Doppeltap auf dieselbe eigene Einheit wählt sichtbare eigene Einheiten ihres Typs; Dreifachtap sichtbare eigene Nicht-Worker, einschließlich Support und Kommandant. Ein Worker kann die Folge auslösen, gehört aber nicht zur Combat-Auswahl. Gebäude/Gegner lösen diese Gruppengeste nicht aus; Maus-Dreifachklick bleibt typgebunden.
- Jeweils **weniger als 330 ms zwischen Releases**. Weitere schnelle Taps halten die Combat-Auswahl. Andere Ziele/Zeigerarten, Pan, Pinch, Abbruch, Boden-/Zielauftrag und Start/Load unterbrechen die Folge. Sichtfilter: projizierter Mittelpunkt innerhalb der Bildschirmbreite und zwischen tatsächlicher Topbar-Unterkante und Fähigkeitenleiste; keine zusätzliche Verdeckungsprüfung.
- Boden-Taps mit Auswahl erteilen Attack-move, für Worker normale Bewegung; gemeinsame Formation bleibt erhalten. Ziel-Taps auf nicht-eigene Objekte nutzen Kontextbefehle, z. B. Angriff oder Worker-Abbau. Eigene Ziele werden ausgewählt. Neue Befehle ersetzen den aktuellen Auftrag, keine Befehlswarteschlangen.
- **Cancel** beendet Bauplatzierung, Rally- oder Fähigkeitszielwahl ohne Aktion/Verbrauch. Erfolgreiche Anwendung beendet den Modus; gescheiterte Platzierung erlaubt einen weiteren Versuch.
- **Ausschließlich Mobile-Portrait:** randbündiges Deck, links Minimap auf 50 % der Bildschirmbreite, rechts ein vertikal scrollbarer Menübereich. Vier Startschaltflächen: **Gebäude / Infanterie / Fahrzeuge / Flugzeuge**. Untermenüs ersetzen die Startschaltflächen am selben Ort; **Zurück** kehrt ohne Abwahl zurück und beendet Zielauswahl. Keine separate Auswahl-/Statistikspalte.
- Infanterie: Worker, Rifle, Medic, Kommandant; Fahrzeuge: Tank, Artillerie; Flugzeuge: Air. Alle Fraktionen verwenden dieselbe Einteilung, mit ihren eigenen Namen/Kosten. Bau-/Rekrutierungsbedingungen bleiben wirksam.
- Orbital strike, Repair field, Recon scan und Reinforcements stehen unabhängig von Auswahl/Menü in der dauerhaften Leiste direkt über dem Deck. Energie und Cooldowns begrenzen die Nutzung; keine HQ-Bindung. Rally point steht bei fertigen eigenen Gebäuden, Command view entfällt (Basiskameraknopf bleibt).
- Entfernt: Steuerungsfußleiste, dekorative Deck-Texte und Buttons Attack-move, Move, Hold, Stop, Combat force, Next worker. Die Simulation kennt weiterhin reguläre Bewegungs-/Hold-/Stop-Aufträge.
- Keine Spiel-Hotkeys, Desktop-Kameragesten, Rechteck-/Shift-Auswahl, Kontrollgruppen oder Beschreibungs-/Browser-Tooltips. Native Browserbedienung, zugängliche Buttonnamen, Kosten, Fortschritt, Handbuch, Meldungen und Welt-/CSS-Hover bleiben erhalten. Rechtsklick bleibt vorerst für Kontextbefehle verfügbar.

## Bau und Produktion

- Bau weist genau einen Worker zu. Keine Bauhilfe, automatische Nachbesetzung oder Weiterbau durch Reparatur. Verlassene Fundamente bleiben stehen; **Cancel build** erstattet 75 %. Das ist nicht der Cancel-Button vor der Platzierungsbestätigung.
- Rekrutierung ist unabhängig vom ausgewählten Gebäude. `train(type)` weist den Auftrag der kürzesten passenden Queue zu (Gleichstand: Gebäude-ID). **Eine Queue je fertigem Produktionsgebäude**, maximal fünf Aufträge, parallele Produktion und Spawn am zugewiesenen Gebäude. Worker/Kommandant kommen weiterhin aus dem HQ, Rifle/Medic aus der Kaserne, Fahrzeuge aus der Fabrik und Air aus dem Hangar. Keine automatische Umbuchung bestehender Aufträge.
- Einheiten derselben Höhenebene halten Abstand, auch im Stand und zu Gegnern. Spawn sucht einen freien Platz neben dem Ausgang; ohne Platz bleibt der bezahlte Auftrag fertig in der Queue. Bewegung weicht Einheiten aus; untätige Verbündete dürfen auf freie Stellen zur Seite rücken. Formationen berücksichtigen ihre Größe und Truppen können neben einem belegten Rallyziel anhalten. Flugzeuge dürfen über Bodentruppen stehen, aber nicht ineinander.
- Links über Minimap/Fähigkeitenleiste steht pro beauftragtem Einheitentyp ein Symbol, vertikal gestapelt und bei Platzmangel scrollbar. Der Zähler umfasst aktive und wartende Aufträge aller eigenen Gebäude. Das helle Overlay läuft im Uhrzeigersinn ab und zeigt bei paralleler Produktion die nächste Fertigstellung dieses Typs; reine Warteaufträge haben noch keinen Fortschritt. Pause/Load folgen dem Simulationszustand.
- Tap auf ein Queue-Symbol storniert einen Auftrag: zuerst einen möglichst weit hinten wartenden, sonst den am wenigsten fortgeschrittenen aktiven Auftrag. Vollständige Erstattung der gespeicherten Rekrutierungskosten. Offene Aufträge reservieren weiterhin Versorgung.
- Worker bauen automatisch Alloy ab und liefern es am HQ ab. Raffinerien benötigen einen Vent in Reichweite, keinen zugewiesenen Worker. Fünf getrennte Alloy-Vorkommen je Standort; am östlichen Standort bleibt Platz zur Startfabrik.

## Gebäudeaktionen

- Auswahl eines einzelnen fertigen eigenen Gebäudes ersetzt das rechte Menü durch **Sell**, **Repair / Stop repair** und **Rally point**. Fundamente zeigen stattdessen **Cancel build**. Fremde Gebäude, Einheiten und Mehrfachauswahl öffnen keine Gebäudeaktionen. Nach Fertigstellung/Verlust aktualisiert sich das Menü.
- Kein schwebendes Panel oder ×; Kameraentfernung schließt das feste Menü nicht. **Zurück** zeigt die Kategorien, ausdrückliche Neuauswahl wieder die Gebäudeaktionen. Verkauf bleibt ein separater Bestätigungsdialog; Pause/Ergebnis sperren Spielaktionen. Rally ist ausschließlich über **Rally point** und anschließende Zielbestätigung setzbar; Produktionsgebäude verwenden den Punkt beim Spawn. Normale Boden-Taps/-Klicks wählen ein Gebäude nur ab, ohne den bestehenden Rallypoint zu verändern. Auch Kontext-/Bewegungsbefehle setzen keinen Rallypoint mehr. Minimap-Tap/-Drag navigiert weiterhin; Minimap-Rechtsklick wählt das Gebäude ab.
- Repair schickt den nächsten lebenden eigenen Worker nach Luftlinienentfernung, auch wenn er beschäftigt ist. Kein Sofortheilen. Erst am Ziel: 38 HP/s für 0,1 Alloy/HP. Start gesperrt ohne Worker, bei voller Hülle oder Alloy ≤ 0,1. Stop beendet die laufenden eigenen Worker-Reparaturen dieses Gebäudes.
- Vorherige Worker-Aufträge werden ersetzt, nicht wieder aufgenommen. Das kann Bau unterbrechen. Keine Nachbesetzung bei Tod; die normale Abbau-Automatik bleibt erhalten.
- Sell pausiert zur Bestätigung und bleibt an die ursprüngliche Gebäude-ID gebunden. Erstattung: 50 % des gezahlten Gebäudepreises (Startgebäude: Normalpreis), plus 100 % aller offenen Rekrutierungen. Bruchteile bleiben erhalten, keine HP-Abwertung.
- Verkauf entfernt das Gebäude, Queue und Navigationshindernis, gibt Raffinerie-Vent/Reparaturarbeiter frei; keine Kampftötung, Explosion, Statistik- oder RNG-Effekte. Truppen bleiben trotz gesunkener Versorgung bestehen. Das letzte fertige eigene HQ ist geschützt; ein unfertiger Ersatz genügt nicht.
- Reparaturaufträge, Kaufbelege und Gebäude-Queues reichen für die Speicherung; Menüs und Bestätigungen sind flüchtig.

## Offen, nicht zur Umsetzung freigegeben

- Weitere Gebäudeaktionen und sonstige UI-Vereinfachung erst nach Auftrag. Manche unveränderten Topbar-/Kameraknöpfe sind weiterhin klein; Querformat/Desktop werden nicht optimiert.
- Einheitenreparatur per Touch festlegen, dann Rechtsklickpfade bereinigen; Welt-Hover und Zielvorschauen weiter prüfen.
- Separate erspielbare Upgrade-Ressource, Gebäude-Freischaltungen und deutlich härtere Startbasis fehlen. Keine Übertragung entfernter Forschungsboni vereinbart.
- Bekannter Pausenmenüablauf: Load-Verfügbarkeit wird beim Öffnen ermittelt; nach dem ersten Save gegebenenfalls Menü erneut öffnen. Echtgerätebedienung, Tap-Timing unter Last und Langzeitbalancing sind nicht belegt.
