# UI-Designsystem

## Geltungsbereich und Pflege

`styles/design-system.css` ist die maßgebliche gemeinsame Gestaltung für Menüs,
Expeditionsvorbereitung/-übergang, Codex, Dialoge, Zivilisationsupgrades, Ergebnisse,
Ladebildschirm, Gefechts-HUD und Meldungen. Es folgt auf die Basis-/Layoutstyles;
`styles/home.css` ergänzt danach nur Startbildschirm-Geometrie und Branding.
Material-Tokens, Panel-/Buttonform und Glow werden gemeinsam gepflegt, nicht pro
Ansicht nachgebaut. UI-Texte verwenden den System-Sans-Stack der Vorlage, Daten und
Mikrobeschriftungen Monospace; die vorhandenen Branding-Motive bleiben erhalten. Die übrige Bildschirmgeometrie und Modellvorschau bleiben in
`screens.css`, `codex.css` bzw. `hud.css`.
Run-Briefing, Loadout, Gegner und Gebäudeboni stehen im Sternchen-Modal, nicht zwischen
den Startaktionen. Es unterscheidet Boni für neu gestartete Gefechte von den eingefrorenen
Boni eines gespeicherten Gefechts. Die Checkpoint-/Landschaftsvorschau bleibt auf dem
Startbildschirm. Civilization-Score-Anzeigen und Zugangsbalken entfallen.
Das aktuelle Tutorialziel bleibt als passives Panel oben links unter der Statuszeile sichtbar, unabhängig vom geöffneten Aktionsreiter. Alle Tutorialphasen haben ein Ziel; Supply-Ziele zeigen zusätzlich die aktuelle Belegung/Kapazität. Hinweise gehören nicht in den schmalen Bau-/Rekrutierungs-Scrollbereich. Warnungen bleiben rechts und weichen bei Platzmangel unter das Zielpanel aus; die Anzeige fängt keine Welt-/Kameraeingaben ab. Zahlenänderungen aktualisieren nur den Zieltext, nicht das Aktionsmarkup.

