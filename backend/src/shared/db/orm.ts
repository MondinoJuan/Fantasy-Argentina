import { MikroORM } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

const defaultDevDbUrl = 'mysql://root:0717@localhost:3306/fantasy_argentina';
const clientUrl = process.env.DATABASE_URL ?? defaultDevDbUrl;
const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
const enableSqlDebug = (process.env.DB_DEBUG ?? (isProduction ? 'false' : 'true')).toLowerCase() === 'true';
const useSqlHighlighter = !isProduction;
// TODO(deploy): configurar DATABASE_URL en Vercel/host del backend con tu MySQL gestionado.

export const orm = await MikroORM.init({
  entities: ['dist/Entities/**/*.entity.js'],
  entitiesTs: ['src/Entities/**/*.entity.ts'],
  dbName: 'fantasy_argentina',
  clientUrl,
  highlighter: useSqlHighlighter ? new SqlHighlighter() : undefined,
  debug: enableSqlDebug,
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
