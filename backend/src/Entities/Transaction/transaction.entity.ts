import crypt from 'node:crypto';

export class Transaction {
    constructor(
        public originParticipantId: string,
        public destinationParticipantId: string,
        public tournamentId: string,
        public type: string,
        public amount: number,
        public referenceTable: string,
        public referenceId: string,
        public creationDate: Date = new Date(),
        public publicationDate: Date,
        public effectiveDate: Date,
        public id: string = crypt.randomUUID()
    ) { }
}
