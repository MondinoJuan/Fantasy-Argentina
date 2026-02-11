import crypt from 'node:crypto';

export class Negotiation {
    constructor(
        public tournamentId: string,
        public sellerParticipantId: string,
        public buyerParticipantId: string,
        public realPlayerId: string,
        public agreedAmount: number,
        public status: string,
        public creationDate: Date = new Date(),
        public publicationDate: Date,
        public effectiveDate: Date,
        public rejectionDate: Date,
        public id: string = crypt.randomUUID()
    ) { }
}
