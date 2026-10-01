# UI-Look aus der externen Demo übernehmen

Vorbereitung für einen späteren Umsetzungsauftrag; noch kein UI-/Asset-Umbau.
Ziel ist der Look der HTML-Demo, nicht deren simuliertes Spiel oder eine pixelgenaue
Übernahme des Smartphone-Layouts. Audio ist ausgeschlossen.

## Referenz und Befund

Lokale Vorlage: `/home/mkt/Downloads/Ashes-of-Meridian-Assets/Ashes-of-Meridian-Demo.html`.
Das benachbarte `README.txt` beschreibt Branding und Icon-Atlanten; die PNG-Mockups
sind ergänzende Bildreferenzen, nicht identisch mit der HTML-Gestaltung.
Die Vorlage liegt außerhalb des Projekts: vor Umsetzung benötigte Quellen gezielt
sichern, nicht auf den Downloads-Pfad als Laufzeitabhängigkeit verweisen.

Quellprüfung der Demo, ihrer Assetstruktur und der aktuellen UI sowie Sichtung von
Hauptmenü-Mockup, Logo und HUD-Atlas: der Look ist mit dem bestehenden HTML/CSS-System
vereinbar. Die Datei enthält zusätzlich JavaScript, eigene Speicherung und eine
HUD-Simulation. Diese sind keine Vorlage für Controller, Regeln oder Persistenz.
Keine Browser-/Echtgeräteabnahme, keine Builds oder Tests in dieser Vorbereitung.

## Übernehmbarer Look

- Dunkle Navy-Panels, feine Cyan-Kanten, zurückhaltende Verläufe und Glows,
  deutlich hervorgehobene Hauptaktion, technische Überschriften und Abstandsraster.
- Abgeschrägte Ecken: wie in der Demo nur dekorative Pseudoelemente clippen,
  nicht Button oder Fokusrahmen. Lesbare deaktivierte Zustände erhalten.
- Logo/Emblem, Checkpoint-Abzeichen und semantisch passende Ressourcen-,
  Navigations-, Upgrade- und Fähigkeitsicons aus dem Paket verwenden.
- Lokale Aldrich-Schrift mit beiliegender SIL-OFL-Lizenz ist verfügbar.
  Überschriften/Controls daran angleichen; kleine Fließtexte und Zahlen auf Lesbarkeit
  prüfen, statt alle Demo-Schriftgrößen und Laufweiten unverändert zu übernehmen.
- Gerenderte Menü-/Gefechtsszenen und Landschaftswechsel bleiben bestehen.
  Keine Demo-Hintergründe, Fraktionsbild-Crops oder statische Minimap importieren.

## Anpassung an das tatsächliche Spiel

| Fläche | Look-Vorlage und notwendige Anpassung |
| --- | --- |
| Hauptmenü | Logo, Checkpoint und Aktionshierarchie übernehmen; Codex-Zugang und echte Briefings mit allen Gegnern erhalten. Archivpfeile bleiben reine Landschaftsvorschau, nicht Checkpoint-/Run-Auswahl. |
| Neue Expedition | Fraktionskarten gestalten, aber heutige Namen/Freischaltungen/Traits verwenden. Auswahl von vier aus acht Command-Modulen samt Reihenfolge und Rängen muss Platz behalten. Startinfo aus heutigen Deployment-Regeln, nicht aus Demo-Texten. |
| Pause, Einstellungen, Manual | Panel-/Buttonstil übernehmen; nur vorhandene Optionen und Inhalte. Keine neuen Glow-/Motion-Einstellungen oder Demo-Reset-Funktion. Fokus-/Dialogverwaltung ist gesonderte technische Arbeit, siehe [UI-Review](ui-review.md). |
| Ergebnis/Vorteile | Belohnung, Auswahlkarten und nächstes Briefing gestalten; Niederlage, Freischaltungen, reale Angebote und mehrere Gegner berücksichtigen. Evakuierung und Gebäudeauszahlung getrennt sichtbar halten. Keine erfundenen Statistiken/Score-/HQ-Integrity-Anzeigen. Auszahlung und Bestätigung nicht verändern. |
| Flottenupgrades | Zeilen, Effektfeld und Levelsegmente übernehmen; Fleet Systems und alle Command Modules mit tatsächlichen Maximalrängen/Kosten erhalten. |
| Codex/Laden | Gleiche Formsprache ergänzen; die Demo bietet hierfür keine vollständige Vorlage. Bestehende Modellvorschauen erhalten. |
| Gefechts-HUD | Topbar, Navigation und Command-/Produktionsflächen angleichen, aber echte Minimap, Modellkacheln, Queue-Storno, Auswahlaktionen, Attack-move, Gruppenauswahl, Funk/Tutorial und Target-/Cooldown-/TECH-Zustände erhalten. Kein Ersatz durch die vereinfachte Demo-Konsole. |

