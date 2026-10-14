# UI: offene Grenzen

## Fokus und Dialoge

- [ ] `openModal` in `src/ui/screens.ts` hat keine gemeinsame Dialogrolle, initialen
  Fokus, Tab-Begrenzung oder Fokusrückgabe; Hintergrundkontrollen bleiben erreichbar.
  Neurenderings nach Käufen können Fokus verlieren. Gemeinsame Verwaltung für Pause,
  Ergebnis und Hauptmenü; Escape darf notwendige Bestätigung nicht überspringen.
  Keine reine CSS-Lösung.

## CSS-Verantwortung

- [ ] `hud.css` enthält Menü-/Dialog-/Einstellungsregeln, `base.css` globale Controls.
  Theme-Isolation löst diese Layoutkopplung nicht. Als getrenntes Refactoring mit
  dynamischem HUD/Funk/Queues vergleichen, nicht globale Tokens pauschal ersetzen.

## Menschliche Bedienungsabnahme

- [ ] Kleine Hoch-/Querformate, lange Briefings/Kosten/Statuswerte, kleine Gebäudeaktionen
  und Forum-Balken bei dichtem Bestand. Screenreader und Fokusführung.
- [ ] Modellkacheln: Größe/Ausschnitt, Teamfarbe, Kontrast, Kosten/gesperrte Aktionen,
  kalte Einblendung und sofortige Wiederanzeige; Scroll/Touch unter Last.
- [ ] Favoriten-Langdruck: Schwelle, Bewegungstoleranz, leuchtende Bearbeitungsmarkierung.
- [ ] Kamera: kombiniert drehen/zoomen, fester Geländeanker an Hängen, Randbegrenzung,
  Höhenzentrierung bei Start/Tutorial. Minimap und Rechteckauswahl auf echtem Touchgerät.
- [ ] Materialrahmen, Ressourcenzeile, Tempo-/Pause-Pfeile und freigestellte HUD-Ränder
  bei heller Welt, Firefox, reduced motion und forced colors.
- [ ] HUD-/Stage-Übergänge ruhig und ohne doppelte Aktionen; Welt bleibt fullscreen,
  eingefangene HUD-Eingabe darf keine Weltaktion auslösen.

Vorhandene `file://`-/emulierte Touch-/Node-Prüfungen decken technische Teile ab, nicht
Komfort oder vollständige Geräteinteraktionen. Bildfragen unter [Darstellung](landschaften-und-taktische-darstellung.md),
Kosten unter [Performance](performance-und-mobilstabilitaet.md).
