import { PrimaryKey, Entity, Property, DateTimeType } from '@mikro-orm/core';
import crypt from 'node:crypto';

@Entity()
export class User {
    @PrimaryKey()
    id?: number

    @Property({nullable: false, unique: true})
    username!: string

    @Property()
    password!: string

    @Property({nullable: true, unique: true})
    mail!: string

    @Property({type: DateTimeType})
    registrationDate: Date = new Date()
}