Anzeigenamen kommen weiter aus dem Spiel: Cinder/Echo statt Alloy/Aether,
The Cinder Pact / The Manyroot / The Mourning Houses statt der alten Demo-Fraktionen.
Technische IDs und Contentwerte bleiben unverändert.

## Asset-Vorbereitung bei Umsetzung

Die HTML-Demo enthält bereits einzeln zugeschnittene Motive in `window.AOM_ASSETS`.
Diese vor erneutem Atlas-Cropping mit den PNG-Quellen vergleichen; die Atlasraster
sind laut Paket-README keine pixelgenauen Sprite-Koordinaten. Ein kleiner reproduzierbarer
Importer mit expliziter Motivauswahl wäre sinnvoll, kein kompletter Demo-Import.
Rasterausgaben nur als WebP Qualität 80 mit Alpha nach [Assetvertrag](../rendering.md#texturen-und-portraits).
Originale außerhalb des Projekts nicht ersetzen/löschen. Font lokal samt Lizenz bündeln;
`file://` und ZIP-Auslieferung ohne Netzwerkzugriffe prüfen.

Icons nach Bedeutung zuordnen, nicht anhand alter Beschriftung: z. B. Demo-Scan → `scan`,
Repair Field → `heal`, Orbital Strike → `orbital`, Reinforcements → `drop`.
Der Atlas deckt nicht alle aktuellen Fähigkeiten/Vorteile/Aktionen ab.
Für fehlende Motive zunächst vorhandene SVGs stilistisch anschließen, keine unpassenden
Atlasicons erzwingen. Bau-/Einheiten-Modellkacheln nicht durch Kategorieicons ersetzen.
Die gemeinsam verwendete `icon()`-Funktion nicht blind global auf Rasterbilder umstellen.

## Empfohlene Umsetzungsschritte

1. Benötigte Motive/Font sichern, Import und semantische Zuordnung festlegen.
   Gemeinsame Panel-/Button-/Typografiestile zuerst auf Nicht-HUD-Flächen umsetzen.
   Bestehendes [Designsystem](../ui-design-system.md) weiterentwickeln, keine zweite
   konkurrierende Theme-Schicht anhängen. Geometrie und Gestaltung getrennt halten.
2. Hauptmenü als erste abnehmbare Fläche, danach Expeditionsvorbereitung, Dialoge,
   Upgrades, Ergebnis und Codex. Produktinhalte und Controller unverändert lassen.
3. HUD separat integrieren. Die heutige Theme-Begrenzung schließt HUD, Toasts und
   Funk ausdrücklich aus; Erweiterung bewusst dokumentieren und Selektoren eingrenzen,
   nicht Demo-`:root`-/Buttonregeln kopieren. Alte CSS-Layoutkopplung berücksichtigen,
   keine beiläufige Komplettbereinigung. Weltviewport/Picking-Vertrag erhalten.

Nach Codeänderungen kurze gezielte Builds/Prüfungen. Browserdiagnose mit konkreten
Fragen: lokaler Font-/Assetzugriff unter `file://`, sichtbare Fokusrahmen, erreichbare
Aktionen/Scrollbereiche bei kleinen Hoch-/Querformaten und langen Mehrgegnerbriefings;
beim HUD zusätzlich dynamische Auswahl-, Queue-, Funk- und Fähigkeitszustände.
Desktop soll ein echtes breites Spiel-Layout bleiben, nicht der Smartphone-Rahmen mit
Demo-Seitennavigation. Keine Übernahme der sehr kleinen Demo-Labels oder dauerhaft
pulsierenden Effekte ohne Lesbarkeits-/Kostenprüfung. Reduced motion erhalten.
Visuelle, Touch- und Performanceabnahme auf Zielgeräten bleibt menschlich.
`test:ai`/`test:simulation` nur auf gesonderten aktuellen Nutzerauftrag.
