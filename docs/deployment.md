# Statisches Webdeployment

Die [öffentliche Testversion](../README.md) wird über Dokploy ausgeliefert. Kein Backend, keine Datenbank, persistenten Volumes oder Laufzeitvariablen. Lokale `file://`-Auslieferung bleibt unabhängig davon unterstützt.

## Docker und Dokploy

Das [Dockerfile](../Dockerfile) baut mit `npm ci` und `npm run build` und stellt die benötigten Laufzeitdateien für Nginx zusammen. Es ist die maßgebliche Auslieferungsliste: HTML, Styles, gebaute Skripte sowie lokale Musik und Portraits. WebGL-Texturen sind bereits eingebettet; Quelltexturen, Tests, Dokumentation und Source Maps gehören nicht ins Laufzeitimage.

In Dokploy **Dockerfile** als Build-Typ und intern **HTTP-Port 8080** konfigurieren. Domain, öffentliches HTTPS und Zertifikate übernimmt der Proxy. `GET /` dient als Healthcheck, zusätzlich im Image hinterlegt. Keine weiteren Startbefehle nötig.

Die [Nginx-Konfiguration](../nginx.conf) verwendet absichtlich **keinen SPA-Fallback**: fehlende Skripte/Assets müssen 404 liefern, nicht HTML. Solange Dateinamen keine Inhalts-Hashes tragen, verhindert Revalidierung gemischte Versionen nach Rollouts. HTML/CSS/JavaScript werden beim Build vorab gzip-komprimiert.

Lokal starten:

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

Dann `http://localhost:8080/` öffnen. Bei Containeränderungen gezielt Imagebau, Healthcheck, MIME-Typen, 404-Verhalten und erforderliche Laufzeitassets prüfen; weitere Browserprüfungen nach [Risiko](testing.md). Öffentlich HTTPS verwenden.

## Zustandsgrenzen

Profile liegen im `localStorage` des jeweiligen Browser-Origins. Domain-/Protokollwechsel erzeugt aus Browsersicht ein anderes Profil; es gibt keine serverseitige Sicherung oder Synchronisierung. Das Hosting macht flüchtige Runs nicht wiederherstellbar.

Das Image ist keine Android-App. Eine mögliche Hülle mit Werbung bleibt eine [zurückgestellte Option](issues/android.md), kein Auslieferungsvertrag.
