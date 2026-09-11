# Mobile-Ausrichtung: Bestandsaufnahme der Desktop-Bedienung

Ashes of Meridian soll ein reines Mobile Game werden. Diese Bestandsaufnahme hält die Desktop-bezogenen Eingaben, UI-Annahmen und Texte **vor Beginn der Bereinigung** fest. Sie ist keine bereits umgesetzte Änderung und kein Vorschlag, die zugehörigen Spielmechaniken pauschal zu entfernen.

Grundlage: statische Prüfung von Eingabelogik, Darstellung, Styles und Hilfetexten. Keine Browser- oder Mobilgeräteprüfung; keine neuen Tests ausgeführt. Die Zeilenangaben beziehen sich auf den untersuchten Stand und können sich bei der Bereinigung verschieben.

## Fortschritt nach der Bestandsaufnahme

1. Desktop-Kamerasteuerung, Edge-Scrolling-Einstellung und Kamera-Hotkey-Hinweise entfernt: [Mobile-Kamera-Bereinigung](mobile-camera-cleanup.md).
2. Maus-Rechteckauswahl samt Darstellung, Shift-Auswahl, Kontrollgruppen und Befehls-Auftragsketten entfernt: [Auswahl-/Befehlsbereinigung](mobile-selection-cleanup.md). Touch-Auswahl und Doppeltippen bleiben erhalten. Kontrollgruppen und Auftragsketten entfallen auf ausdrücklichen Wunsch komplett, ohne neue Touch-Ersatzbedienung. Neue Auswahlbuttons sind nicht Teil dieses Schritts.
3. Alle Spiel-Hotkeys und ihre Hinweise entfernt, Touch-Abbrechen für Bau-/Zielmodi ergänzt. Bauhilfe entfällt vollständig, ohne Automatisierungsersatz. Regulärer Bau und Reparatur fertiger Gebäude/Einheiten bleiben erhalten: [Touch-Befehle und Bauhilfe-Entfernung](mobile-touch-controls.md). Tooltip-Zugang ohne Hover sowie Reparatur-Automatisierung und anschließende Rechtsklick-Bereinigung bleiben offen.

Die folgenden Tabellen und ursprünglichen Konsequenzen bleiben als Bestandsaufnahme vor der Bereinigung stehen, nicht als aktuelle Liste noch vorhandener Funktionen oder aktueller Entscheidungen.

## 1. Kamera

| Fund | Fundstelle |
| --- | --- |
| WASD verschiebt die Kamera. | `ui.js:1661–1683` |
| Edge Scrolling verschiebt die Kamera am Spielfeldrand. Eigene Einstellung „Edge scrolling“, standardmäßig ausgeschaltet. Die Bewegung unterscheidet nicht ausdrücklich zwischen Maus und Touch. | `ui.js:365`, `ui.js:1675–1680`, `persistence.js:52` |
| Ziehen mit gedrückter mittlerer Maustaste bewegt die Kamera. | `ui.js:1521–1525` |
| Mausrad zoomt. | `ui.js:1193–1201` |
| Leertaste zentriert auf die Basis, Home auf die Auswahl. | `ui.js:1446–1447` |

Bereits vorhandene Touch-Alternativen: Fingerziehen zum Verschieben, Pinch-to-Zoom, Zoomschaltflächen und Basisansicht-Schaltfläche.

## 2. Auswahl und Befehle

