import { DateTimeType, PrimaryKey, Property } from '@mikro-orm/core';

export abstract class BaseEntity {
  @PrimaryKey({autoincrement: true})
  id?: number;

  @Property({ type: DateTimeType })
  createdAt: Date = new Date();

  @Property({
    type: DateTimeType,
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
