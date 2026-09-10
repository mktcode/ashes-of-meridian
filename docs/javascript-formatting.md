# JavaScript-Formatierung vor der ersten Auslagerung

## Umfang

Referenz vor dieser Änderung: Commit `9f3e55e` (CSS-Auslagerung).

Nur die Inhalte der sieben bestehenden Inline-Skripte in `index.html` wurden formatiert. Keine Umbenennungen, neuen Blöcke, Module, Klassen, Funktionen oder absichtlichen Verhaltensänderungen. `M4`, `V` und `seeded` bleiben vorerst im Renderer-Block. CSS, sonstiges HTML, Skript-Tags, Assets, Tests, Layout-Prüfsummen und Save-Fixture bleiben unverändert.

Mehrzeilige Methoden, eingerückte Kontrollflüsse und lesbare Objektdefinitionen ersetzen die überwiegend einzeiligen Methoden. Formatierungsbedingte Änderungen an Semikolons, Klammerdarstellung, Anführungszeichen und Zahlenschreibweisen wurden nicht mit einem bloßen Whitespacevergleich bewertet, sondern mit dem unten beschriebenen Syntaxbaumvergleich.

## Werkzeug und Schutz der Literale

Einmalig verwendet: **Prettier 3.8.3** und **Babel-Parser 7.29.3** aus einem bereits vorhandenen lokalen npm-Cache. Es wurde nichts installiert und keine neue Projekt-, Laufzeit- oder Testabhängigkeit eingeführt. Die Anwendung und die bisherigen Node-Tests benötigen diese Werkzeuge weiterhin nicht.

Jeder Skriptinhalt wurde separat als JavaScript formatiert; nicht das gesamte HTML. Verwendete Prettier-Optionen:

```json
{
  "parser": "babel",
  "tabWidth": 2,
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "none",
  "arrowParens": "avoid",
  "quoteProps": "preserve",
  "embeddedLanguageFormatting": "off"
}
```

Danach wurde außerhalb der vom Babel-Parser ermittelten Template-Segmente die vier Leerzeichen breite HTML-Skripteinrückung ergänzt. Innerhalb von Template-Literalen wurden keine Leerzeichen hinzugefügt: Das würde etwa GLSL-Shader oder HTML-Strings verändern. Die langen eingebetteten Bild-Data-URLs wurden weder umgebrochen noch neu kodiert. Ein zweiter Durchlauf erzeugt exakt denselben Inhalt.

## Ausgeführte Prüfungen

- Beide Fassungen jedes Skripts mit Babel und `sourceType: 'script'` geparst und rekursiv verglichen. Ausgenommen wurden nur Quellpositionen (`start`, `end`, `loc`), `extra`-Metadaten (etwa ursprüngliche Literal-Schreibweise und überflüssige Klammern) sowie die positionsabhängige Zuordnung von Kommentaren zu Knoten. Die zentrale Kommentarliste wurde weiterhin verglichen.
- **Alle sieben normalisierten Syntaxbäume sind identisch**, einschließlich Anweisungsreihenfolge, Operatoren, Bezeichnern, Direktiven, Literalwerten, Template-Rohtexten und Kommentarinhalten.
- Zusätzlich Rohtexte sämtlicher `TemplateElement`-Knoten und `data:image/`-Stringliterale verglichen: **246 Segmente/Literale bytegleich**, einschließlich Shader- und UI-Templates sowie eingebetteter Texturen.
- HTML außerhalb der Skriptinhalte sowie `styles.css` und die vier Bilddateien mit der Referenz verglichen: unverändert.
- Vollständiger [Node-Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux: **44 bestanden, 0 fehlgeschlagen**, insbesondere alle 16 Layout-Prüfsummen und der Fünf-Sekunden-Referenzspielstand.
- Lokale Dokumentationslinks/Anker und `git diff --check` geprüft.

### Erneuter Browservergleich

Die temporäre Chromium-Probe aus der [CSS-Auslagerungsprüfung](css-extraction.md#browservergleich-über-file) wurde unmittelbar vor und nach der Formatierung wiederholt: Chromium `152.0.7977.75` auf Linux, headless, separates temporäres Profil, `file://`, keine abgeschwächten Sicherheitsflags. Menü, Kampagnenansicht, Settings und unmittelbar pausierter Missionsstart wurden jeweils bei 1280×800 und 800×700 geöffnet.

Alle acht erfassten Stil-/Abmessungssätze stimmen exakt überein. WebGL-Kontext und Anwendung sind vorhanden; der Ladebildschirm verschwindet. Screenshots wurden erzeugt, das HUD bei 1280×800 nach der Formatierung zusätzlich gesichtet. Kein pixelweiser Vergleich der animierten Szene.

Keine neuen erfassten Laufzeitausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcenabrufe. Der bekannte `SecurityError` beim Skybox-Upload besteht unverändert; Fehlertexte wurden ohne die durch Formatierung verschobenen Zeilennummern verglichen. Der Nutzer meldet dieselbe Einschränkung auch für Firefox, ohne Versions-/Umgebungsangabe; die Korrektur bleibt auf seinen Wunsch zurückgestellt.

## Grenzen und nächster Schritt

AST-Gleichheit und Referenztests sind kein vollständiger E2E-Nachweis. HTTP-Start, andere Browser durch den Assistenten, Audio, interaktive Eingaben, Browser-Save/Load, Backup-Transfer, Performance und vollständige Missionsverläufe wurden nicht geprüft. Die Browserprobe öffnet Ansichten über die bestehenden Spiel-/UI-Methoden und ersetzt keine Maus-/Tastaturprüfung.

Nächster separater Schritt: Mathematik und RNG charakterisieren, dann `M4`, `V` und `seeded` nach `core.js` auslagern und den Testloader auf explizite lokale klassische Skriptdateien erweitern. Noch kein Serverwechsel, Build oder TypeScript-Umstieg in diesem Formatierungscommit.
