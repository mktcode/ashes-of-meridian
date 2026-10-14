# Zurückgestellte Produktideen

Keine Implementierungsfreigabe. Zuerst [Kernspiel und Geräte](projektfahrplan.md) abnehmen;
Regeln/Abhängigkeiten jeweils vor einem konkreten Auftrag entscheiden.

## Skirmish und Communitykarten

Skirmish: Parteien/KI, Startbedingungen und Profiltrennung klären. Karten-/Fraktionswahl
mit anschaulichen Vorschaufeldern statt Dropdowns; `file://` und schmale Displays erhalten.

Danach lokaler Kartenimport im profilfreien Modus, keine Sharingplattform oder Editor.
Eigene Geometrie/statische Objekte plus autoritative CPU-Höhen/Masken/Starts/Ressourcen,
kein fremder JS-/Shadercode. Eine spielbare Höhe je X/Z bleibt Systemgrenze.
ZIP mit versioniertem `map.json`, begrenztem `scenery.glb` und WebP/Qualität 80 ist ein
Vorschlag, noch kein Format oder vorhandener GLB-Loader. Numerische Höhendaten, keine
verlustbehafteten Höhenbilder oder erforderlichen `.bin`-Dateien. Erst Schema und gültige
Beispielkarte, dann KI-Generierung. ZIP-Bomben, Traversal, externe URIs und unbekannte
Erweiterungen abweisen; GPU-/Datenbudgets und CPU-/GPU-Spielbarkeit prüfen.
Teilen braucht separat Rechte, Moderation und Versionierung; keine automatische Expeditionseinbindung.

## Holdout

Zeitlich begrenzter Missionspilot auf dedizierter Karte, nicht der implementierte endlose
Außenposten mit selbst gestarteter Evakuierung. Schutzobjekt, Dauer, Vorbereitung,
Wellentakt/-etat, Richtungen, Endwelle, Wirtschaft/Walling und Belohnung klären;
Niederlage bei Gleichzeitigkeit bevorzugen. Simulation besitzt Timer/Ergebnis,
Snapshot den laufenden Wellenfortschritt. Eigener Wellenstream, begrenzte Spawns,
keine Teleports oder generische Skriptsprache. Keine neuen Türme dadurch beschlossen.

## Weitere Vorteile

Unverbindlicher Pool, bestehende Progression zuerst abnehmen:

- Schutzeskorte: Commander nimmt nahen Freundschaden, darf daran sterben;
  Schadens-/Schild-/Flächenreihenfolge und Rekursionsschutz klären.
- Veteran: vorgeschlagen +10 % Commander-Leben, stapelbar, auch nach Rekonstruktion.
- Feldlogistik: tatsächlicher Worker-Abbau nahe Commander, nicht HQ-Lieferung.
- Bewegung: vorgeschlagen +1 % Kampftempo, stapelbar.
- Erstes Turret kostenlos: erst erfolgreiche Platzierung verbraucht Effekt;
  Abbruch/Verkauf/Fehlerregeln klären.
- Commander statt Fabrik autorisiert Orbital Strike; Tod sperrt, Rekonstruktion entsperrt,
  übrige Bedingungen unverändert. Separat von Auren balancieren.
- Permanenter Start-Nachhall: Nutzen/Fördervoraussetzung und Lieferhöchststände entscheiden;
  heutige Evakuierung rettet keine Ressourcenbestände.
- Ohne Regelentwurf: Fortification kit, Veteran cadre, Emergency logistics,
  Salvage protocol, Commander recovery; Überschneidungen zuerst auflösen.

2vs2-Auren brauchen explizite Allianz-/Besitz-/Stapelregeln; Nichtfeindschaft ist keine
Allianz. Identische Auren vorgeschlagen nicht stapeln, keine Modifierarchitektur auf Vorrat.

## Atmosphärische Blickfänge

Vorschlag genau ein zufällig gewähltes, einmaliges 3D-Motiv pro Karte, ohne Ressourcen-/
Missions-/Belohnungsmechanik oder sichtbaren „Point of Interest“-Namen:
riesiges Echo-Kristallvorkommen, kleiner Vulkan, halb versunkenes Alien-Skelett mit
rippenförmigen Torbögen, zerbrochenes Sternentor mit kurz aufblitzendem fremden Himmel,
oder Forschungsschiff von großem Baum durchwachsen, mit einzelner Positionsleuchte.
Motivauswahl, Landschaftseignung, Platzierung/Freiraum und Geometriekosten offen;
RNG und Zugänge schützen, Wirkung im Gefechtszoom menschlich beurteilen.

## Android und Werbung

Erst Browser-Mobilstabilität. Werbefreier Capacitor-Prototyp ist Kandidat, kein SDK-Beschluss.
WebView-/Touch-/Safe-Area-, Zurück/Ausrichtung-, Audio/Hintergrund-, Speicher/Thermik-/
Prozessendeprüfung sowie Paket/Berechtigungen/Signierung/Storeanforderungen klären.
Kein Profiltransfer zugesagt. Werbung erst danach: freiwillige Rewarded Ads an Übergängen,
Belohnung genau einmal, kein Offlineblocker/Gefechtszwang. Ökonomie, Datenschutz,
Einwilligung/Zielgruppe entscheiden; Entwicklung nur Testanzeigen.
Offizielle [Capacitor](https://capacitorjs.com/docs/android)-,
[AdMob](https://developers.google.com/admob/android/quick-start)- und
[Play](https://play.google/developer-content-policy/)-Vorgaben dann neu prüfen.

## Multiplayer

Singleplayer-only. Gemeinsame Parteien/Aktionen sind kein zugesagter Netzwerkmodus.
Vor Neubewertung: Beziehungen/Sieg/Pause, Run-/Upgrade-/Savebesitz, Wiedereinstieg/
Host-Ausfall, Autorität/Sicht/Content, Authentifizierung und Missbrauchs-/Puffergrenzen.
Reale Geräte mit Latenz/Jitter/Loss/Mobilfunkwechsel abnehmen; frühere Mobilfunkabbrüche
blieben ohne geeignete Metriken ungeklärt. Alte Kapazitätswerte sind kein Zukunftsbudget.

- [ ] **Offene Betriebsbereinigung, keine bloße Produktidee:** Betreiber klärt, ob alter
  separater Multiplayerdienst/öffentlicher Endpunkt noch läuft, und schaltet ihn ggf. ab.
  Kein automatischer Infrastruktur-/Deploymentzugriff durch Repositorypflege.
