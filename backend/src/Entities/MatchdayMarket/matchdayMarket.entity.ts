import crypt from 'node:crypto';

export class MatchdayMarket {
    constructor(
        public tournamentId: string,
        public matchdayId: string,
        public realPlayerId: string,
        public minimumPrice: number,
        public origin: string,
        public sellerParticipantId: string,
        public creationDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
