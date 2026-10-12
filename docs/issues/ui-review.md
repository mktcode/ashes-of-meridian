# UI: offene technische Grenzen

Geltungsbereich: Menüs, Codex, Dialoge, Zivilisationsupgrades, Außenposten-/Evakuierungshinweise, Ergebnisse und Gefechts-HUD
im gemeinsamen [Designsystem](../ui-design-system.md). Die folgenden technischen
Grenzen bestehen unabhängig von der übernommenen Moodboard-Materialgestaltung.

## Fokus und Dialogsemantik

Statischer Abgleich auf `2038076`: [`openModal`](../../src/ui/screens.ts) ersetzt
Markup weiterhin ohne Dialogrolle, initialen Fokus, Tab-Begrenzung oder Fokusrückgabe. Hintergrundkontrollen bleiben per Tastatur erreichbar. Auch vollständige
Neurenderings nach Upgrade-Käufen können den Fokus verlieren.
Eine gemeinsame Fokus-/Dialogverwaltung muss Rückkehr zu Pause, Ergebnis und Hauptmenü
unterscheiden; Escape darf keine erforderliche Bestätigung überspringen. Keine bloße CSS-Lösung.

## Modellkacheln: Bild und Bedienung

[Cache-/Rendervertrag](../rendering.md#modellkacheln) erhalten; Öffnungs-, Layout- und Kopierkosten zentral unter [Performance/Modellkacheln](performance/README.md#modellkacheln), kein erneuter Cache-/Modellumbau aus dieser Liste.

- [ ] Modellgröße/-ausschnitt, Teamfarben, Kontrast/Kanten, Namen/Kosten und deaktivierte Aktionen in Codex/HUD abnehmen.
- [ ] Erstmaliges Einblenden und sofortige Wiederanzeige in Firefox und bei reduzierter Bewegung visuell prüfen.
- [ ] Scrollen/Tippen auf Smartphone unter Last, nicht nur arrangiertes Standbild.

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
Randkulisse, Kameraabdeckung und Fog-Übergänge zentral unter
[Landschaften](project-tomorrow.md#randkulisse-und-kamera) abnehmen;
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
Die freigestellten Leisten und eingerückten HUD-Ränder sind technisch bei
320×568, 375×667, 844×390 und 1298×900 geprüft, einschließlich Minimap-Spalt,
Katalog-/Zivilpanel-Ausrichtung und unveränderter Weltgröße. Separate Ressourcenfläche,
identische Tempo-/Pause-Skins nach Zahlenupdates und ausgeschnittene Minimap-Ecken
sind unter `file://` in Chromium geprüft. Die einzeilige Ressourcenanzeige auf
schmalen Displays, die Tempo-Pfeile und die Bedienbarkeit der freien Randflächen
bleiben in Firefox und auf Touch-Geräten abzunehmen.
Noch offen:
visuelle Abnahme auf Zielgeräten, kleine Querformate, lange Briefings, Fokusführung und
Screenreader-Bedienung. Reduzierte Filterkosten sind kein gemessener Performancegewinn;
GPU-/Gerätemessungen erst mit konkretem Vergleichsziel; offene UI-Kosten zentral unter [Performance](performance/README.md#ui-und-erstaufbau).
