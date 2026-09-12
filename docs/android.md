# Android, Google Play und Werbung – zurückgestellte Option

**Status:** Nur Vorüberlegung, kein Umsetzungsauftrag. Zuerst das Spiel weiterentwickeln und auf echten Mobilgeräten prüfen. Es gibt bislang weder Android-Projekt noch Werbe-SDK; die [bestehende Browserauslieferung](architecture.md#auslieferung) einschließlich `file://` bleibt erhalten.

## Möglicher technischer Weg

Der HTML-/CSS-/JavaScript-/WebGL-2-Stack eignet sich grundsätzlich für eine Android-Hülle; eine native Neuentwicklung ist nicht erforderlich. Bevorzugter Kandidat für einen späteren Prototyp ist **Capacitor**, noch keine verbindliche Werkzeug-/Pluginentscheidung:

1. `npm run build` ausführen und HTML, Styles, benötigte Assets sowie `dist/src/` in ein dediziertes Web-Auslieferungsverzeichnis zusammenstellen (nicht das gesamte Repository verpacken).
2. Capacitor übernimmt diese Dateien ins Android-Projekt und zeigt sie in einer lokalen WebView. Das Spiel bleibt ohne externen Server offline nutzbar; Anzeigen benötigen Internet.
3. Native Funktionen über Plugins oder eine kleine Android-Brücke anbinden. Android Studio/Gradle erzeugen ein signiertes Android App Bundle (`.aab`) für Google Play.

Alternativen: Eine Trusted Web Activity/PWA benötigt öffentliches HTTPS-Hosting und erschwert die native AdMob-Anbindung. Eine eigene WebView-Hülle bedeutet mehr Android-Wartung. Beides erscheint derzeit weniger passend als ein kleiner Capacitor-Versuch.

## Vor einer Veröffentlichung prüfen

- WebGL 2 in Android-WebViews, Grafik-/Kontextverlust, Startzeit, Speicher, Bildrate, Wärme und Akku auf echten, auch schwächeren Geräten. Browser-Headless-Tests sind dafür kein Nachweis.
- Touch, Android-Zurück-Taste, Vollbild, Displayausschnitte/Safe Areas und gewünschte Bildschirmausrichtung.
- Hintergrundwechsel, Pause/Fortsetzen und Audio. Android kann den Prozess beenden: Der heutige flüchtige Run geht dann verloren; eine Run-Speicherung ist nicht beschlossen.
- Profil-/`localStorage`-Verhalten bei App-Neustart, Updates, Löschen der App-Daten und Neuinstallation. Kein automatischer Profiltransfer vom Browser zur App zugesagt.
- Paketgröße, benötigte Berechtigungen, Asset-/Audio-Lizenzen und Store-Tauglichkeit.

## Werbung als spätere Integration

Möglicher Anbieter: **Google AdMob über das native Android-SDK**, angebunden durch ein gepflegtes Capacitor-Plugin oder eine kleine eigene Brücke. Wartung, SDK-Kompatibilität und Datenschutzumfang vor der Auswahl prüfen.

- Freiwillige **Rewarded Ads** an Ergebnis-/Menüübergängen wären ein Kandidat. Belohnung und Einfluss auf die Aether-Ökonomie sind ausdrücklich noch offen; nur nach bestätigtem Abschluss und höchstens einmal pro Werbevorgang auszahlen.
- **Interstitials** allenfalls begrenzt an natürlichen Unterbrechungen, nicht mitten im Gefecht. Banner sind wegen des dichten mobilen HUDs eher ungeeignet.
- Fehlende Verbindung, keine verfügbare Anzeige oder Werbefehler dürfen das normale Spiel nicht blockieren. Pause, Audio und Rückkehr aus Anzeigen gezielt behandeln; keine Werbeabhängigkeit im Simulations-RNG.
- In Entwicklung ausschließlich Testanzeigen verwenden. Datenschutz-/Einwilligungsablauf etwa über Googles UMP-SDK nach den jeweils geltenden regionalen Vorgaben vor Anzeigenanfragen berücksichtigen; Datenschutzoptionen zugänglich halten.
- Datenschutzerklärung, Play-Angaben zu Werbung/Datensicherheit und Zielgruppe müssen die tatsächliche SDK-Datennutzung abbilden. Anforderungen an `app-ads.txt`/App-Verifizierung prüfen. Bei späteren Echtgeldkäufen digitaler Güter grundsätzlich Google Play Billing und geltende Ausnahmen/Programme prüfen; Käufe sind nicht geplant.

## Grober Veröffentlichungsablauf

Entwicklerkonto/Identitätsprüfung → Paket-ID, Versionierung und App-Signierung → Release-AAB → Store-Eintrag mit Icon, Screenshots, Beschreibung und Datenschutzerklärung → Inhaltsbewertung, Zielgruppe, Werbung und Data Safety → interne/gegebenenfalls vorgeschriebene geschlossene Tests → Pre-Launch-Bericht und Produktionsprüfung.

Google ändert Anforderungen: Target-API, SDK-Versionen, Kontovoraussetzungen, Testerzahl/-dauer und Werberichtlinien erst bei Umsetzung anhand der offiziellen Vorgaben festlegen. Verpackung als WebView allein garantiert keine Store-Freigabe.

**Spätere Reihenfolge:** Erst nach neuem Auftrag einen werbefreien Android-Prototyp auf einem echten Gerät prüfen; bei stabiler Technik anschließend über Werbeformat, Belohnungen und AdMob entscheiden.

## Offizielle Einstiegspunkte

- [Capacitor für Android](https://capacitorjs.com/docs/android)
- [AdMob Android-SDK](https://developers.google.com/admob/android/quick-start) und [Datenschutz/UMP](https://developers.google.com/admob/android/privacy)
- [Play Console-Hilfe](https://support.google.com/googleplay/android-developer/) und [Play-Richtlinien](https://play.google/developer-content-policy/)
