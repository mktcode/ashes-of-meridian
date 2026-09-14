# Android, Google Play und Werbung – zurückgestellte Option

Nur Vorüberlegung, kein Umsetzungsauftrag. Es gibt kein Android-Projekt oder Werbe-SDK. Zuerst [Geräte und vollständige Runs validieren](playtest-validation.md); die bestehende [Browserauslieferung](../architecture.md#auslieferung) bleibt erhalten.

## Möglicher Weg

Ein werbefreier **Capacitor**-Prototyp ist der bevorzugte Kandidat, noch keine verbindliche Werkzeugentscheidung. Nur gebaute Laufzeitdateien in einer lokalen WebView bündeln, nicht das ganze Repository. Native Brücke/Plugins nach Bedarf; Android Studio/Gradle erzeugen später ein signiertes App Bundle. Eine TWA verlangt HTTPS-Hosting, eine eigene WebView-Hülle mehr native Wartung.

Vor weiterer Planung auf echten Geräten WebGL 2, Kontextverlust, Startzeit, Speicher/Wärme/Akku, Touch, Zurück-Taste, Safe Areas/Ausrichtung, Hintergrundwechsel und Audio prüfen. Prozessende verliert das laufende Gefecht, der letzte Expeditionsübergang soll jedoch erhalten bleiben. Profil- und Checkpointverhalten bei Neustart/Update/Datenlöschung prüfen; kein Browser-App-Profiltransfer zugesagt. Paketgröße, Berechtigungen und Asset-/Audio-Lizenzen berücksichtigen.

## Werbung und Veröffentlichung

- AdMob über ein gepflegtes Capacitor-Plugin oder eigene native Brücke erst nach stabilem werbefreiem Prototyp bewerten. Freiwillige Rewarded Ads an Ergebnis-/Menüübergängen sind ein Kandidat; Belohnung und Einfluss auf Aether-Ökonomie bleiben offen. Nur bestätigte Abschlüsse einmalig belohnen.
- Interstitials allenfalls an natürlichen Unterbrechungen, nicht im Gefecht; Banner passen schlecht zum dichten HUD. Offline-/Werbefehler dürfen das Spiel nicht blockieren. Pause, Audio und Rückkehr behandeln, ohne Werbeabhängigkeit im Simulations-RNG.
- Nur Testanzeigen in Entwicklung. Aktuelle Einwilligungs-/Datenschutzvorgaben, UMP, Datenschutzerklärung, Zielgruppe, Play Data Safety und App-Verifizierung prüfen. Echtgeldkäufe sind nicht geplant; gegebenenfalls Play-Billing-Regeln neu bewerten.
- Bei Umsetzung Kontovoraussetzungen, Signierung, Target-API/SDK, Store-Inhalte, Testanforderungen und Freigabe anhand der dann geltenden Vorgaben klären. Eine WebView-Hülle garantiert keine Store-Zulassung.

Offizielle Einstiegspunkte: [Capacitor Android](https://capacitorjs.com/docs/android), [Capacitor Ads](https://capacitorjs.com/docs/guides/ads), [AdMob](https://developers.google.com/admob/android/quick-start), [UMP](https://developers.google.com/admob/android/privacy), [Play Console](https://support.google.com/googleplay/android-developer/), [Play-Richtlinien](https://play.google/developer-content-policy/).
