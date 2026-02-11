import crypt from 'node:crypto';

export class Matchday {
    constructor(
        public leagueId: string,
        public season: string,
        public matchdayNumber: number,
        public startDate: Date,
        public endDate: Date,
        public status: string,
        public id: string = crypt.randomUUID()
    ) { }
}