| Fund | Bedeutung für Mobile | Fundstelle |
| --- | --- | --- |
| Auswahlrechteck mit gedrückter linker Maustaste | Touch-Ziehen verschiebt stattdessen die Kamera; Touch ist von der Rechteckauswahl ausgeschlossen. | `ui.js:1556–1585`, `ui.js:1951–1969` |
| Rechtsklick für Kontextbefehle: bewegen, angreifen, abbauen, reparieren und beim Bauen helfen | Antippen bietet bereits Kontextbefehle auf Boden und nicht-eigene Ziele. Eigene Einheiten und Gebäude werden dagegen ausgewählt. Reparatur und Bauhilfe sind so nicht gleichwertig erreichbar. | `ui.js:1557–1616` |
| Rechtsklick auf die Minimap für entfernte Befehle | Ein zuvor aktivierter Befehlsmodus bietet bereits eine Touch-taugliche Alternative. | `ui.js:1206–1231` |
| Shift für Hinzufügen/Entfernen in der Auswahl und Anhängen von Befehlen | Keine entsprechende Touch-Bedienung gefunden. Shift hält nach erfolgreicher Anwendung außerdem den Ziel-/Baumodus offen. | `ui.js:1106`, `ui.js:1584–1650` |
| Ctrl+1–9 zum Speichern und 1–9 zum Abrufen von Kontrollgruppen; zweimaliges Drücken zentriert auf die Gruppe | Keine sichtbare Touch-Oberfläche gefunden. | `ui.js:1407–1422` |
| Doppelklick wählt sichtbare Einheiten desselben Typs | Desktop-typisch dokumentiert; die gemeinsame Eingabelogik kann grundsätzlich auch durch Doppeltippen ausgelöst werden. Nicht pauschal als maus-exklusiv entfernen. | `ui.js:1596–1611` |

## 3. Tastaturkürzel

Zentrale Verarbeitung: `ui.js:1349–1453`.

| Funktion | Tasten |
| --- | --- |
| Attack-Move / Bewegen / Halten / Stoppen | F / M / H / X |
| Gesamte Kampftruppe | F2 oder Ctrl+A |
| Nächster Arbeiter | F3 |
| Befehle / Bauen / Rekrutieren / Forschung | Q / B / N / T |
| Aktionsreiter durchschalten | Tab |
| Fähigkeiten: Orbitalschlag / Reparaturfeld / Aufklärung / Verstärkung | E / R / C / V |
| Sammelpunkt setzen | Y |
| Pause / Zielmodus abbrechen / Dialog schließen beziehungsweise zurück | Esc, abhängig vom UI-Zustand |
| Speichern | F5 oder Ctrl+S |
| Laden | F9 |
| Handbuch | F1 |

Die meisten Funktionen besitzen bereits Schaltflächen. Desktopgebunden ist dann die zusätzliche Tastaturbedienung, nicht die Spielmechanik.

**Abbruch-Lücke:** Der Bau-/Zielmodus zeigt „CLICK TO CONFIRM · ESC TO CANCEL“. Eine eigene Touch-Schaltfläche zum Abbrechen dieses Modus wurde nicht gefunden (`ui.js:626`, `ui.js:1354–1358`).

## 4. Mausabhängige Informationen und Vorschauen

- **Aktions-Tooltips werden über `mousemove` geöffnet.** Sie enthalten wichtige Beschreibungen, Voraussetzungen, Bauzeiten und Fähigkeitswerte. Keine ausdrückliche Touch-Geste zum Öffnen gefunden (`ui.js:785–878`, `ui.js:1156–1165`).
- **Native `title`-Hinweise** erklären Ressourcen, Kameraknöpfe, Einheitenporträts und Produktionsaufträge. Auf Touch sind sie keine verlässliche Informationsquelle (`index.html:24–62`, `ui.js:896`, `ui.js:959`).
- **Hover im Spielfeld** blendet zusätzliche Auswahlringe, Namen und Lebensbalken ein. Auswahl und andere Bedingungen können diese Informationen ebenfalls sichtbar machen; sie sind nicht sämtlich ausschließlich über Hover erreichbar (`ui.js:1529`, `ui.js:1855–1937`, `app.js:117–130`).
- **Bau- und Fähigkeitsvorschauen folgen der Zeigerposition.** Das bequeme Prüfen vor Bestätigung ist damit auf einen frei beweglichen Mauszeiger ausgerichtet (`app.js:156` ff.).
- **Cursorwechsel und Hover-Effekte** liefern Rückmeldung über Fadenkreuz, Hand, „nicht erlaubt“ und hervorgehobene Buttons. Diese Rückmeldung ersetzt keine Touch-Rückmeldung (`ui.js:628`, `ui.js:1532`, `styles.css:43–54` und weitere `:hover`-Regeln).

