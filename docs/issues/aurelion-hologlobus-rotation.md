# Aurelion: dominantes Hologlobus-Liniengerüst sichtbar drehen

## Beobachtung

Im Aurelion-Experiment bewegen sich die asymmetrischen Kontinentalprojektionen, das vom Nutzer gemeinte dominante Liniengerüst des Hologlobus wirkt jedoch weiterhin unbewegt. Gemeint sind insbesondere die hellen, teilweise diagonalen Linien, welche die Kugel optisch hauptsächlich aufbauen – nicht ein zusätzlich darübergelegtes prozedurales Längen-/Breitengradgitter.

Die menschliche Abnahme ist damit trotz technisch fortschreitender visueller Uhr und veränderter Einzelbilder fehlgeschlagen. Die Rotation darf nicht als erledigt oder visuell bestätigt bezeichnet werden. Übergeordneter Gestaltungsstand und Bedienung: [Aurelion-Visualstudie](aurelion-map.md).

## Aktueller technischer Aufbau

- `src/experiments/aurelion.ts` erzeugt `aurelionHologram` mit `ModelMesh.lobedShell`: `depth: 0`, 64 Segmente und 32 Ringe. Das Mesh besteht aus einzeln erzeugten Dreiecken mit flachen Flächennormalen.
- Der aktuelle Modellaufruf verändert `ry` mit der pausierbaren visuellen Zeit und behält kleine feste `rx`-/`rz`-Neigungen bei.
- `src/renderer/aurelion-atmosphere.ts` erzeugt zusätzlich aus `v_modelPos` Kontinente, Küsten, Längen-/Breitengrade und einen hervorgehobenen Meridian.
- `src/renderer/shaders.ts` übergibt skalierte mesh-lokale Positionen als `v_modelPos`; Weltposition und Normalen werden separat mit der Instanzmatrix transformiert.

Damit überlagern sich mindestens zwei optisch ähnliche Quellen: prozedurale Shaderlinien sowie Helligkeits-/Facettenwechsel des triangulierten Shell-Meshes. Die bisherigen Bildvergleiche haben diese Beiträge nicht zuverlässig getrennt.

## Bereits verworfene Ansätze

Folgende lokale, nicht übernommene Versuche erfüllten die menschliche Anforderung nicht und sind kein Reparaturvorschlag:

1. Längengradphase des prozeduralen Shadergitters zeitabhängig verschieben. Sichtbar bewegte Projektion, aber nicht das gemeinte Liniengerüst.
2. Ein stärkeres Längen-/Breitengradgitter um eine schräge Shaderachse drehen. Dadurch entstand erkennbar ein neues bewegtes Gitter über den weiterhin beanstandeten Linien.
3. Das Shell-Modell über eine aus einer schrägen Achse abgeleitete Instanzmatrix drehen. Kontrollierte Einzelbilder unterschieden sich, die menschliche Live-Abnahme erkannte jedoch weiterhin keine Bewegung der konkret gemeinten Linien.
4. Neue Firefox-Profile und eindeutige Dokument-URLs schlossen einen einfachen Seiten-/Skriptcache als ausreichende Erklärung aus.

## Nächste Untersuchung

Vor einer weiteren Gestaltungskorrektur die sichtbaren Beiträge isolieren, statt erneut Rotation auf Verdacht hinzuzufügen:

1. Einen lokalen Diagnosemodus mit identischer Kamera und eingefrorener Zeit erstellen, der nacheinander nur Shell-Facetten, nur prozedurales Gitter und nur Kontinentprojektion zeigt. Keine neue Produktionsästhetik daraus ableiten.
2. Anhand der Nutzerreferenz eindeutig markieren, welche Pixel/Linien zur gewünschten rotierenden Struktur gehören. Prüfen, ob sie aus flachen Normalen, Shadergitter, Triangulationsrichtung, transparenter Überlagerung oder Bloom entstehen.
3. Für genau diese Quelle zwei deutlich getrennte Orientierungen bei identischer Shaderzeit vergleichen. Der Vergleich muss die Zielstruktur isolieren; ein allgemeiner Pixelunterschied oder bewegte Kontinente genügt nicht.
4. Falls die dominanten Linien nur ein Beleuchtungsartefakt der Dreiecksflächen sind, ein explizites einzelnes Linienmodell erwägen, das die bestehende Optik ersetzt – nicht als zweites Gitter darüberliegt. Besitz, Transparenzreihenfolge, Tiefenverhalten und Bloom dabei festlegen.
5. Erst nach dem isolierten Nachweis die Animation wieder an die bestehende pausierbare visuelle Uhr anbinden und im normalen Livebild menschlich abnehmen lassen.

## Abnahmekriterien

- Das in der Nutzerreferenz gemeinte ursprüngliche dominante Liniengerüst ändert über wenige Sekunden klar erkennbar seine Orientierung.
- Es entsteht kein zweites, unabhängig bewegtes Gitter über einer statisch wirkenden Kugel.
- Kontinente, Küsten und Linien wirken als eine zusammengehörige Hologlobus-Struktur; keine gegeneinander rutschenden Ebenen.
- Pause, `still=1` und Reduced Motion frieren die gesamte Bewegung ein; `motion=1` bleibt nur ein ausdrücklicher Diagnose-Override.
- Stadt, Mittelplatz, Beleuchtung, Verkehr und normale Renderer-Shader bleiben unverändert.
- Abschluss erst nach menschlichem Okay; technische Screenshots oder Matrixänderungen allein gelten nicht als visuelle Abnahme.

## Grenzen

Dieses Issue betrifft nur die ungelöste visuelle Rotation des zentralen Hologlobus. Verkehrsnetz, Spielintegration, Navigation und Performanceoptimierung sind keine Nebenaufträge. Umfangreiche Testläufe sind für die Ursachenisolation nicht erforderlich; nach einer bestätigten Korrektur genügen zunächst Build, gezielte Rendererprüfung und menschliche Live-Abnahme.
