import crypt from 'node:crypto';

export class PlayerPerformance {
    constructor(
        public realPlayerId: string,
        public matchdayId: string,
        public pointsObtained: number,
        public played: boolean,
        public updateDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
