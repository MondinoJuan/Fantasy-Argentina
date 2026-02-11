import crypt from 'node:crypto';

export class ParticipantSquad {
    constructor(
        public participantId: string,
        public realPlayerId: string,
        public acquisitionDate: Date = new Date(),
        public releaseDate: Date,
        public purchasePrice: number,
        public acquisitionType: string,
        public id: string = crypt.randomUUID()
    ) { }
}
