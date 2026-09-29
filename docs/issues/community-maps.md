# Importierbare 3D-Karten und späteres Teilen

**Produktziel, noch kein Implementierungsauftrag.** Spieler sollen eigenständig gestaltete 3D-Karten, auch mit KI-Unterstützung, als Datei erhalten und im Spiel importieren können. Mittel- bis langfristig sollen sie Karten veröffentlichen, finden und miteinander teilen können; eine Plattform dafür darf ein separates Webprojekt sein. **Im Spiel ist zunächst nur lokaler Import nötig**, weder Upload noch integrierter Editor oder Community-Katalog.

Die internen [Weltrezepte und festen Designs](../architecture.md#weltrezepte-und-feste-designs) trennen inzwischen Landschaftsseed und Atmosphäre und erlauben kuratierten Content, variable Instanzmaße und begehbares Relief. Das ist **kein** Importformat und ersetzt nicht den hier geforderten Import eigener Geometrie; für fremde Pakete weiterhin ausschließlich validierte Daten akzeptieren.

## Erster nutzbarer Umfang

- Eine lokale Kartendatei per Dateiauswahl öffnen und vor dem Spielstart prüfen. Das Spiel bleibt ohne Server über `file://` nutzbar. Als erster Modus bietet sich ein isoliertes Test-/Skirmish-Gefecht ohne Expeditionsfortschritt an; konkrete Parteienwahl und Start-UI vor Umsetzung festlegen. Importierte Karten nicht still in zufällige Expeditionen oder Multiplayer aufnehmen.
- Die **gesamte 3D-Gestaltung** muss möglich sein: spielbare Geländeform, Oberflächen, sichtbare statische Objekte und deren Platzierung; dazu Starts, Kristalle, Gas und spielrelevante Sperren/Bauverbote. Nicht auf „Seed plus Koordinaten auf einer vorhandenen Karte“ reduzieren. Für einen ersten Importer darf der unterstützte Umfang von GLB/Materialien bewusst begrenzt werden, muss aber eigene Kartengeometrie und WebP-Texturen ermöglichen.
- Karte als reine Daten importieren, keinen ausführbaren JS-/Shader-Code aus fremden Paketen ausführen. Begehbare Höhe, Kollisions- und Baumaske sind autoritative CPU-Daten; Renderer, Picking und Minimap müssen dazu passen. Ein dekoratives GLB definiert nicht automatisch Brücken, freie Wege oder Bauflächen. Das heutige Höhenmodell hat genau eine spielbare Bodenhöhe je `x/z`; mehrstöckige begehbare Welten wären ein **eigener** Ausbau.

## Paketentwurf (noch keine festgelegte Spezifikation)

```text
meine-karte.aommap.zip
├── map.json                 # Formatversion, Maße, Renderprofil, Starts, Ressourcen, Objektinstanzen
├── scenery.glb              # eigene statische 3D-Meshes; nur definierte Teilmenge von glTF 2.0
├── textures/
│   ├── ground.webp
│   └── rock.webp
└── preview.webp             # optional, keine Simulationsquelle
```

`map.json` soll zunächst auch numerische Höhenwerte und Kollisions-/Baumasken enthalten (gegebenenfalls als kompakt kodierte Arrays), **keine erforderlichen `.bin`-Dateien**. ZIP ist Transporthülle; ein einzelnes GLB kann die Spielregeln nicht ausdrücken. Koordinatensystem, Rasterauflösung, Höhenskala, Dreiecksdiagonale, Maskenbedeutung, Materialbindungen, Objekt-Transforms und Gas-/Kristall-Schema müssen versioniert dokumentiert werden. Keine verlustbehafteten WebP-Höhen- oder Kollisionsdaten; Bilder dienen nur der Darstellung. Dekor und Blocker ausdrücklich unterscheiden. Das heutige `resourceSites`-Schema erzeugt je Anker mehrere Kristalle und einen versetzten Gas-Vent; ob importierte Karten stattdessen einzelne Ressourcen/Vents explizit angeben dürfen, ist vor dem Formatvertrag zu entscheiden.

**Größenordnung als Planung, nicht Messwert:** Mit wiederverwendeten Meshes und einigen WebP-Texturen könnte ein Paket etwa 1–10 MB umfassen; viele individuelle Meshes/Texturen auch deutlich mehr. Uploadgröße allein begrenzt weder entpackte Daten noch GPU-Speicher. Größen-, Textur-, Raster-, Instanz- und Dreieckslimits erst anhand eines echten Prototyps und mobiler Geräte festlegen; ZIP-Bomben, Pfadtraversal, externe GLB-URIs, unbekannte Erweiterungen und übergroße Ressourcen abweisen.

## Umsetzungsschritte und offene Entscheidungen

1. **Datenvertrag/Beispielkarte:** Ein kleines handgebautes Paket inklusive eigener 3D-Form und Textur spezifizieren. Zulässige glTF-Funktionen, WebP-Qualität 80, Terrainauflösung, CPU-Masken, Ressourcenmengen, Platzierungsregeln und Formatversion festlegen. Der vorhandene GLB-Importer in `src/renderer/heavy-mesh.ts` unterstützt nur bestimmte Einheitenmodelle und ist **kein allgemeiner glTF-Loader**; Laden, Materialmapping, Freigabe und Fehlerbehandlung sind eigene Implementierungsarbeit. Bestehende Kartenrezepte und deren Seed-/RNG-Reihenfolge nicht dabei umbauen.
2. **Lokaler Import und Validierung:** ZIP nur im Speicher/Browser entpacken, Datei auswählen, verständliche Fehler melden und erst nach vollständiger Validierung starten. Prüfen: Grenzen und endliche Zahlen, vier geeignete Startkandidaten für die gewählten Regeln, HQ-/Bauflächen, Ressourcenzugang, Wegbreiten für Einheiten, sichtbare Blocker gegen CPU-Kollision sowie CPU/GPU-Höhenübereinstimmung. Spielbarkeit/Fairness zusätzlich menschlich prüfen; automatische Checks garantieren keine gute Karte.
3. **Späteres Teilen:** Export/Download mit stabiler Formatversion und Metadaten, danach optional ein separates Webprojekt für Upload, Vorschau, Suche und Moderation. Vor Hosting klären: Rechte an KI-/Drittassets, Melde-/Löschprozess, Inhaltsprüfung, Versionierung und Verteilung. Multiplayer benötigt später zusätzlich eine identische, vom Server akzeptierte Kartenfassung bei allen Teilnehmern; **nicht** Teil des ersten Imports.

Bezug: [Karten- und Höhenvertrag](../architecture.md#welt-darstellung-und-zufall), [Texturen/GLB und Terrain](../rendering.md), [späterer Skirmish-Dialog](new-battle-screen.md). Das Format ist derzeit nicht implementiert; ein Prompt darf keine heute bereits lauffähige `.aommap.zip` versprechen.

## Prompt-Vorlage für GPT-6, Fable oder ein vergleichbares Modell

Erst **nach** Festlegung eines maschinenlesbaren Schemas und einer gültigen Beispielkarte verwenden; beides zusammen mit diesem Prompt übergeben. Ohne diese Anlagen soll das Modell einen Konzeptentwurf liefern und fehlende Angaben erfragen, statt ein angeblich importierbares Paket zu erfinden.

> Du gestaltest eine eigenständige 3D-Karte für Ashes of Meridian. Nutze ausschließlich das beigefügte **AOM-Map-Schema Version [VERSION]**, die Beispielkarte und die zulässige Mesh-/Materialliste. Zielmotiv: [THEMA]; gewünschte Spielfläche/Spielerzahl: [VORGABE]. Erstelle spielbares Gelände mit gut lesbaren Höhen und Wegen, eigener statischer 3D-Szenerie, WebP-Texturen (Qualität 80), klaren Startflächen, erreichbaren Kristallen und Gas-Vents. Optik und Topologie sollen zusammenpassen; vermeide verdeckte Engstellen und für Einheiten sichtbare, aber unpassierbare Brücken. Verwende keine externen URLs, Skripte, Shader, fremden Marken oder Assets ohne belegte Nutzungsrechte.
>
> Liefere `map.json` gemäß Schema und, **falls du Dateien erzeugen kannst**, die referenzierten GLB-/WebP-Dateien in der vorgeschriebenen ZIP-Struktur. Kannst du Binärassets nicht erzeugen, liefere stattdessen ausdrücklich **nur einen Entwurf** mit einer konkreten Assetliste und Arbeitsschritten zur externen Erstellung (z. B. in Blender); behaupte nicht, die Karte sei importierbar. Erfinde keine Felder oder Engine-Funktionen. Gib für jede spielrelevante Fläche/Barriere an, welche CPU-Höhen-/Maskendaten ihr entsprechen. Prüfe Schema, Dateiverweise, Maße, vier Startflächen, Bau-/Bewegungsfreiraum, Ressourcenzugang, Dreiecks-/Texturbudget und die vom Schema geforderten Grenzen; dokumentiere nicht verifizierbare Punkte. Gib eine kurze Beschreibung, eine Liste der tatsächlich gelieferten Dateien und offene Risiken aus.
