# Gebäudeaktionen per Touch

## Umsetzung

Ein einzelnes ausgewähltes, fertiges eigenes Gebäude erhält **Repair / Stop repair** und **Sell** direkt über seiner Weltposition. Fundamente, Einheiten, fremde Gebäude und Missionsgeneratoren erhalten diese Aktionen nicht. Bei Mehrfachauswahl, Zielmodus, Pause, Modal oder Operationsende ist das Panel ausgeblendet; außerhalb des sichtbaren Spielfelds wird es geschlossen. **× oben rechts** schließt es ebenfalls, ohne Auswahl oder laufende Reparatur zu ändern. Erst erneutes Auswählen öffnet es wieder, nicht das Zurückbewegen der Kamera. Die Repair-/Sell-Schaltflächen sind mindestens 44 CSS-Pixel hoch, bleiben innerhalb des Spielfelds und weichen der Kamera-/Hilfeleiste aus. Während eines gedrückten DOM-Buttons werden Position und Beschriftung nicht ausgetauscht.

### Reparatur

- **Keine arbeiterlose Reparatur:** Der Knopf weist genau dem nächsten lebenden eigenen Arbeiter nach Luftlinienentfernung den bestehenden Reparaturauftrag zu. Dieser muss zum Gebäude laufen. Ohne Arbeiter, bei voller Hülle oder ohne ausreichend Alloy ist Starten gesperrt; der Grund steht im Panel.
- Erst am Gebäude gelten die unveränderten **38 HP/s und 0,1 Alloy/HP**. Der bisherige Arbeiterablauf beendet den Auftrag bei voller Hülle, fehlendem Ziel oder erschöpften Mitteln; die vorhandene Alloy-Schwelle bleibt `> 0.1`.
- Erneutes Antippen beendet die aktuellen eigenen Arbeiter-Reparaturaufträge an diesem Gebäude. Es sammelt nicht bei jedem Tippen weitere Arbeiter.
- Auch beschäftigte Arbeiter kommen infrage; ihr vorheriger Auftrag wird ersetzt, nicht zwischengespeichert. Das kann einen laufenden Bau unterbrechen. Keine automatische Nachbesetzung bei Tod, keine Wiederaufnahme alter Aufträge und kein Ersatz für die entfernte Bauhilfe. Ein untätiger Arbeiter folgt anschließend seiner bestehenden Abbau-Automatik.
- Keine neue Wegfindung oder Auswahl nach kürzester begehbarer Route. Bestehende Reichweiten, Pfadregeln, Reparatureffekte und deren RNG-Verbrauch bleiben erhalten.

### Verkauf

- Zweistufig: **Sell** öffnet eine pausierende Bestätigung mit Gesamt-Erstattung; **Keep structure** verwirft sie. Die Bestätigung bleibt an die ursprüngliche Gebäude-ID gebunden. Simulation und UI prüfen die Zulässigkeit erneut; doppelte Bestätigung erstattet nichts zusätzlich.
- **50 % des gezahlten Gebäudepreises**, einschließlich Aether. Bei Startgebäuden ohne Kaufbeleg zählt der normale Gebäudepreis. Halbe Ressourceneinheiten bleiben erhalten; keine HP-abhängige Bewertung.
- Alle noch enthaltenen Rekrutierungen einschließlich der aktiven werden abgebrochen und mit ihren gespeicherten Kosten **vollständig zusätzlich erstattet**. Bereits fertiggestellte Einheiten bleiben bestehen.
- Das Gebäude verschwindet sofort, sein Navigationshindernis wird neu berechnet und eine Raffinerie gibt ihren Vent frei. Zugewiesene eigene Reparaturarbeiter werden freigegeben. Keine Kampftötung, Explosion, Verlust-/Kill-Wertung oder zusätzlichen Simulations-RNG-Aufrufe durch den Verkauf.
- Versorgung sinkt gegebenenfalls sofort. Bestehende Truppen bleiben bei Überbelegung erhalten; neue Rekrutierung folgt der bisherigen Versorgungssperre.
- Das **letzte fertige eigene Hauptquartier** ist unverkäuflich. Ein zweites, noch unfertiges Hauptquartier hebt den Schutz nicht auf.
- Fundamente behalten unverändert **Cancel build** mit 75 % Erstattung.

## Abgrenzung und Quellen

`simulation.js` verantwortet Zulässigkeit, Arbeiterauswahl, Auftrag und Erstattung. `ui.js` projiziert das statische Panel aus `index.html`, verwaltet die Verkaufsbestätigung und ruft diese Methoden auf. `styles.css` gestaltet nur die neuen Bedienelemente. Das Handbuch und die Einstiegshinweise sind ergänzt.

Keine neuen persistenten Reparatur-/Verkaufszustände: Der vorhandene Arbeiterauftrag, Kaufbeleg und die Queue reichen aus. Aktuelle Checkpoints behalten Reparaturaufträge und durchgeführte Verkäufe; offene Bestätigungen sind UI-Zustand. Keine Migrationen, Abhängigkeiten, Laufzeit-Imports oder Assetänderungen.

