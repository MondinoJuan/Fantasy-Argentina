import crypt from 'node:crypto';

export class League {
    constructor(
        public name: string,
        public country: string,
        public externalApiId: string,
        public id: string = crypt.randomUUID()
    ) { }
}
