import crypt from 'node:crypto';

export class Participant {
    constructor(
        public userId: string,
        public tournamentId: string,
        public bankBudget: number,
        public reservedMoney: number,
        public availableMoney: number,
        public totalScore: number,
        public joinDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