Tokens und Selektoren bleiben auf `#menu`, `#modal`, `#result`, `#loading`, `#hud`
und `#toast` begrenzt. Keine Theme-Tokens auf `:root`, keine globalen Buttonregeln.
Funk und Warnungen gehören zum HUD; Diagnoseanzeigen und Welt bleiben außerhalb.
Das Aktions-HUD behält seine dichten, lückenlosen Hit-Flächen. Innerhalb der Kacheln
sitzen leicht eingerückte Materialrahmen mit Doppelkontur; ausgewählte Aktionen
besitzen leuchtende Eckschienen. Der untere Aktionsblock hat keine gemeinsame
Hintergrundplatte: Zwischen den abgeschrägten Buttons bleibt die Spielwelt sichtbar.
Beide Leisten sind mit Safe-Area-Abstand vom Bildschirmrand eingerückt;
Minimap und Aktionsblock sind zusätzlich durch einen schmalen freien Spalt getrennt.
Die Auswahlleiste sitzt mit demselben Abstand darüber; Innenabstände halten Avatar
und kleine Aktionsicons innerhalb des Rahmens. Ihre 44px-Buttons haben eigene
Zwischenräume und wechseln bei Platzmangel in eine zweite Zeile, statt den
Auswahltext zu verdrängen. Verkaufen nutzt ein Dollarzeichen, Abbrechen weiterhin ein X.
Auf sehr schmalen Displays werden diese Abstände für ausreichend große Hit-Flächen reduziert.
Auch die obere Leiste hat keine gemeinsame Hintergrundplatte. Ressourcen stehen
links auf einer eigenen Materialfläche ohne Buttonfunktion und bleiben auch auf
schmalen Displays nebeneinander. Eine Stageanzeige im HUD entfällt.
Zivilisationsupgrades nutzen dasselbe 4×3-Katalograster, ausschließlich mit Icons.
Eine separate Detailansicht ersetzt das Raster: freies Upgrade-Icon links,
X-Button rechts zur Rückkehr, darunter Aktivieren und anschließend Rang-Ausbau.
Ein Clear-Button entfällt; Details anderer Effekte bleiben nach Aktivierung lesbar,
ohne eine neue Aktivierungsaktion anzubieten. Die Detailansicht wächst ohne
Scrollfläche nach oben; Minimap und Auswahlleiste bleiben getrennt und die Welt fullscreen.
Die Regeln und die Grenze zur Simulation stehen unter [zivilen Upgrades](gameplay.md#wirtschaft-bau-und-produktion).
Pause und Tempo nutzen identische Button-Skins und Zustände; ein, zwei oder drei
Pfeile markieren die Geschwindigkeit, der genaue Faktor bleibt in der zugänglichen
Beschriftung. Dynamische Werte werden in eigenen Textknoten aktualisiert,
damit die dekorativen Ebenen erhalten bleiben. Die Minimap selbst ist auf die äußere
Fase ihres Rahmens zugeschnitten; Canvasgröße und Koordinatenabbildung bleiben gleich.
Pausieren sperrt Eingaben, ändert aber nicht Deckkraft oder Rahmen der Kacheln;
die Abdunklung gehört allein zum Modal-Backdrop. Fokus-, Tutorial- und
Favoriten-Bearbeitungsmarkierungen bleiben unabhängig von dekorativen Zuständen.
Die Theme-Schicht bleibt kosmetisch. Layout und Bedienregeln des [kompakten HUDs](gameplay.md#kompaktes-hud) gehören in HUD-Styles und Controller; echte Minimap, Modellkacheln, Queue-IDs und Simulationszustände bleiben maßgeblich. Das Spielfeld bleibt fullscreen hinter dem HUD; HUD-Auswahl, Kataloge und Leistenanimationen ändern weder Rendergröße noch Projektion. Nur Queue-/Funk-/Meldungsabstände folgen der untransformierten HUD-Layoutgeometrie. Keine vereinfachte Demo-Konsole oder statische Weltgrafik einsetzen.

Visuelle Vorlage ist **OUTPOST / 02 — Licht, Kante, Tiefe** aus dem externen Paket
`/home/mkt/Downloads/aom-moodboard/moodboard.html`. Maßgeblich ist die eingebettete
Materialschicht dieser HTML-Demo; die separaten `styles.css`/`tokens.css` des Pakets
enthalten einen abweichenden älteren Stand. Palette, Materialverläufe, abgeschrägte
Doppelkonturen, Bloom und Zustände werden auf die vorhandenen Spielkomponenten
übertragen. Mockup-Inhalte, Steuerlogik und Demo-Hintergründe werden nicht übernommen.
Echte Minimap, Welt, Modelle und Branding-Assets bleiben Spielquellen.
[Assetpflege](rendering.md#ui-branding).

## Visuelle Sprache

- Dunkle, ausreichend deckende Navy-Flächen mit gestuften Materialverläufen;
  Cyan markiert Bedienbarkeit und Auswahl. Primäraktionen sind helles Cyan mit
  dunkler Schrift. Bernstein bleibt für Kosten, Warnungen und Fortschritt,
  Rot für Verlust/destruktive Aktionen, Violett für Energie.
- Flächen, Konturen, Schatten und Bewegung werden über lokale `--ui-*`-Tokens gepflegt.
  `uiSkin()` liefert ausschließlich dekoratives, `aria-hidden`-Markup. Die
  gemeinsame `.ui-skin` enthält äußere Fase, Materialfläche, hohle Innenkontur und
  Eckschienen. Nur diese Ebenen sind abgeschrägt; die ungeclippte Skin-Hülle trägt
  Bloom. Controls und Text bleiben ungeclippt, die Skin fängt keine Eingabe ab.
  Textaktualisierte kleine Meldungen und der Tempobutton nutzen dekorative
  Pseudoelemente. Queue-Fortschritt, Zielabbruch und Favoritenmarkierungen behalten
  ihre funktionalen Overlays. In dichten HUD-Scrollrails liegt der Fokusrahmen innen. Dialoge haben
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
  Keine externen Fonts, Laufzeitdienste oder Zufallsziehungen. Motive werden lokal
  mitgeliefert. Native Einstellungsinputs bleiben erhalten; eckige Switches und
  leuchtende Slider ändern weder Optionen noch Speicher-/Eingabeverträge. Die
  Sliderfüllung folgt rein visuell dem Eingabewert. `forced-colors` ersetzt die
  Materialschicht durch Systemfarben und sichtbare Rahmen.

## Grenzen der Prüfung

DOM-/CSS-Prüfungen bestätigen nicht die subjektive Lesbarkeit, Touch-Ergonomie oder
Echtgeräteperformance. Die visuelle Abnahme erfolgt menschlich, insbesondere mit langen
Gegnerbriefings und kleinen Querformaten. Offene technische Folgearbeit steht im
[UI-Review-Issue](issues/ui-review.md), nicht in dieser Pflegebeschreibung.
