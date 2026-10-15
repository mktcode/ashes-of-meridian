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
aus und lädt nicht automatisch Bilder oder GPU-Ressourcen.
Das [Landscape-Package](../../packages/landscape/README.md) enthält den eigenständigen
Import-/Höhen-/Meshkern mit typisierter API und optionalem Crowd-Adapter.
Generator, vollständiger Materialrenderer und Editor bleiben außerhalb dieses Packages.

Die [Crowd-Simulation](../../packages/crowd-simulation/README.md) besitzt einen
generischen rechteckigen Höhenfeldvertrag mit expliziter Zeilenrichtung,
Zellendiagonale und Randbehandlung. Navigation verwendet die maximale Neigung
beider tatsächlichen Zelldreiecke. Der CPU-Kern ist unabhängig von DOM/WebGL;
eine typisierte Fassade sowie Node- und klassische Browser-Bundles sind vorhanden.
Die eigenständige Terrain/Crowd-Demo lädt echte STRATA-Spielkarten offline über das
Landscape-Package und verwendet die bestehenden Marine-/Panzerprofile und Referenzmodelle.
Editor und eigentliche Spielsimulation verwenden die Packages noch nicht gemeinsam.

Die vorhandenen [Crowd-Prüfungen](../../packages/crowd-simulation/README.md#prüfen-und-messen)
vergleichen Speicherorientierungen und Diagonalen mit einem unabhängigen Dreiecksmesh.
Synthetische rechteckige 2-m-Felder prüfen Körperfreiheit, Gegenverkehr, vollständige
Ankunft, stabile Parkplätze, Kontakt/Rückzug und reine Renderinterpolation.
Zusätzliche Crowd-Skalierungsfälle verwenden keine STRATA-Karten. Landscape-Adapterprüfungen
vergleichen dagegen einen echten Export mit seinen tatsächlichen Meshdreiecken, prüfen
alle Wege der Beispielkarte profilbezogen und vollständige Ankunft kleiner Gruppen.
Eine Karte ersetzt keine Abnahme sämtlicher Seeds, Parameter und Gruppengrößen.

Die technische Browser-/GPU-Abnahme der Terrain-Demo ist unter dem festen Task-Limit
durch Chromiums Thread-Erzeugung (`pthread_create`) und anschließenden Timeout blockiert.
Auch die vollständige Editor-Browserprüfung, reale große Texturpakete, visuelle Abnahme
und Spiel-/Zielgeräteintegration bleiben offen.

## Package-Grenzen und Datenbesitz

- [ ] Generator, vollständige Terrain-Darstellung und Editor als getrennte Einstiege
  zum vorhandenen Datenpackage übernehmen. Bibliothek, Vorschau, Local Storage und
  Authoring-Werkzeuge dürfen keine Abhängigkeiten der Spielsimulation werden.
- [ ] Die typisierten öffentlichen Grenzen auf diese weiteren Bereiche ausdehnen.
  Vorhandene JavaScript-Interna können hinter einer TypeScript-Fassade bleiben;
  eine vollständige Umschreibung ist keine Integrationsvorbedingung.
- [ ] Karten-/Materialimport und Paketversionen an den Verbraucher anbinden.
  Tatsächlich installierte Geometrie und noch nicht angewendete Editorparameter
  auseinanderhalten. Keine stille Neugenerierung, Höhenreparatur oder doppelte
  Skalierung beim Laden. Das Verhältnis von Runtime-Codebeigaben und künftigem
  Packagebezug entscheiden, ohne zwei unabhängig gepflegte Laufzeiten zu schaffen.
- [ ] Beim Spielanschluss Crowds bestehenden Positionsbesitz erhalten und Crowd-Schritte
  über die feste Simulationsuhr des Spiels takten. Terrain liefert Geometrie, Crowd
  Bewegung und profilbezogene Navigation; keine konkurrierende Positionskorrektur
  oder zweite Simulationsuhr. Renderinterpolation darf die Simulation nicht verändern.

## STRATA-Oberfläche auf Crowd abbilden

Maßgeblich ist der [Crowd-Oberflächenvertrag](../../packages/crowd-simulation/README.md#oberflächenvertrag)
mit seinen [öffentlichen Typen](../../packages/crowd-simulation/src/contracts.ts).
Der Adapter erhält Ausdehnung, Zeilenrichtung und physische Diagonale ohne Padding,
Umsampling oder zweite Höhenskalierung. Die Demo fragt tatsächliche Profilfreistellung
ab und wählt innere Zugänge statt der äußeren Exportportale.

- [ ] Die technische Browser-/GPU-Abnahme für Mesh, Profil-Overlay, Picking, Pause,
  Dateiladen und Weltwechsel abschließen; CPU-Verträge sind kein Ersatz dafür.
- [ ] Höhen-/Neigungsübereinstimmung und nutzbare Spawn-/Zielbereiche auf repräsentative
  Laborexporte ausdehnen. Die spätere Hostanbindung muss dieselbe Makrooberfläche für
  Kollision, Navigation, Picking, Fuß-/Gebäudeauflage und Darstellung verwenden.
  Kosmetisches Materialrelief schafft keine Gameplay-Höhe.

## Weggarantie und tatsächlicher Verkehr

- [ ] Die konstruktive Gelände-Breiten-/Steigungsgarantie für Radius 0 in eine
  profilbezogene Abnahme übersetzen. Grad in Gradient umrechnen; vorhandene
  Steigungsgrenzen und Körperradien nicht an Generatorwerte anpassen.
- [ ] Süd–Nord-Aufstieg, sämtliche Äste, Rundwege, Kurven und Kreuzungen mit den
  tatsächlichen Marine-/Panzerprofilen prüfen. Konservative Rasterfreistellung
  sowie ausreichende Spawn-, Park- und Ankunftsflächen berücksichtigen.
- [ ] Die vorhandenen kompakten Kleinkörperinseln mit kreuzenden Panzer-Durchfahrten
  auf Laborkarten abnehmen, auch bei gedrehten Formationen und späten Spawns.
  Neue Parkformationen berücksichtigen die größte bereits vorhandene Körperklasse;
  später hinzukommende größere Körper ordnen bestehende Parkplätze nicht neu.
  Konservative Wand- und Gruppenabstände bleiben für die nutzbare Fläche relevant.
- [ ] Statische Durchgängigkeit von vollständiger Gruppenankunft und Gegenverkehr
  unterscheiden. Vorhandene synthetische Regressionen als Ausgangspunkt verwenden,
  reservierte Plätze und freie Durchfahrten aber auf tatsächlich importierten Karten
  belegen. Begrenzte Recovery ist kein allgemeiner Deadlock-Nachweis.
  Dynamische Hindernisse und Kartenänderungen sind keine zugesicherten Crowd-Funktionen.

## Offline-Auslieferung und Renderanbindung

- [ ] Den [Offline-Ladevertrag](../architecture.md#auslieferung) über Importkern und Demo
  hinaus auf die vollständige Laborlaufzeit ausdehnen. Shader-/Asset-Fetches und
  Modul-Worker benötigen einen passenden Build und serverlosen Texturladeweg.
  Keine Laufzeit-Imports, CDN oder gelockerten Browserberechtigungen einführen.
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
- [ ] Die vorhandenen synthetischen Skalierungsfälle für repräsentative importierte
  Laborkarten ergänzen: Speicher und Aufbaukosten pro Körperklasse und Zielfeld,
  defensive Höhenkopien sowie globale Spawn-/Formationssuchen untersuchen. Ein grobes
  Gitter begrenzt nicht automatisch die Zahl geometrischer Parkplatzkandidaten;
  synthetische Ankunftsfälle sind kein Zielgeräte-Performancebeleg.
  Erst konkrete Kostenbefunde begründen einen Solver-/Suchraumumbau.

## Integrationsfolge und Abnahme

1. Technische Browser-Abnahme der unabhängigen Terrain/Crowd-Demo abschließen;
   profilbezogene Wege und Ankunft auf repräsentative importierte Laborkarten ausdehnen.
2. Generator, Materialdarstellung und Editor mit klaren Daten-/Ressourcengrenzen ins
   Package übernehmen, ohne die unabhängige Demo oder den Offline-Vertrag aufzugeben.
3. Suchkosten und größere Gruppen-/Gegenverkehrsfälle nach eigener Freigabe untersuchen.
   Erst danach Terrainpass und vollständigen Spielanschluss vornehmen.
4. Beleuchtung, Materialmaßstab, Bodenkontakt, Picking und Zielgerätebudgets im Spiel
   menschlich abnehmen. Eine technische Import-/Shaderprüfung schließt dies nicht ab.

Prüfungen nach den [Prüfregeln](../testing.md) auswählen. Bestehende RNG-Reihenfolge,
Hindernisse, Radien, Referenzen und Save-Verträge schützen. Keine automatische
Freigabe für breite KI-/Simulationsläufe, Langläufe oder Geräteabnahme.

Verwandte offene Arbeit: [Terrain/Starts](terrain-generation.md),
[Navigation/Liveness](navigation-worker-und-gruppenankunft.md),
[Performance/Mobilstabilität](performance-und-mobilstabilitaet.md) und
[menschliche Bildabnahme](landschaften-und-taktische-darstellung.md).
