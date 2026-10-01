# UI-Designsystem

## Geltungsbereich und Pflege

`styles/design-system.css` ist die maßgebliche gemeinsame Gestaltung für Hauptmenü,
Expeditionsvorbereitung/-übergang, Codex, Dialoge, Flottenupgrades, Ergebnisse und
Ladebildschirm. Es wird nach den bestehenden Stylesheets geladen. Bildschirmgeometrie,
responsive Layouts und Modellvorschau bleiben in `screens.css` bzw. `codex.css`.

Die Theme-Schicht begrenzt Tokens und Selektoren ausdrücklich auf `#menu`, `#modal`,
`#result` und `#loading`. Keine Theme-Tokens auf `:root`, keine globalen Buttonregeln:
Das Gefechts-HUD, Toasts, Funkmeldungen, Diagnoseanzeigen und die Welt bleiben außerhalb.
Pause und andere Dialoge über dem Gefecht gehören dagegen zum Designsystem.
Diese Begrenzung ist auch bei neuen Komponenten zu erhalten.

## Visuelle Sprache

- Dunkle, ausreichend deckende Navy-Flächen; Cyan markiert Bedienbarkeit und Auswahl.
  Gold bleibt für Upgrade-Effekte und Fortschritt, Rot für Verlust/destruktive Aktionen.
- Flächen, Konturen, Schatten, Radien und Bewegung werden über lokale `--ui-*`-Tokens
  gepflegt. Asymmetrische Ecken statt abgeschnittener interaktiver Elemente erhalten
  sichtbare Tastatur-Fokusrahmen.
- `.primary` bezeichnet die wichtigste Aktion, `.secondary` reguläre Aktionen,
  `.textbtn` Navigation. Auswahl verwendet `.active` und, wo vorhanden, `aria-pressed`.
  Deaktivierte Aktionen behalten lesbare Texte statt pauschaler Transparenz.
- Flottensysteme erscheinen auf breiten Displays als Zeilen, Command-Module als Karten.
  Auf schmalen Displays bleiben Informationen einspaltig und Inhalte scrollbar.
- Einblendungen sind kurz und einmalig; keine dauernden Glanzläufe oder animierten
  Filter. `prefers-reduced-motion` deaktiviert die CSS-Bewegung einschließlich Ladepunkten.
  Keine zusätzlichen Assets, externen Fonts, Laufzeitdienste oder Zufallsziehungen.

## Grenzen der Prüfung

DOM-/CSS-Prüfungen bestätigen nicht die subjektive Lesbarkeit, Touch-Ergonomie oder
Echtgeräteperformance. Die visuelle Abnahme erfolgt menschlich, insbesondere mit langen
Gegnerbriefings und kleinen Querformaten. Offene technische Folgearbeit steht im
[UI-Review-Issue](issues/ui-review.md), nicht in dieser Pflegebeschreibung.
