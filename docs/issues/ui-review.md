# UI: offene technische Grenzen

Geltungsbereich: Menüs, Codex, Dialoge, Flottenupgrades, Ergebnisse und Gefechts-HUD
im gemeinsamen [Designsystem](../ui-design-system.md). Die folgenden technischen
Grenzen bestehen unabhängig von der übernommenen Moodboard-Materialgestaltung.

## Fokus und Dialogsemantik

Statischer Abgleich auf `937914e`: [`openModal`](../../src/ui/screens.ts) ersetzt
Markup weiterhin ohne Dialogrolle, initialen Fokus, Tab-Begrenzung oder Fokusrückgabe. Hintergrundkontrollen bleiben per Tastatur erreichbar. Auch vollständige
Neurenderings nach Upgrade-Käufen können den Fokus verlieren.
Eine gemeinsame Fokus-/Dialogverwaltung muss Rückkehr zu Pause, Ergebnis und Hauptmenü
unterscheiden; Escape darf keine erforderliche Bestätigung überspringen. Keine bloße CSS-Lösung.

## CSS-Verantwortung

`hud.css` enthält responsive Regeln für Menüs, Dialoge und Einstellungen; `base.css`
enthält globale Kontrollgestaltung. Die explizit begrenzte Theme-Schicht isoliert das
neue Design, beseitigt aber nicht diese ältere Layout-Kopplung. Spätere Bereinigung als
separater struktureller Schritt mit Vergleich des HUDs einschließlich dynamischer
Aktions-/Funk-/Queuezustände. Nicht einfach die globalen Tokens ersetzen.

## Technische und menschliche Abnahme

Technischer Prüfkontext für das [kompakte HUD](../gameplay.md#kompaktes-hud): `file://` bei 320×568, 375×667 und 844×390; gleiche Minimap-/Kataloghöhe, vier Fähigkeiten, lokale Queue ohne Umleitung bei voller Produktion, fünf Queue-Punkte, X-Abbruch, direktes Tempo und separates Pausemenü ohne JavaScript-Fehler. Gezielte Node-Prüfungen decken Tutorial-Schnellwahl, Aktions-/Queue-Verträge und Forum-Balken aus Live-Zustand ab. Kleine Touch-Ziele der Gebäudeaktionen, lange Status-/Kostenangaben und Forum-Balken bei vielen benachbarten Gebäuden bleiben auf Zielgeräten visuell und per Touch abzunehmen. Fullscreen-Overlay technisch geprüft: konstante Welt-/Canvasmaße während tatsächlich laufender Entrance-Animation, unveränderte Projektion bei HUD-Katalogwechseln und keine Weltaktion bei eingefangener Pointer-Freigabe über dem HUD. Visuelle Übergangsruhe in Firefox und auf Zielgeräten bleibt menschlich abzunehmen. Favoriten-Langdruck ist im Browser mit Maus und emulierter Touch-Eingabe geprüft, einschließlich Ersetzen ohne Bau/Rekrutierung und Wiederherstellung nach Reload; Halteschwelle, Bewegungstoleranz und Erkennbarkeit der leuchtenden Bearbeitungsmarkierung bleiben auf echten Touch-Geräten abzunehmen. Keine Shader-/Performanceabnahme.
Kameradrehung technisch mit `file://`/Software-WebGL geprüft: Mittelmausziehen,
emulierte Zwei-Finger-Drehung mit Pinch und Picking bei gedrehter Kamera.
Drehgefühl und kombinierte Gesten auf echten Mobilgeräten bleiben menschlich abzunehmen,
insbesondere der feste [Geländeanker](../gameplay.md#kamera-und-befehle) auf Höhen/Hängen,
die Begrenzung am Kartenrand und die Höhenzentrierung beim Stage-Start ohne Tutorial
sowie bei automatisch zentrierten Ansichten. Gezielte Node-Prüfungen decken Start-/Tutorial-Framing
und Projektion auf erhöhtem Terrain ab, nicht das tatsächliche Kameragefühl.
Statische Zustandsprojektionen schützen keine vollständigen Echtgeräteinteraktionen.
Die Außenkulisse bleibt visuell abzunehmen: breite Sichtfenster, erhöhte Kartenränder
und gedrehte Kamera ohne sichtbares Ende, helle Anschlussnaht oder Durchblick unter das Terrain;
auch der Anteil der Außenkulisse an den Pan-Grenzen und die Erreichbarkeit
bebaubarer Ränder nach Zoom-/Fenstergrößenwechseln.
Lebendige Randgestaltung soll aus passender Verteilung vorhandener Dekoration entstehen,
nicht aus unnötig großer Kulisse oder pauschal erhöhten Instanzbudgets.
Material-/Bewuchsübergang, stetiger Höhen-/Schattierungsanschluss ohne helle oder dunkle Naht
und kreisförmiger Sichtsaum am Rand sind menschlich abzunehmen;
CPU-Fog-Isolation, Partei-/Sichtstufenfilter und ausbleibende Scan-Korridore sind gezielt geprüft.
Auch die fest verankerten, kantengeglätteten Baugrid-Linien benötigen visuelle Abnahme
bei weitem Zoom, niedriger Renderauflösung und Drehung: GPU-Stichproben prüfen die
Linienfilterung, nicht flimmerfreie Bewegung auf Zielgeräten.
Die Moodboard-Materialrahmen sind unter `file://` in Chromium/Software-WebGL
technisch geprüft: dekorative Ebenen ohne Pointer-Eingriff, hohle Diagonalkonturen,
lebende Einstellungen, erhaltene Skins nach Neurendering sowie konstante Weltmaße
und Minimap-/Kataloghöhe bei 320×568 und 844×390. Das bestätigt keine subjektive
Stiltreue oder Geräteleistung. Doppelkonturen, Bloom, kleine HUD-Eckschienen und
Statusfarben benötigen weiterhin menschliche Abnahme, auch bei heller Spielwelt.
Noch offen:
visuelle Abnahme auf Zielgeräten, kleine Querformate, lange Briefings, Fokusführung und
Screenreader-Bedienung. Reduzierte Filterkosten sind kein gemessener Performancegewinn;
GPU-/Gerätemessungen erst mit konkretem Vergleichsziel.
