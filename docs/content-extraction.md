# Content-Auslagerung ohne Änderung der Spieldefinitionen

Referenz vor der Änderung: Commit `a3568ae`.

## Umfang

Der vollständige bisherige `content`-Block liegt jetzt in `content.js`: 968 Zeilen mit `FACTIONS`, `UNITS`, `BUILDINGS`, `TECH`, `META`, `BIOMES`, `CAMPAIGN`, `ACTS`, `ICON_PATHS` sowie `icon`, `unitName` und `buildingName`. Kommentar und Strict-Mode-Direktive wurden übernommen. Nur die vier Leerzeichen HTML-Einrückung wurden entfernt; keine neue Formatierung, Umbenennung oder Änderung von Werten, Texten, Kampagnenzuordnung und Reihenfolge.

An derselben Stelle zwischen `renderer` und `world` steht nun:

```html
<script data-meridian-script="content" src="./content.js"></script>
```

Weiterhin klassische synchrone Skripte mit gemeinsamen globalen Bindungen, keine ES-Module, kein Build und kein Serverwechsel. `content.js` muss zusammen mit `core.js`, `styles.css` und den Assets neben `index.html` ausgeliefert werden. Der vorhandene Testloader unterstützt diese Auslagerung bereits und wurde nicht verändert.

## Inhaltsvergleich und Node-Tests

- Nach Wiederanfügen der HTML-Einrückung ist `content.js` bytegleich zum vorherigen Skriptinhalt. Ersetzt man den neuen Tag durch den alten Block, entsteht exakt `a3568ae:index.html`. Damit sind auch alle übrigen Skriptinhalte, Texturen, Shader und Inline-Styles unverändert.
- Zusätzlich alten Inline-Block und neue Datei separat in Node-VMs ausgeführt: JSON aller neun Kataloge einschließlich ihrer Reihenfolge sowie Ausgaben der Namenshelfer für alle vorhandenen Einheiten/Gebäude je Fraktion und aller vorhandenen Icons identisch.
- `core.js`, `styles.css`, die vier Bilddateien, Save-Fixture und bestehende Layout-Prüfsummen mit der Referenz verglichen: unverändert.
- Ein neuer Harness-Test wurde zuerst gegen den alten Inline-Block ausgeführt und besteht nach der Auslagerung unverändert. Er lädt ausschließlich `content`, ohne Core/Renderer/DOM, und prüft klassische Bindungen, Katalogreihenfolge, die Seed-Reihenfolge aller 16 Missionen sowie Namens- und Icon-Hilfsfunktionen einschließlich bestehender Fallbacks. Das ist keine vollständige Schema-/Balancingvalidierung.
- Vollständiger [Node-Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit, ein Testworker: **59 bestanden, 0 fehlgeschlagen**. Keine Referenzwerte oder Fixtures neu erzeugt.
- Lokale Dokumentationslinks/Anker und `git diff --check` geprüft.

## Aktueller Vorher-/Nachher-Vergleich über `file://`

Unmittelbar vor und nach dieser Auslagerung wurde die erweiterte [Core-Browserprobe](core-extraction.md#aktuelle-chromium-prüfung-über-file) ausgeführt: Chromium `152.0.7977.75`, Linux, headless, jeweils separates temporäres Profil, keine abgeschwächten Sicherheitsflags, Audio stumm. Keine echten Nutzerspielstände verändert.

- Erfolgreiches Laden von `core.js` und `content.js` im Netzwerkprotokoll; Reihenfolge `core → renderer → content → world → simulation → audio → ui → app` bestätigt, ohne `async` oder `defer`.
- Menü, Kampagnenansicht, Settings und unmittelbar pausierter Missionsstart bei 1280×800 und 800×700: alle acht erfassten Stil-/Abmessungssätze vor/nach der Änderung identisch. Screenshots erzeugt; Kampagnenansicht bei 1280×800 und HUD bei 800×700 nachher zusätzlich gesichtet. Kein pixelweiser Vergleich der animierten Szene.
- Pause/Fortsetzen und Zoom über tatsächlich eingespeiste Mausereignisse geprüft. Heldbewegung, Rekrutierung, Depotbau und Ressourcenlieferung als API-gesteuertes Integrationsszenario mit 1.000 festen Simulations-/Effektschritten ausgeführt; nicht über vollständige Maus-Befehlszuweisung.
- Checkpoint über UI-Methode gespeichert, persistierten JSON nach vollständigem Neuladen identisch vorgefunden und Operation wiederhergestellt. Backup tatsächlich ins temporäre Profil heruntergeladen, dessen Storage/Operation geleert, Datei über `#importFile` mit DevTools importiert und Checkpoint geladen. Zeit und fertiges Depot bleiben erhalten. Keine Prüfung des nativen Dateiauswahldialogs oder identischer RNG-Fortsetzung.
- Nur dieselben drei Skybox-`SecurityError`-Ausnahmen je Vorher-/Nachher-Lauf (eine pro Seitenladung), keine neuen erfassten Laufzeitausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcenabrufe. Anwendung und WebGL aktiv, Ladebildschirm ausgeblendet. Keine Skybox-Korrektur in diesem Commit.

Die Probe und Rohartefakte liegen temporär unter `/tmp`, nicht als neue Projektabhängigkeit oder Browser-Testsuite im Repository. Testprofile und heruntergeladene Backups wurden entfernt.

**Nicht geprüft:** HTTP-Start, andere Browser, Audioausgabe, vollständige Maus-/Tastaturbedienung einschließlich Bauvorschau und nativer Dateidialoge, Performance sowie vollständige Kampagnenverläufe. Die vollständige Browser-Checkliste bleibt offen.
