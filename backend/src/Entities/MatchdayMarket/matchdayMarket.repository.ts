import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { toMysqlDateTime } from '../../shared/db/datetime.js';
import { Repository } from '../../shared/repository.js';
import { MatchdayMarket } from './matchdayMarket.entity.js';

type MatchdayMarketRow = RowDataPacket & {
  id_market: number;
  id_tournament: any; id_matchday: any; id_real_player: any; min_price: any; origin: any; id_seller_participant: any; creation_date: any; 
};

export class MatchdayMarketRepository implements Repository<MatchdayMarket> {
  private readonly tableName = 'matchdaymarket';

  private mapRowToEntity(row: MatchdayMarketRow): MatchdayMarket {
    return {
      id: String(row.id_market),
      tournamentId: row.id_tournament,
      matchdayId: row.id_matchday,
      realPlayerId: row.id_real_player,
      minimumPrice: row.min_price,
      origin: row.origin,
      sellerParticipantId: row.id_seller_participant,
      creationDate: row.creation_date ? new Date(row.creation_date) : (null as unknown as Date),
    } as MatchdayMarket;
  }

  public async findAll(): Promise<MatchdayMarket[] | undefined> {
    const [rows] = await pool.query<MatchdayMarketRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<MatchdayMarket | undefined> {
    const [rows] = await pool.query<MatchdayMarketRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_market = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: MatchdayMarket): Promise<MatchdayMarket | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_matchday: item.matchdayId,
      id_real_player: item.realPlayerId,
      min_price: item.minimumPrice,
      origin: item.origin,
      id_seller_participant: item.sellerParticipantId,
      creation_date: toMysqlDateTime(new Date()),
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: MatchdayMarket): Promise<MatchdayMarket | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_matchday: item.matchdayId,
      id_real_player: item.realPlayerId,
      min_price: item.minimumPrice,
      origin: item.origin,
      id_seller_participant: item.sellerParticipantId,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_market = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<MatchdayMarket | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_market = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
