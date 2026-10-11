# Terrain: menschliche Abnahme

Generierungs- und Speichergrenzen: [Architektur](../architecture.md#weltrezepte-und-feste-designs). Größere Karten, native Familienformen einschließlich Plateau-Rezepten und breite Anschlusskorrekturen sind implementiert. Die Geländeform folgt ausschließlich dem Familienrezept beziehungsweise der eigenen Alien-Rücken-/Kraterachse. Höhenparameter, Biotope, Wirtschaft und Kartengröße bleiben seedabhängig.

- [ ] **Geländecharakter und Höhen:** Die nativen Familien-/Rezeptformen visuell vergleichen. Hochflächen sollen wie nutzbare Landschaft, nicht wie gleichartige runde Hügel oder ausgeschnittene Bauplatten wirken. Terrassen bleiben in den entsprechenden Familienrezepten erhalten; die zusätzliche Plateau-/Massiv-Formauswahl entfällt. Die interessanten Vergleichsseeds unten bilden den Ausgangspunkt für weitere Präferenzanalyse.
- [ ] **Pässe und Truppendurchsatz:** Breite Auffahrten und ihre oberen/unteren Anschlüsse mit echten Truppengruppen in beide Richtungen abnehmen. Die statische Freiraumprüfung ist kein Nachweis gegen dynamische Körperstaus. Zusätzliche Bau-/Einheitenblocker dürfen weiterhin Wege versperren. Westmark 1409 bietet eine gezielt korrigierte Randfläche; daraus folgt keine universelle Seedabnahme.
- [ ] **Verteilung und Taktik:** Lokale Plateau- und Passlagen auf verständliche Höhenvorteile, Umgehungsmöglichkeiten und Expansion prüfen. Die Flächenprüfung schützt verteilte Nutzbarkeit, nicht symmetrische Starts oder globale Balance. Ein breiter Anschluss ist noch keine Garantie auf zwei unabhängige Zugänge zu jeder Hochfläche.
- [ ] **Größe und Zielgeräte:** Größere Karten auf Erkundungsdauer, Wirtschaftsverteilung, Kamerabedienung und Zielgeräteperformance abnehmen. Feste Rasterauflösung bedeutet mehr Zellen; die Erzeugungsprüfung ist begrenzt, aber Startzeit und Speicher-/Renderkosten müssen am Zielgerät beurteilt werden. Vorgehen: [Performance](performance/README.md).
- [ ] **Randgestaltung – menschliche Abnahme:** Die feste, bis zum erzeugten Rand dekorierte Außenkulisse und die weich erhöhte Vegetations-/Steindichte in Übersichten und bei normalen Randkameras vergleichen. Westmark 4 zeigte zuvor einen harten Dekorabschluss vor einer leeren Gelände-Verlängerung; diese Verlängerung entfällt. Kamera-/Zoomgrenzen berücksichtigen nun alle Bildschirmecken und Geländeextrema. Breite und schmale Fenster, Drehung, Resize sowie Randziele prüfen; eine Übersicht darf zugunsten geschlossener Geländedeckung Teile der spielbaren Fläche außerhalb des Bildes lassen. Außenhöhen dürfen keinen umlaufenden Aufstieg und damit unbeabsichtigt überall eine Beckenform erzeugen; echte Becken-/Kraterrezepte bleiben bewusste Varianten. Die spielbare Grenze bleibt rechteckig; Außenkulisse verleiht weder Baufläche noch zusätzliche Spielsicht. Vollaufgedeckte Vergleichsaufnahmen müssen auch die kosmetische Sichtkulisse aufdecken, sonst dominiert der dunkle Fog-Rand. Anschlusswände der inneren Haut dürfen keinen rechteckigen Schattenrand erzeugen. Zielgeräte-/Nachtwirkung und normale lokale Fog-Übergänge bleiben abnahmebedürftig; Darstellungsvertrag unter [Rendering](../rendering.md#terrain-und-renderpässe).
- [ ] **Biotope – menschliche Abnahme:** Offene, gehölzreiche, feuchte und karge Gemeinschaften sowie zweite Pflanzenformen in Gesamtansichten und Spielzoom vergleichen. Übergänge sollen große nachvollziehbare Regionen bilden, ohne Wege/Wirtschaft zu verdecken oder Höhen überall gleich einzufärben. Höhen-/Hangabhängigkeit und Familiencharakter prüfen; karge Desert-Hochflächen, Grove-/Conifer-Gemeinschaften auf Haven und Reed-/Fungus-Gemeinschaften auf Alien bieten gezielte Vergleiche. Kosmetische Feuchte ist kein Wasser-/Hydrologienachweis. Hoher Wald bleibt auf bestehenden Sperrflächen; offene Flächen bekommen keine neuen Blocker. Nachtlesbarkeit und zusätzliche Shader-/Meshkosten am Zielgerät bleiben offen. [Vertrag](../rendering.md#landschaftszonen-und-wetter).
- [ ] **Weitere Landschaftsstufen – separater Auftrag:** Zivilisationsspuren und komponierte seltene Orte entwickeln. Keine neuen POIs, Belohnungen oder Interaktionsmechaniken im Biotopauftrag.

## Interessante Vergleichsseeds

Vom Nutzer im Map Viewer auf unterschiedlichen Kartenfamilien als interessant bewertet:

- `30227062`
- `39095729`
- `69454296`
- `62745379`
- `8115531`
- `19763024`

- [ ] Für diese Beispiele wünschenswerte Eigenschaften beschreiben: Gelände-Komposition, Höhenkontrast, Teilregionen, Freiflächen/Engstellen und Biotopwechsel. Die subjektive Auswahl ist kein Spielbarkeits- oder Balancenachweis.
- [ ] Bei konkreten Vergleichen Familienzuordnung und Viewer-Rezept/Build ergänzen; bisher ist nur bekannt, dass unterschiedliche Familien betrachtet wurden. Seeds allein konservieren die Landschaft nicht über Generatoränderungen hinweg.

Die zusätzliche Formauswahl war bei allen sechs Seeds im Familienzweig. Ihre nativen Formen und übrigen Zufallsziehungen bleiben bei der Vereinfachung erhalten; Mothership bleibt ein Deck. Die als langweilig gemeldeten Beispiele werden auf Nutzerwunsch nicht weiter geführt. Keine Seed-Whitelist und kein Auftrag für breite Seed-/KI-/Simulationsläufe.

Gezielte CPU-Fälle sichern Komponenten, räumliche Mindestnutzung, Anschlussbreite, erhaltene Wirtschaftsfundamente und unterschiedliche Morphologie. Pausierte Browseraufnahmen bestätigen die Darstellung ausgewählter Seeds ohne Simulationsfortschritt. Breite Seedprüfungen und KI-/Simulationsläufe benötigen einen eigenen freigegebenen Umfang; feste Referenzen werden nicht zur Anpassung an neue Landschaften regeneriert.
