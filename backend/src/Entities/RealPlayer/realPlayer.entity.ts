import crypt from 'node:crypto';

export class RealPlayer {
    constructor(
        public externalApiId: string,
        public name: string,
        public position: string,
        public realTeamId: string,
        public marketValue: number,
        public active: boolean,
        public lastUpdate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
