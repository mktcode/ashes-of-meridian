# STRATA als Package und Crowd-Anbindung

Der Landschaftseditor STRATA aus `../../aom-shader/` (Pfad ab Repositorywurzel)
soll als Workspace-Package ins Spielrepository eingebunden werden. Editor,
Terrainlaufzeit und Crowd-Anbindung haben getrennte Verantwortlichkeiten.
Dieses Issue beschreibt offene Integrationsarbeit, keine Implementierungs-,
Balancing- oder Testfreigabe.

## Ausgangsbasis

STRATA ist ein JavaScript-/GLSL-Editor mit integrierter Materialbibliothek.
Die feste Flächenvorschau nutzt dieselben Shader und Materialarrays wie die
Landschaft; ihre Aktualisierung ist entprellt und ihr Layout reserviert.
Zonen-/Rollenbelegungen besitzen unabhängige Material- und Palettenwerte.
Die acht Grundmaterialien und ihre Quellen stehen zur Verfügung;
Materialerzeugungswerkzeuge sind von der Editorlaufzeit getrennt.

Spielkarte und Materialgestaltung haben getrennte ZIP-Export-/Importformate.
Die tatsächlichen Höhen samt eingerechnetem Höhenmaßstab sind maßgeblich,
nicht eine Neugenerierung aus dem Seed. Der Datenimport führt keinen Archivcode
aus und lädt nicht automatisch Bilder oder GPU-Ressourcen. Die beigefügte
JS-/GLSL-Laufzeit ist noch kein eingebundenes Workspace-Package.

Die [Crowd-Simulation](../../packages/crowd-simulation/README.md) besitzt einen
generischen rechteckigen Höhenfeldvertrag mit expliziter Zeilenrichtung,
Zellendiagonale und Randbehandlung. Navigation verwendet die maximale Neigung
beider tatsächlichen Zelldreiecke. Der CPU-Kern ist unabhängig von DOM/WebGL;
eine typisierte Fassade sowie Node- und klassische Browser-Bundles sind vorhanden.
Weder STRATA noch das eigentliche Spiel sind an diese Crowd angebunden.

Isolierte CPU-/UI-/Exportprüfungen, produktive Shaderprüfung und ein kleiner
WebGL-Vorschauvertrag belegen noch keine gemeinsame Landschaft/Crowd-Integration.
Die vollständige Editor-Browserprüfung ist unter dem festen Task-Limit durch
Chromiums Thread-Erzeugung blockiert. Reale große Texturpakete, visuelle Abnahme
und Spiel-/Zielgeräteintegration bleiben offen.

## Package-Grenzen und Datenbesitz

- [ ] STRATA als eigenständiges Workspace-Package mit klaren Einstiegen übernehmen:
  DOM-/WebGL-freier Gelände-/Datenkern, Terrain-Darstellung und Editorwerkzeug.
  Bibliothek, Vorschau, Local Storage und Authoring-Werkzeuge sind keine
  Abhängigkeiten der Spielsimulation.
- [ ] Öffentliche Daten-/API-Grenzen typisieren. Vorhandene JavaScript-Interna können
  wie beim Crowd-Package hinter einer TypeScript-Fassade bleiben; eine vollständige
  Umschreibung ist keine Integrationsvorbedingung.
- [ ] Karten-/Materialimport und Paketversionen an den Verbraucher anbinden.
  Tatsächlich installierte Geometrie und noch nicht angewendete Editorparameter
  auseinanderhalten. Keine stille Neugenerierung, Höhenreparatur oder doppelte
  Skalierung beim Laden. Das Verhältnis von Runtime-Codebeigaben und künftigem
  Packagebezug entscheiden, ohne zwei unabhängig gepflegte Laufzeiten zu schaffen.
- [ ] Besitz der Körperpositionen und Simulationszeit beim Spielanschluss eindeutig
  festlegen. Terrain liefert Geometrie, Crowd Bewegung und profilbezogene Navigation;
  keine konkurrierende Bewegungssimulation oder zweite Simulationsuhr.

## STRATA-Oberfläche auf Crowd abbilden