Rechtsklick bleibt vorerst erhalten. Insbesondere die Touch-Bedienung der **Einheitenreparatur** ist noch zu entscheiden. Reparaturfeld, andere bestehende Heil-/Regenerationseffekte, verbündete Ziele und manuelle Kontext-Reparaturen wurden nicht entfernt oder umbalanciert. Weitere Mobile-Bereinigung und Roguelite-Fortschritt bleiben separate Schritte.

## Nachprüfung: Panel schließen

× ergänzt; Verlassen des Sichtfelds schließt dauerhaft bis zur nächsten Auswahl. Nur flüchtiger UI-Zustand, keine Simulationsänderung. Pause und Zielmodi blenden weiterhin nur vorübergehend aus.

**161 Node-Tests bestanden**, vollständiger Befehl aus `testing.md`. Gezielter Chromium-`file://`-Touch-Check: ×, Kamera weg/zurück ohne Wiederöffnen und erneutes Antippen bestanden; × bei 960×600, 844×390 und 390×844 erreichbar. Keine erfassten Laufzeit-/Ressourcen-/GL-Fehler. Kleine 26×26-CSS-Pixel-Schließenfläche ohne Vergrößerung des Panels; echte Gerätebedienung übernimmt der Nutzer. Temporäre Probe: `/tmp/meridian-building-dismiss-check.cjs`. Breitere vorherige Browserabläufe nicht erneut ausgeführt.

## Ursprüngliche Prüfungen der Gebäudeaktionen

- Vollständiger Befehl aus [testing.md](testing.md): **158 Node-Tests bestanden**. Neue Fälle für Arbeiterauswahl, Weg/Arbeit, Stoppen/Tod, Voraussetzungen, Verkauf/Queues/Erstattung, HQ-Schutz, Versorgung, Raffinerieplatz und aktuelle Checkpoints; UI-Projektion, Randbegrenzung, Kamera-/Hilfe-Freihaltung, ausgeblendete Zustände, Buttonstatus und Bestätigungsablauf. Bestehende Terrain-/Effekt-/RNG-Referenzen nicht geändert.
- Chromium 152, Linux Headless, frisches Profil, **direkt `file://`**, Touch-Emulation, **Performance**, keine abgeschwächten Sicherheitsflags: Gebäude per Touch ausgewählt; Repair/Stop und Sell/Keep/Bestätigung per nativen Touch-Ereignissen bedient. Nächster Arbeiter zugewiesen, Anmarsch und Vollreparatur mit expliziten Simulationsschritten geprüft; kein Sofort-Heilen beim Tippen. Ohne Arbeiter/Alloy sowie bei voller Hülle gesperrt. Bestätigung pausiert Zeit und Produktion auch mit eingeschalteter Spielgeschwindigkeit.
- Verkauf erstattet Startgebäude zu 50 % plus beide offenen Rekrutierungen genau einmal; keine zusätzlichen Einheiten, Hindernis frei, letztes HQ gesperrt. Native Pause/Save/Resume/Load erhalten Verkauf und zugewiesenen Reparaturarbeiter.
- **960×600, 844×390 und 390×844**, jeweils alle vier Spielfeldränder: Panel innerhalb der Grenzen, beide Buttons mindestens 44×44 CSS-Pixel und per Hit-Test erreichbar, Kamera-/Hilfe-Buttons nicht verdeckt. Sell/Keep an jedem Format per Touch. Für den Modal-Button nutzte die Probe `scrollIntoView`; keine Aussage über natives Wischen im Modal.
- Die vorherige `/tmp/meridian-tooltip-check.cjs`-Browserprobe erneut bestanden: Fleet-Upgrades, alle acht Zielmodi mit Cancel, Pause/Save/Load/Handbuch, regulärer Einzelarbeiter-Bau ohne Helfer, alle Fraktions-Baumenüs, Rekrutierung/Porträts/Queue-Erstattung/Meldungsnavigation und Belagerungs-Schild-/Siegfolge. Log: `/tmp/meridian-buildings-regression.log`.
- Repair-Buttonname im Accessibility-Baum vorhanden; keine Tooltip-/`title`-/`kbd`-Reste auf den geprüften Ansichten. Keine erfassten Laufzeit-/Ressourcen-/Log-Fehler; abschließend `gl.getError() === 0`.

Temporäre Probe: `/tmp/meridian-buildings-check.cjs`, Log `/tmp/meridian-buildings-browser.log`, Screenshots `/tmp/buildings-*.png`; nicht Bestandteil der Auslieferung. Reparatur-/Verkaufsansicht und beide kleinen Randansichten visuell gesichtet. Der Aufbau nutzt gezielt die Runtime-API, angepasste Kamerapositionen und teils `speed = 0`; dies sind Prüfhilfen, keine neue Spieloption.

Nicht geprüft: echte Mobilgeräte, weitere Browser, High/Balanced für die neuen Aktionen, vollständige Missionen und Langzeitbalancing, systematische Performance, Screenreader-Bedienung, hörbares Audio oder Browser-Backup-Import/Export. Kleine bestehende Kamera-/HUD-Buttons wurden nicht vergrößert. Das temporäre Gebäude-Panel kann andere Informationsflächen überdecken; kein vollständiges Mobile-HUD-Redesign.
