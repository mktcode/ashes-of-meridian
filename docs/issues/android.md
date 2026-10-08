# Android/Google Play/Werbung: zurückgestellte Option

Kein Android-Projekt oder SDK, kein Implementierungsauftrag. Erst [Browser-Mobilstabilität](performance/README.md#mobilstabilität-und-speicher) und [Zielgeräte/volle Runs](playtest-validation.md) validieren. Werbefreier Capacitor-Prototyp ist Kandidat, keine Werkzeugentscheidung; bestehende `file://`-Browserauslieferung erhalten.

- [ ] WebView: WebGL/Stabilität, Touch/Safe Areas, Zurück/Ausrichtung, Hintergrund/Audio, Speicher/Wärme/Akku und [gespeichertes Gefecht](expeditions-spielstand.md) nach Prozessende/Update prüfen. Kein Profiltransfer zugesagt.
- [ ] Paketumfang, Berechtigungen, Asset-/Audio-Lizenzen und aktuelle Store-/Target-API-/Signierungs-/Testanforderungen klären.
- [ ] Werbung erst danach: freiwillige Rewarded Ads an Übergängen, bestätigte Belohnung genau einmal; kein Gefechtszwang oder Offlineblocker. Ökonomie, Datenschutz/Einwilligung/Zielgruppe und AdMob-Integration entscheiden; Entwicklung nur Testanzeigen.

Offizielle Quellen bei konkretem Auftrag neu prüfen: [Capacitor](https://capacitorjs.com/docs/android), [AdMob](https://developers.google.com/admob/android/quick-start), [Play-Richtlinien](https://play.google/developer-content-policy/).
