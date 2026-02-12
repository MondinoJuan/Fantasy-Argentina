import { MikroORM } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

export const orm = await MikroORM.init({
  entities: ['dist/Entities/**/*.entity.js'],
  entitiesTs: ['src/Entities/**/*.entity.ts'],
  dbName: 'fantasy_argentina',
  clientUrl: 'mysql://root:0717@localhost:3306/fantasy_argentina',
  highlighter: new SqlHighlighter(),
  debug: true,
  schemaGenerator: {
    disableForeignKeys: true,
    createForeignKeyConstraints: true,
    ignoreSchema: [],
  },
});

export const syncSchema = async () => {
  await orm.schema.updateSchema();
  /*
  await orm.schema.dropSchema();
  await orm.schema.createSchema();
  */
};
