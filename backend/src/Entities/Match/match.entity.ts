import crypt from 'node:crypto';

export class Match {
    constructor(
        public matchdayId: string,
        public externalApiId: string,
        public homeTeam: string,
        public awayTeam: string,
        public startDateTime: Date,
        public status: string,
        public id: string = crypt.randomUUID()
    ) { }
}
