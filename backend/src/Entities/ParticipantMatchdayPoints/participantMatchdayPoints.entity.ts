import crypt from 'node:crypto';

export class ParticipantMatchdayPoints {
    constructor(
        public participantId: string,
        public matchdayId: string,
        public matchdayPoints: number,
        public accumulatedPoints: number,
        public position: number,
        public calculationDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
