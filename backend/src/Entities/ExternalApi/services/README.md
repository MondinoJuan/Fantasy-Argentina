# ExternalApi Services

Esta carpeta está preparada para casos de uso largos de SportsApiPro.

## Convención sugerida
- 1 endpoint/caso de uso por archivo: `nombreDelCaso.service.ts`
- El controller solo valida/parsing y delega al service.
- El service orquesta lógica y usa funciones de `integrations/sportsapipro/sportsapipro.client.ts`.

## Flujo
`route -> controller -> service -> integrations/sportsapipro client`
