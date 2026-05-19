# Security und Compliance

## Sicherheitsmodell
- Authentifizierung über zentralen Identity Provider
- Autorisierung rollenbasiert
- Least-Privilege für Service-Zugriffe

## Secrets Handling
- Keine Secrets im Repository
- Secrets nur über Umgebungsvariablen oder Secret Store
- Rotationsintervall definieren und dokumentieren

## Daten- und Schutzklassen
- Public
- Internal
- Confidential

## Kontroll-Checkliste
- Logging aktiviert
- Zugriff auf Admin-Endpunkte eingeschränkt
- Audit-Events vorhanden
- Backup und Restore getestet

~~~mermaid
flowchart TD
U[User] --> IDP[Identity Provider]
IDP --> APP[Copilot Cockpit]
APP --> POL[RBAC Policy]
POL --> RES[Protected Resources]
~~~
