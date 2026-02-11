import crypt from 'node:crypto';

export class Shielding {
    constructor(
        public playerClauseId: string,
        public participantId: string,
        public investedAmount: number,
        public clauseIncrease: number,
        public shieldingDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
