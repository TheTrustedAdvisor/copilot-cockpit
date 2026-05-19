# Architekturueberblick

## Kontext
Diese Seite beschreibt den funktionalen Fluss zwischen Benutzer, UI, API und Datenquellen.

~~~mermaid
flowchart LR
U[Benutzer] --> W[Web UI]
W --> A[Backend API]
A --> D1[App Daten]
A --> D2[Externe Quellen]
A --> O[Observability]
~~~

## Sequenz: Anfragefluss
~~~mermaid
sequenceDiagram
participant U as User
participant W as Web
participant A as API
participant D as Data

U->>W: Aktion ausloesen
W->>A: Request senden
A->>D: Daten lesen/schreiben
D-->>A: Ergebnis
A-->>W: Response
W-->>U: Anzeige aktualisieren
~~~
