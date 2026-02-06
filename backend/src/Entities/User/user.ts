import crypt from 'node:crypto';

export class User {
    constructor(
        public username: string, 
        public password: string, 
        public mail: string,
        public id: string = crypt.randomUUID()
    ) { }
}