## 5. Desktop-Texte und HUD-Annahmen

- **Dauerhafte Steuerungsleiste:** LMB, RMB und Tastenkürzel. Unter 850 Pixel Breite bleiben gerade die Hinweise für Links-/Rechtsklick und F sichtbar (`index.html:78–81`, `ui.js:1061`, `styles.css:2110–2119`).
- **Hotkey-Beschriftungen** auf Aktionsbuttons, Tabs und im Pausenmenü (`ui.js:319`, `ui.js:686–734`, `index.html:70–73`).
- **Tutorial, leere Auswahlansicht und Handbuch** verlangen Tastatur und Rechtsklick. Das Handbuch sagt ausdrücklich: „Desktop mouse and keyboard offer the fullest control.“ (`ui.js:434–471`, `ui.js:887`, `ui.js:1031–1051`).
- **Arbeiterbeschreibung** erklärt Abbau und Reparatur per Rechtsklick (`content.js:117`).
- **Breites dreigeteiltes RTS-Kommandodeck:** Minimap, Auswahlbereich und Aktionsraster nebeneinander. Kameraknöpfe sind 30×30 Pixel, Einheitenbuttons 32×33 Pixel groß; zahlreiche HUD-Schriften liegen bei 6–9 Pixeln (`styles.css:1465–1871` und responsive Regeln).
- **Schmale Ansichten blenden Informationen aus:** Energieanzeige unter 1150 Pixeln und Auswahlpanel unter 850 Pixeln, ohne dort einen neuen Zugang anzubieten (`styles.css:2068–2094`).
- **Desktop ausdrücklich als Zielsystem genannt:** Startanleitung und WebGL-Fehlermeldung (`README.md:7`, `app.js:292`).

Diese Layout-Funde sind Code-Indizien für Desktop-Ausrichtung, kein auf einem Mobilgerät verifizierter Darstellungsbericht.

## 6. Bereits vorhandene Mobile-Grundlage

Nicht versehentlich zusammen mit Desktop-Code entfernen:

- Antippen zum Auswählen und für Kontextbefehle auf Boden beziehungsweise nicht-eigene Ziele.
- Kamera per Fingerziehen und Pinch-to-Zoom.
- Zoom- und Basisansicht-Schaltflächen.
- Minimap-Navigation per Antippen/Ziehen sowie Zielanwendung bei aktivem Befehlsmodus.
- Schaltflächen für Befehle, Fähigkeiten, Produktion, Pause, Speichern, Laden und Hilfe.
- Gemeinsame Pointer-Event-Verarbeitung; Pointer-Events sind nicht grundsätzlich Desktop-Code.

## 7. Konsequenzen für die anschließende Bereinigung

Zwei Aufgaben unterscheiden:

1. **Desktop-Eingaben und Hinweise bereinigen:** etwa WASD, Edge Scrolling samt Einstellung, Mausrad, mittlere Maustaste und Hotkey-Texte. Zugehörige aktuelle Dokumentation und Steuerungstests mitziehen; historische Prüfberichte nicht als aktuelle Bedienungsanleitung behandeln.
2. **Fehlende Touch-Zugänge bewusst gestalten:** Mehrfachauswahl, Kontrollgruppen, Auftragsketten, Reparatur/Bauhilfe, Zielmodus-Abbruch und Tooltip-Informationen. Nicht durch bloßes Löschen der Desktop-Eingaben unzugänglich lassen.

Welche Mechaniken erhalten, vereinfacht oder entfernt werden, ist noch nicht entschieden. Ebenso sind ein neues HUD-Layout und Gameplay-/Balancing-Änderungen nicht Teil dieser Bestandsaufnahme.
