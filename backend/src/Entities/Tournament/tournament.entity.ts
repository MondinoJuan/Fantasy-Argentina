import crypt from 'node:crypto';

export class Tournament {
    constructor(
        public name: string,
        public leagueId: string,
        public creationDate: Date = new Date(),
        public initialBudget: number,
        public squadSize: number,
        public status: string,
        public clauseEnableDate: Date,
        public id: string = crypt.randomUUID()
    ) { }
}
