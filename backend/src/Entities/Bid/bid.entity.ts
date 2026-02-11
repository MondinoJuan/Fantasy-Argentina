import crypt from 'node:crypto';

export class Bid {
    constructor(
        public matchdayMarketId: string,
        public participantId: string,
        public offeredAmount: number,
        public status: string,
        public bidDate: Date = new Date(),
        public cancellationDate: Date,
        public id: string = crypt.randomUUID()
    ) { }
}
