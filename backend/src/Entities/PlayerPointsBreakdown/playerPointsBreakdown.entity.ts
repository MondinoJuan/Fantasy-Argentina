import crypt from 'node:crypto';

export class PlayerPointsBreakdown {
    constructor(
        public participantId: string,
        public matchdayId: string,
        public realPlayerId: string,
        public contributedPoints: number,
        public playerPerformanceId: string,
        public id: string = crypt.randomUUID()
    ) { }
}
