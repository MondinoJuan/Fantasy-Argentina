import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Bid } from './bid.entity.js';

type BidRow = RowDataPacket & {
  id_bid: number;
  id_market: any; id_participant: any; offered_amount: any; status: any; bid_date: any; cancel_date: any; 
};

export class BidRepository implements Repository<Bid> {
  private readonly tableName = 'bid';

  private mapRowToEntity(row: BidRow): Bid {
    return {
      id: String(row.id_bid),
      matchdayMarketId: row.id_market,
      participantId: row.id_participant,
      offeredAmount: row.offered_amount,
      status: row.status,
      bidDate: row.bid_date ? new Date(row.bid_date) : (null as unknown as Date),
      cancellationDate: row.cancel_date ? new Date(row.cancel_date) : (null as unknown as Date),
    } as Bid;
  }

  public async findAll(): Promise<Bid[] | undefined> {
    const [rows] = await pool.query<BidRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Bid | undefined> {
    const [rows] = await pool.query<BidRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_bid = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Bid): Promise<Bid | undefined> {
    const rowData = {
      id_market: item.matchdayMarketId,
      id_participant: item.participantId,
      offered_amount: item.offeredAmount,
      status: item.status,
      bid_date: item.bidDate,
      cancel_date: item.cancellationDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Bid): Promise<Bid | undefined> {
    const rowData = {
      id_market: item.matchdayMarketId,
      id_participant: item.participantId,
      offered_amount: item.offeredAmount,
      status: item.status,
      bid_date: item.bidDate,
      cancel_date: item.cancellationDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_bid = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Bid | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_bid = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
