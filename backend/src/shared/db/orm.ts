import "dotenv/config";
import { MikroORM } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { SquadHistorySubscriber } from '../services/squadHistory.subscriber.js';

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
// TODO(deploy): configurar DATABASE_URL en Vercel/host del backend con tu MySQL gestionado.

const clientUrl = process.env.DATABASE_URL;

if (!clientUrl) {
  throw new Error('DATABASE_URL no está definida');
}

export const orm = await MikroORM.init({
  entities: ['dist/Entities/**/*.entity.js'],
  entitiesTs: ['src/Entities/**/*.entity.ts'],
  subscribers: [new SquadHistorySubscriber()],
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
