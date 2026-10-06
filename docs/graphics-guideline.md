# Grafik-Leitlinie

## Leitbild

**Stilisiertes 3D-Sci-Fi mit atmosphärischem Miniatur-Diorama-Look.**

Ashes of Meridian zeigt eine fremdartige, lebendige Welt aus der Perspektive eines
Strategiebretts: modellhafte Gebäude und Einheiten, charaktervolle Landschaften und
gezielt gesetzte Lichtakzente. Die Gestaltung ist nicht fotorealistisch, aber auch
nicht comichaft. Sie verbindet die Übersicht eines Strategiespiels mit der Stimmung
einer kleinen, räumlich glaubwürdigen Welt.

Kurzbeschreibung für die Außendarstellung:

> Eine atmosphärische Sci-Fi-Miniaturwelt mit stilisierten 3D-Modellen, industriellen
> Kolonien und leuchtenden Akzenten in fremdartigen Landschaften.

Diese Leitlinie beschreibt die gestalterische Richtung, keine Freigabe für einen
Grafikumbau. Technische Verträge und Assetpflege stehen in [Grafik und
Assets](rendering.md), die Gestaltung der Bedienoberfläche im
[UI-Designsystem](ui-design-system.md).

## Formen und Maßstab

- Klare Silhouetten und geometrisch reduzierte, bewusst gestaltete Formen tragen
  den Look. Modelle wirken wie sorgfältig gebaute Miniaturen, nicht wie grobe
  Platzhalter.
- Große Formen vermitteln Funktion und Identität; kleine Details ergänzen sie.
  Gebäude- und Einheitentypen sollen aus dem üblichen Gefechtsabstand unterscheidbar
  bleiben, nicht erst in der Nahansicht.
- Die industrielle Kolonie lebt von modularen Bauten, Metallflächen und technischen
  Aufbauten. Diese Sprache ist kein Zwang für alle Fraktionen: biologische und
  kristalline Formen behalten ihre eigene Identität im gemeinsamen Diorama-Look.
- Die Gefechtsansicht ist isometrisch anmutend, technisch aber eine drehbare
  orthografische 3D-Perspektive. „Low-Poly“ allein beschreibt den Stil nicht ausreichend:
  Geometrie, Oberflächen, Licht und Atmosphäre wirken zusammen.

## Oberflächen und Farbe

- Oberflächen vermitteln Materialcharakter, ohne die großen Formen durch kleinteilige
  Muster zu überdecken. Detail dient der räumlichen Wirkung, nicht maximaler
  realistischer Abnutzung.
- Gedämpfte Landschaftsfarben bilden die Bühne für technische und organische
  Akzente. Erdige, violette und blaugraue Töne sind charakteristische Beispiele,
  keine verbindliche Palette für jede Landschaft.
- Cyanfarbene und warmweiße Lichtdetails prägen die technische Kolonie. Andere
  Fraktions- und Landschaftsfarben bleiben möglich; gemeinsame Stimmung bedeutet
  nicht gleiche Farbgebung.
- Leuchtflächen sind gezielte Blickpunkte. Nicht jede Kante oder Struktur soll
  leuchten; dunklere Flächen geben den Akzenten Gewicht.

## Licht und Atmosphäre

- Dunst, weiche Lichtübergänge und Schatten geben den einfachen Formen Tiefe.
  Die Beleuchtung ist künstlerisch komponiert, nicht auf physikalischen Realismus
  verpflichtet.
- Tag und Nacht dürfen die Stimmung deutlich verändern. Nachts entsteht durch
  kühles Umgebungslicht und lokale Lichtinseln eine ruhige, geheimnisvolle, leicht
  melancholische Atmosphäre; Gelände und Spielobjekte müssen dennoch lesbar bleiben.
- Bloom unterstützt helle Akzente, soll aber Formen und Farbunterschiede nicht
  zu einem gleichförmigen Leuchten verschmelzen lassen.
- Der Tilt-Shift-Look verstärkt in der hohen Qualitätsstufe den Miniatureindruck.
  Er ist eine ergänzende Präsentationsebene, nicht die Voraussetzung für den Stil:
  auch ohne Unschärfe muss die Szene als zusammenhängende Modellwelt wirken.

## Lesbarkeit vor Inszenierung

- Atmosphäre unterstützt das Spiel, statt relevante Einheiten, Ressourcen,
  Auswahlzustände oder Kampfaktionen zu verdecken.
- Detail, Vegetation und Effekte sollen die Welt beleben, ohne die wichtigen
  Silhouetten und Bewegungen im Gefechtsbild zu überlagern.
- Die Bedienoberfläche bleibt klar und ungefiltert. Ihre semantischen Farben und
  Formen folgen dem UI-Designsystem, nicht frei der jeweiligen Landschaftsstimmung.
- Reduzierte Qualitätsstufen sollen dieselbe gestalterische Identität bewahren,
  auch wenn kosmetische Details und Nachbearbeitung entfallen.

## Gestalterische Abnahme

Neue Modelle, Materialien und Effekte werden im Zusammenhang mit der Welt beurteilt:
Passen Silhouette und Material zum Diorama-Look? Bleibt das Objekt im üblichen
Gefechtszoom erkennbar? Funktionieren Farbe und Licht am Tag wie bei Nacht? Unterstützt
es die Identität seiner Fraktion, ohne die gemeinsame Bildsprache zu verlassen?

Die Antworten erfordern menschliche visuelle Abnahme. Ein technisch erfolgreicher
Build bestätigt weder Stimmung noch Lesbarkeit; Prüfverfahren und technische Grenzen
stehen in [Testing](testing.md) und [Grafik und Assets](rendering.md).