Maßgeblich ist der [Crowd-Oberflächenvertrag](../../packages/crowd-simulation/README.md#oberflächenvertrag)
mit seinen [öffentlichen Typen](../../packages/crowd-simulation/src/contracts.ts).
Es fehlt der konkrete Importadapter, nicht ein neuer generischer Höhenfeldvertrag.

- [ ] Das rechteckige 2-m-Laborfeld ohne quadratisches Padding, Glättung oder
  Umsampling übernehmen. Ausdehnung, tatsächliche Weltkoordinaten, Speicherstart,
  Zeilenrichtung und Diagonale gemeinsam abbilden. Der Speicherstart des Exports
  ist nicht automatisch Crowds kleinste X/Z-Ecke; bloße Zeilenumkehr verändert
  die physische Zellendiagonale.
- [ ] Höhen und maximale Zellneigungen gegen die tatsächlichen Labordreiecke
  unabhängig vergleichen: Ecken, Zellinneres, beide Dreiecke, Diagonalen und Ränder.
  Kollision, Navigation, Picking, Fuß-/Gebäudeauflage und Darstellung müssen dieselbe
  Makrooberfläche verwenden. Kosmetisches Materialrelief schafft keine Gameplay-Höhe.
- [ ] Randabfragen und Portale explizit anbinden. Laborabfragen ohne Boden und
  Crowds gewähltes Clamp-/Reject-Verhalten sind nicht dieselbe Schnittstelle.
  Clamping erweitert keinen Bewegungsraum; Spawn-/Zielbereiche müssen innerhalb
  des um Körperfreiheit begrenzten nutzbaren Korridors liegen.

## Weggarantie und tatsächlicher Verkehr

- [ ] Die konstruktive Gelände-Breiten-/Steigungsgarantie für Radius 0 in eine
  profilbezogene Abnahme übersetzen. Grad in Gradient umrechnen; vorhandene
  Steigungsgrenzen und Körperradien nicht an Generatorwerte anpassen.
- [ ] Süd–Nord-Aufstieg, sämtliche Äste, Rundwege, Kurven und Kreuzungen mit den
  tatsächlichen Marine-/Panzerprofilen prüfen. Konservative Rasterfreistellung
  sowie ausreichende Spawn-, Park- und Ankunftsflächen berücksichtigen.
- [ ] Statische Durchgängigkeit von vollständiger Gruppenankunft und Gegenverkehr
  unterscheiden. Reservierte Plätze und freie Durchfahrten auf den importierten
  Karten belegen; synthetische Crowd-Fälle und Export-Roundtrips ersetzen das nicht.
  Dynamische Hindernisse und Kartenänderungen sind keine zugesicherten Crowd-Funktionen.

## Offline-Auslieferung und Renderanbindung

- [ ] Den [Offline-Ladevertrag](../architecture.md#auslieferung) erhalten. STRATAs
  ES-Module, Shader-/Asset-Fetches und Modul-Worker benötigen einen passenden Build
  und serverlosen Karten-/Texturladeweg. Keine Laufzeit-Imports, CDN oder gelockerten
  Browserberechtigungen ins Spiel einführen.
- [ ] Den autonomen Laborrenderer als Terrainpass an den Host anbinden. Die bereits
  gemeinsam genutzte Materialvorschau löst diese Aufgabe nicht: WebGL-Kontext,
  Kamera, Frameplanung, Resize/Clear und gemeinsame Licht-/Bildpipeline gehören
  im Spielbetrieb dem Host. Ressourcenbindung und vollständige Freigabe von
  Workern, Timern, Listenern und GPU-Objekten vereinbaren.
- [ ] Quellen und Laufzeit-Assets nach [Assetpflege](../assets.md) und Zielgeräten
  festlegen. Die optionalen Quellen umfassen ungefähr 95 MiB und enthalten PNGs;
  nicht ungeprüft zum Standardpayload machen. Farb-, Normalen- und Datenkanäle bei
  einer WebP-/Laufzeitaufbereitung getrennt auf Qualitätsverluste prüfen.
  Erweiterung des Materialkatalogs mit Quelllagen-, Shader- und Speicherbudgets abstimmen.

## Größe und Suchkosten

- [ ] Das vorhandene 2-m-Raster als direkten Integrationseinstieg verwenden.
  Crowd koppelt Navigations- und Höhenfeldauflösung; eine feinere Navigation
  ist kein unabhängiger Regler. Die Demo-Auflösung nicht unbesehen übernehmen.
- [ ] Für repräsentative Laborkarten Speicher und Aufbaukosten pro Körperklasse
  und Zielfeld sowie die globalen Spawn-/Formationssuchen untersuchen. Ein grobes
  Gitter begrenzt nicht automatisch die Zahl geometrischer Parkplatzkandidaten.
  Erst konkrete Kostenbefunde begründen einen Solver-/Suchraumumbau.

## Integrationsfolge und Abnahme

1. Package-/Datenbesitz und Offline-Bauweg festlegen; den Terrainadapter gegen
   importierte Laborgeometrie ohne Renderer oder Gefecht prüfen.
2. Kleine gemeinsame Demo mit STRATA-Karte und tatsächlichen Marine-/Panzerprofilen
   anbinden; alle Wege, Körperfreiheit und Ankunftsbereiche gezielt abnehmen.
3. Suchkosten und tatsächliche Gruppen-/Gegenverkehrsankunft nach eigener Freigabe
   untersuchen. Danach Terrainpass und vollständigen Spielanschluss vornehmen.
4. Beleuchtung, Materialmaßstab, Bodenkontakt, Picking und Zielgerätebudgets im Spiel
   menschlich abnehmen. Eine technische Import-/Shaderprüfung schließt dies nicht ab.

Prüfungen nach den [Prüfregeln](../testing.md) auswählen. Bestehende RNG-Reihenfolge,
Hindernisse, Radien, Referenzen und Save-Verträge schützen. Keine automatische
Freigabe für breite KI-/Simulationsläufe, Langläufe oder Geräteabnahme.

Verwandte offene Arbeit: [Terrain/Starts](terrain-generation.md),
[Navigation/Liveness](navigation-worker-und-gruppenankunft.md),
[Performance/Mobilstabilität](performance-und-mobilstabilitaet.md) und
[menschliche Bildabnahme](landschaften-und-taktische-darstellung.md).
