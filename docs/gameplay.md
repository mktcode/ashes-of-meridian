# Spiel und Bedienung

Fachliche Regeln und Bedienkonzept; aktuelle Preise, Stufenwerte und Fraktionsboni stehen im Spiel und in `src/content.ts`, nicht in parallelen Wertetabellen.

## Gefecht und Fortschritt

- **New battle** wählt eigene Fraktion, Gegner und Karte. Jeder Start/Neustart erhält einen zufälligen Seed. Ziel ist das gegnerische HQ; Verlust des letzten eigenen HQs bedeutet Niederlage, auch bei gleichzeitiger Zerstörung beider Seiten. Kommandantenverlust allein beendet das Gefecht nicht.
- Beide Seiten beginnen mit HQ und regulären Startmitteln. Spieler-Upgrades können zusätzliches Alloy und Startworker geben, gelten aber nicht für den Gegner. Ohne Startworker den ersten unter **Infantry** rekrutieren. Das HQ erzeugt keine passiven Rohstoffe: Worker liefern Alloy, fertige Raffinerien an Vents Aether.
- Die KI baut Wirtschaft und Armee über dieselben bezahlten Aktionen auf. Sie besitzt eigene Sicht, erinnert beobachtete Kontakte und klärt auf; keine künstlichen Wellen, Ressourcenboni oder Sichtcheats. Einfache Heuristiken ersetzen keine garantierte Angriffsuhr oder balancierte Schwierigkeit.
- Am Ergebnis wird ungenutzter, auf ganze Einheiten abgerundeter Aether bis zum Evakuierungslimit in die permanente Reserve übertragen, bei Sieg wie Niederlage. Ausgegebener Aether wird nicht evakuiert. **Fleet Upgrades** verbessert Start-Alloy, Startworker und Evakuierungslimit; Käufe wirken erst im nächsten Gefecht bzw. Neustart.
- Ein Sieg mit **Free Marches** schaltet **Verdant Choir** frei; ein anschließender Sieg mit ihr **Veiled Court**. Gegnerwahl ist davon unabhängig. Score ist Statistik, keine weitere Upgrade-Währung.
- Nur Reserve, Upgrades, Freischaltungen und Einstellungen werden gespeichert. **Keine Run-Speicherung:** Pause hält nur die geöffnete Seite an; Tab-Verbergen pausiert ohne automatisches Fortsetzen. Hauptmenü, Reload und Schließen verwerfen das Gefecht. Bei eingeschränktem Browserspeicher bleibt auch das Profil nur flüchtig.
- Ergebnis → Upgrades → Ergebnis ist möglich, ohne erneute Auszahlung. Neustart übernimmt neue Upgrades, gleiche Fraktionen/Karte und einen neuen Seed. Kein Kampagnenmodus, keine Ingame-Forschung oder einstellbare Schwierigkeit.

## Kamera und Befehle

- Fingerziehen, Pinch, Zoom-/Basisknöpfe und Minimap bewegen die Kamera. Tap wählt; Doppeltap auf dieselbe eigene Einheit gruppiert sichtbare eigene Einheiten dieses Typs, Dreifachtap sichtbare eigene Nicht-Worker. Ein Worker kann diese Folge auslösen, gehört aber nicht zur Kampfauswahl. Andere Ziele, Pan/Pinch und Befehle unterbrechen die Folge.
- Boden-Tap mit Auswahl erteilt Bewegung, auch zum Rückzug durch Feindkontakt. Der **Schwerter-Schalter neben ⌂** aktiviert Attack-move: Einheiten halten zum Bekämpfen erreichbarer Gegner an. Worker erhalten weiterhin normale Bewegung. Der Schalter betrifft nur zukünftige Befehle und wird beim Gefechtsstart zurückgesetzt.
- Ziel-Taps verwenden Kontextbefehle, etwa Angriff, Abbau oder Workerarbeit. Neue Befehle ersetzen den aktuellen Auftrag; keine Befehlswarteschlange. Rechtsklick auf Welt/Minimap bleibt für Kontext-/Bewegungsbefehle verfügbar.
- **Cancel** beendet Bau-, Rally- oder Fähigkeitszielwahl ohne Verbrauch. Erfolgreiche Anwendung beendet den Modus, fehlgeschlagene Platzierung erlaubt einen neuen Versuch.
- Keine Spiel-Hotkeys, Rechteck-/Shift-Auswahl oder Kontrollgruppen. Die touchorientierte Bedienung wird nicht durch ein separates Desktop-Steuerungssystem ergänzt.

