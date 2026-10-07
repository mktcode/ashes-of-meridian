# UI-Designsystem

## Geltungsbereich und Pflege

`styles/design-system.css` ist die maßgebliche gemeinsame Gestaltung für Menüs,
Expeditionsvorbereitung/-übergang, Codex, Dialoge, Zivilisationsupgrades, Ergebnisse,
Ladebildschirm, Gefechts-HUD und Meldungen. Es folgt auf die Basis-/Layoutstyles;
`styles/home.css` ergänzt danach nur Startbildschirm-Geometrie und Branding.
Aldrich, Panel-/Buttonform und Glow werden gemeinsam gepflegt, nicht pro Ansicht
nachgebaut. Die übrige Bildschirmgeometrie und Modellvorschau bleiben in
`screens.css`, `codex.css` bzw. `hud.css`.
Run-Briefing, Loadout, Gegner und Gebäudeboni stehen im Sternchen-Modal, nicht zwischen
den Startaktionen. Es unterscheidet Boni für neu gestartete Gefechte von den eingefrorenen
Boni eines gespeicherten Gefechts. Die Checkpoint-/Landschaftsvorschau bleibt auf dem
Startbildschirm. Civilization-Score-Anzeigen und Zugangsbalken entfallen.
Bei Auswahl eines gewachsenen Zivilgebäudes ersetzt eine scrollbar lesbare Textliste
den unteren Aktionsblock. Wohn- und cyanfarbene Forschungsgebäude haben disjunkte
Effektlisten; die Überschrift nennt die Familie, auch nach dem Ausbau. Eine gespeicherte,
nicht mehr passende Auswahl erhält einen Hinweis statt einer auswählbaren Zeile.
Jede Zeile zeigt Effektbeschreibung, Stapelgrenze und
Auswahl-/Kostenstatus; Ausbau und Leeren stehen darüber. Minimap und Auswahlzeile
bleiben erreichbar. Die Liste verändert weder Rendergröße noch Weltprojektion.

Das aktuelle Tutorialziel bleibt als passives Panel oben links unter der Statuszeile sichtbar, unabhängig vom geöffneten Aktionsreiter. Alle Tutorialphasen haben ein Ziel; Supply-Ziele zeigen zusätzlich die aktuelle Belegung/Kapazität. Hinweise gehören nicht in den schmalen Bau-/Rekrutierungs-Scrollbereich. Warnungen bleiben rechts und weichen bei Platzmangel unter das Zielpanel aus; die Anzeige fängt keine Welt-/Kameraeingaben ab. Zahlenänderungen aktualisieren nur den Zieltext, nicht das Aktionsmarkup.

Tokens und Selektoren bleiben auf `#menu`, `#modal`, `#result`, `#loading`, `#hud`
und `#toast` begrenzt. Keine Theme-Tokens auf `:root`, keine globalen Buttonregeln.
Funk und Warnungen gehören zum HUD; Diagnoseanzeigen und Welt bleiben außerhalb.
Das Aktions-HUD ist flach und rahmenlos, seine Kacheln liegen ohne Zwischenräume aneinander. Ressourcenleiste und Pausebutton sind rechteckig, ohne dekorative Pseudoelemente oder Rahmen und mit minimalem Innenabstand. Pausieren sperrt Eingaben, ändert aber nicht Deckkraft oder Rahmen der Kacheln; die Abdunklung gehört allein zum Modal-Backdrop. Sichtbare Fokus-, Tutorial- und Favoriten-Bearbeitungsmarkierungen sind funktionale Ausnahmen.
Die Theme-Schicht bleibt kosmetisch. Layout und Bedienregeln des [kompakten HUDs](gameplay.md#kompaktes-hud) gehören in HUD-Styles und Controller; echte Minimap, Modellkacheln, Queue-IDs und Simulationszustände bleiben maßgeblich. Das Spielfeld bleibt fullscreen hinter dem HUD; HUD-Auswahl, Kataloge und Leistenanimationen ändern weder Rendergröße noch Projektion. Nur Queue-/Funk-/Meldungsabstände folgen der untransformierten HUD-Layoutgeometrie. Keine vereinfachte Demo-Konsole oder statische Weltgrafik einsetzen.

Visuelle Vorlage ist das externe Paket
`/home/mkt/Downloads/Ashes-of-Meridian-Assets/Ashes-of-Meridian-Demo.html`.
Seine dekorativen Regeln werden mit lokalen Selektoren wiederverwendet; Mockup-Logik,
Speicherung, alte Namen, Audio und Demo-Hintergründe sind keine Spielvorlage.
Für Codex, zusätzliche Module, mehrere Gegner und Niederlagen wird diese Formsprache
auf die vorhandenen Inhalte erweitert. [Assetpflege](rendering.md#ui-branding).

## Visuelle Sprache

- Dunkle, ausreichend deckende Navy-Flächen; Cyan markiert Bedienbarkeit und Auswahl.
  Gold bleibt für Upgrade-Effekte und Fortschritt, Rot für Verlust/destruktive Aktionen.
- Flächen, Konturen, Schatten und Bewegung werden über lokale `--ui-*`-Tokens gepflegt.
  Abgeschrägte Ecken clippen ausschließlich dekorative Pseudoelemente, nicht Controls
  oder Text. In dichten HUD-Scrollrails liegt der Fokusrahmen innen. Dialoge haben
  einen stationären dekorativen Rahmen um den unabhängig scrollenden Inhalt, damit
  das Panel bei langen Manuals/Upgrade-Listen nicht wegscrollt.
- `.primary` bezeichnet die wichtigste Aktion, `.secondary` reguläre Aktionen,
  `.textbtn` Navigation. Auswahl verwendet `.active` und, wo vorhanden, `aria-pressed`.
  Deaktivierte Aktionen behalten lesbare Texte statt pauschaler Transparenz.
- Gebäude-Upgrades erscheinen als beschriftete Zeilen, nicht als unbeschriftete Icon-Kacheln.
  Auf schmalen Displays bleiben Informationen einspaltig und Inhalte scrollbar.
- Einblendungen sind kurz und einmalig; keine dauernden Glanzläufe oder animierten
  Filter. Bestehende Tutorial-Zielmarkierungen bleiben erhalten; bei reduced motion
  als statischer Rahmen. `prefers-reduced-motion` deaktiviert die CSS-Bewegung einschließlich Ladepunkten.
  Keine externen Fonts, Laufzeitdienste oder Zufallsziehungen. Motive und Aldrich
  werden lokal mitgeliefert. Native Einstellungsinputs bleiben erhalten; der
  Switch-Look der Checkboxen ändert weder Optionen noch Speicher-/Eingabeverträge.

## Grenzen der Prüfung

DOM-/CSS-Prüfungen bestätigen nicht die subjektive Lesbarkeit, Touch-Ergonomie oder
Echtgeräteperformance. Die visuelle Abnahme erfolgt menschlich, insbesondere mit langen
Gegnerbriefings und kleinen Querformaten. Offene technische Folgearbeit steht im
[UI-Review-Issue](issues/ui-review.md), nicht in dieser Pflegebeschreibung.
