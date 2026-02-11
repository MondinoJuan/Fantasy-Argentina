import crypt from 'node:crypto';

export class RealTeam {
    constructor(
        public name: string,
        public leagueId: string,
        public externalApiId: string,
        public id: string = crypt.randomUUID()
    ) { }
}
