# Texturvorbereitung: Ladefehler nicht als Erfolg behandeln

## Befund

Statische Codeprüfung auf Stand `937914e` bestätigt den weiterhin offenen Fehler: In [der Texturvorbereitung](../../src/renderer/runtime.ts) liefert `loadResidentTexture()` bei `Image.onerror` den Wert `false`. `prepareBattlefieldTextures()` wartet auf `Promise.all`, wertet dessen Ergebnisse aber nicht aus und meldet bei aktueller Request-Generation trotzdem Erfolg.

Damit können Menü-/Archivvorschau und Gefechtsstart mit nicht residenten Pflichttexturen fortfahren. Der [Anwendungsfehlerpfad](../../src/app.ts) für fehlgeschlagene Texturvorbereitung wird durch diese aufgelösten Ladefehler nicht erreicht. Kein im Browser reproduzierter Ausfall; kein Nachweis für einen Zusammenhang mit den [mobilen Grafikabbrüchen](performance/README.md#mobilstabilität-und-speicher).

## Offene Korrektur und Abnahme

- [ ] Erfolg nur melden, wenn alle für das aktuelle Profil erforderlichen Texturen resident sind. Tatsächlichen Ladefehler von einer überholten Anfrage unterscheiden; überholte Anfragen dürfen keinen Fehlerdialog über eine neuere Vorschau oder ein Gefecht legen.
- [ ] Aktuellen Ladefehler sichtbar melden, ohne Gefecht oder Vorschau als erfolgreich vorbereitet zu übernehmen; keine stillschweigende Freigabe der Ersatztexturen.
- [ ] Gezielte Regression: eine Pflichttextur scheitert, alle laden erfolgreich, konkurrierende Profilwechsel sowie gemeinsam genutzte laufende Loads. Request-/Residency-Verträge und Freigabe alter Texturen erhalten.
- [ ] Nach Korrektur einen gezielten `file://`-Browsercheck mit absichtlich fehlgeschlagener Textur durchführen: kein Gefechtsstart, nachvollziehbarer Fehlerzustand; keine Screenshotserie oder Performanceabnahme.

Keine Assetersetzung, RNG-/Weltänderung oder allgemeine Rendererbereinigung. [Prüfwahl](../testing.md).
