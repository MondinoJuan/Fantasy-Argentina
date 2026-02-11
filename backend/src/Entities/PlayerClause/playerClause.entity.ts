import crypt from 'node:crypto';

export class PlayerClause {
    constructor(
        public tournamentId: string,
        public realPlayerId: string,
        public ownerParticipantId: string,
        public baseClause: number,
        public additionalShieldingClause: number,
        public totalClause: number,
        public updateDate: Date = new Date(),
        public id: string = crypt.randomUUID()
    ) { }
}
