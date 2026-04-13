import { MikroORM } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

const defaultDevDbUrl = 'mysql://root:0717@localhost:3306/fantasy_argentina';
//const clientUrl = process.env.DATABASE_URL ?? defaultDevDbUrl;
const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
const enableSqlDebug = (process.env.DB_DEBUG ?? (isProduction ? 'false' : 'true')).toLowerCase() === 'true';
const useSqlHighlighter = !isProduction;
// TODO(deploy): configurar DATABASE_URL en Vercel/host del backend con tu MySQL gestionado.

const clientUrl = isProduction
  ? process.env.DATABASE_URL
  : (process.env.DATABASE_URL ?? defaultDevDbUrl);

if (!clientUrl) {
  throw new Error('DATABASE_URL no está definida');
}

export const orm = await MikroORM.init({
  entities: ['dist/Entities/**/*.entity.js'],
  entitiesTs: ['src/Entities/**/*.entity.ts'],
  clientUrl,
  allowGlobalContext: true,
  highlighter: !isProduction ? new SqlHighlighter() : undefined,
  debug: (process.env.DB_DEBUG ?? 'false').toLowerCase() === 'true',
});

export const syncSchema = async () => {
  await orm.schema.updateSchema();
  /*
  await orm.schema.dropSchema();
  await orm.schema.createSchema();
  */
};