## HUD und Produktion

Das Deck hält Minimap links, Werkzeuge/Fähigkeiten mittig und Bau-/Rekrutierungsmenüs rechts. **Buildings / Infantry / Vehicles / Aircraft** öffnen Untermenüs in derselben rechten Spalte; **Back** kehrt ohne Abwahl zurück und beendet Zielauswahl. Fähigkeiten benötigen Energie und freie Cooldowns, keine HQ-Auswahl. Tempo lässt sich direkt unter der Uhr ändern, gilt nur für den aktuellen Run und ist bei Pause/Ergebnis gesperrt.

Rekrutierung ist unabhängig vom ausgewählten Gebäude: Der Auftrag geht an die kürzeste passende Produktionsqueue, bei Gleichstand an die kleinere Gebäude-ID. Jede fertige Produktionsstätte produziert selbst; laufende Aufträge werden nicht umgebucht. Einheiten verlassen das Gebäude zu einem reservierten freien Ausgang, bevor sie normale Aufgaben übernehmen. Ein blockierter Ausgang hält den Folgeauftrag in der Queue.

Queue-Symbole über der Minimap aggregieren Aufträge je Einheitentyp. Tap storniert zuerst einen möglichst weit hinten wartenden, sonst den am wenigsten fortgeschrittenen aktiven Auftrag, mit vollständiger Erstattung. Offene Rekrutierungen reservieren Versorgung.

Worker sammeln automatisch entdecktes Alloy und verteilen sich auf Vorkommen; manuelle Zuweisung gilt bis zur Erschöpfung. Raffinerien arbeiten ohne dauerhaft zugewiesenen Worker. Einheiten derselben Höhenebene halten Körperabstand; beladene Worker haben beim Ausweichen Vorrang. Das ist keine allgemeine Engstellen-/Crowd-Garantie.

## Bau und Gebäudeaktionen

- Bau benötigt genau einen freien Worker; Anfahrt zu Bau/Reparatur zählt bereits als belegt, Abbau dagegen als frei. Ohne freien Worker kein Fundament und keine Zahlung.
- Worker auswählen → eigenes Fundament antippen überträgt die Baustelle an genau einen ausgewählten Worker und löst den bisherigen Bauarbeiter ab. Weitere Ausgewählte behalten ihre Aufträge. Keine Mehrarbeiterbeschleunigung oder automatische Wiederaufnahme unterbrochener Arbeit.
- Ein fertiges eigenes Gebäude bietet **Sell**, **Repair / Stop repair** und **Rally point** im rechten Menü, ein Fundament **Cancel build**. Rally wird ausschließlich über die eigene Aktion und Zielbestätigung gesetzt, nicht nebenbei durch Bodenbefehle.
- **Repair** schickt den nächsten freien Worker. Ein ausdrücklicher Worker-Kontextbefehl auf ein beschädigtes eigenes Gebäude oder eine Einheit darf hingegen dessen bisherigen Auftrag ersetzen. Reparatur erfolgt erst am Ziel und kostet Alloy; nach einem Arbeits-Tap bleiben die Worker ausgewählt. Zum normalen Auswählen eines solchen Arbeitsziels erst Worker abwählen.
- **Sell** pausiert zur Bestätigung und bleibt an die ursprüngliche Gebäude-ID gebunden. Verkauf erstattet die Hälfte des gezahlten Gebäudepreises sowie offene Rekrutierungen vollständig; Bauabbruch erstattet drei Viertel. Das letzte fertige eigene HQ ist vor Verkauf geschützt. Truppen bleiben bei nachträglichem Versorgungsverlust bestehen.

Offene Regeländerungen, Gestaltungsaufgaben und Prüfprioritäten stehen ausschließlich in [Issues](issues/), insbesondere [Geräte-/Run-Validierung](issues/playtest-validation.md).
