# UI: offene technische Grenzen

Geltungsbereich: Menüs, Codex, Dialoge, Flottenupgrades, Ergebnisse und Gefechts-HUD
im gemeinsamen [Designsystem](../ui-design-system.md). Die folgenden technischen
Grenzen bestehen unabhängig vom übernommenen Demo-Look.

## Fokus und Dialogsemantik

`openModal` ersetzt Markup ohne Dialogrolle, initialen Fokus, Tab-Begrenzung oder
Fokusrückgabe. Hintergrundkontrollen bleiben per Tastatur erreichbar. Auch vollständige
Neurenderings nach Upgrade-Käufen können den Fokus verlieren.
Eine gemeinsame Fokus-/Dialogverwaltung muss Rückkehr zu Pause, Ergebnis und Hauptmenü
unterscheiden; Escape darf keine erforderliche Bestätigung überspringen. Keine bloße CSS-Lösung.

## CSS-Verantwortung

`hud.css` enthält responsive Regeln für Menüs, Dialoge und Einstellungen; `base.css`
enthält globale Kontrollgestaltung. Die explizit begrenzte Theme-Schicht isoliert das
neue Design, beseitigt aber nicht diese ältere Layout-Kopplung. Spätere Bereinigung als
separater struktureller Schritt mit Vergleich des HUDs einschließlich dynamischer
Aktions-/Funk-/Queuezustände. Nicht einfach die globalen Tokens ersetzen.

## Drehmittelpunkt der Gefechtskamera

- [ ] Beim Drehen den sichtbaren Geländepunkt in der Mitte des Spielfeldfensters
  festhalten, nicht nur den Kamerapunkt auf der Ebene `y=0`. Auf erhöhtem Gelände
  liegt der aktuelle Drehpunkt unter der Oberfläche; der zuvor zentrale Geländepunkt
  wandert beim Drehen. Gezielte Node-Rendererdiagnose: ebenes Plateau auf Höhe 20,
  Zoom 57, Fenster 800×600, Spielfeld von y=63 bis 491; nach 90° wandert der
  Geländepunkt von (400,277) nach ungefähr (243,151). Die bestehenden gezielten
  Kamera-/Pickingtests bestehen, schützen aber den Nullhöhenpunkt, nicht einen
  festen Geländepunkt bei Drehung. Eine Korrektur muss Pan, Pinch, Kameragrenzen
  und Tutorial-Framing erhalten; kein pauschaler Wechsel der Kamera-Zielhöhe.
- Die Mitte des Spielfeldfensters liegt durch das untere HUD oberhalb der gesamten
  Bildschirmmitte. Zwei-Finger-Drehen nutzt bisher diese feste Mitte, nicht die
  Mitte zwischen den Fingern. Gewünschten Gestenanker bei menschlicher Abnahme
  unterscheiden; dies ist unabhängig vom Geländeversatz.

## Technische und menschliche Abnahme

Technischer Prüfkontext: `file://`, lokale Motive/Font, Menü-Scrollaktionen und
unbeschnittene Kontroll-Fokusrahmen bei 375×667, 1280×800 und 844×390. HUD-Diagnose
mit pausierter Welt und angehaltener WebGL-Bildfolge: vier Slots, Kategorie-/Modellkacheln,
Cancel-/Cooldown-/TECH-Anzeigen, Queue-Overlay, Funk-Dismiss über aufgeklapptem
Produktionspanel und Pause-/Restart-Dialog. Keine Shader-/Performanceabnahme.
Kameradrehung technisch mit `file://`/Software-WebGL geprüft: Mittelmausziehen,
emulierte Zwei-Finger-Drehung mit Pinch und Picking bei gedrehter Kamera.
Drehgefühl und kombinierte Gesten auf echten Mobilgeräten bleiben menschlich abzunehmen.
Statische Zustandsprojektionen schützen keine vollständigen Echtgeräteinteraktionen.
Noch offen:
visuelle Abnahme auf Zielgeräten, kleine Querformate, lange Briefings, Fokusführung und
Screenreader-Bedienung. Reduzierte Filterkosten sind kein gemessener Performancegewinn;
GPU-/Gerätemessungen erst mit konkretem Vergleichsziel.
