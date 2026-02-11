import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/db/conn.mysql.js';
import { Repository } from '../../shared/repository.js';
import { Negotiation } from './negotiation.entity.js';

type NegotiationRow = RowDataPacket & {
  id_negotiation: number;
  id_tournament: any; id_seller_participant: any; id_buyer_participant: any; id_real_player: any; agreed_amount: any; status: any; creation_date: any; publish_date: any; effective_date: any; reject_date: any; 
};

export class NegotiationRepository implements Repository<Negotiation> {
  private readonly tableName = 'negotiation';

  private mapRowToEntity(row: NegotiationRow): Negotiation {
    return {
      id: String(row.id_negotiation),
      tournamentId: row.id_tournament,
      sellerParticipantId: row.id_seller_participant,
      buyerParticipantId: row.id_buyer_participant,
      realPlayerId: row.id_real_player,
      agreedAmount: row.agreed_amount,
      status: row.status,
      creationDate: row.creation_date ? new Date(row.creation_date) : (null as unknown as Date),
      publicationDate: row.publish_date ? new Date(row.publish_date) : (null as unknown as Date),
      effectiveDate: row.effective_date ? new Date(row.effective_date) : (null as unknown as Date),
      rejectionDate: row.reject_date ? new Date(row.reject_date) : (null as unknown as Date),
    } as Negotiation;
  }

  public async findAll(): Promise<Negotiation[] | undefined> {
    const [rows] = await pool.query<NegotiationRow[]>(`SELECT * FROM ${this.tableName}`);
    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findOne(item: { id: string }): Promise<Negotiation | undefined> {
    const [rows] = await pool.query<NegotiationRow[]>(
      `SELECT * FROM ${this.tableName} WHERE id_negotiation = ? LIMIT 1`,
      [Number.parseInt(item.id, 10)],
    );

    if (rows.length === 0) {
      return undefined;
    }

    return this.mapRowToEntity(rows[0]);
  }

  public async add(item: Negotiation): Promise<Negotiation | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_seller_participant: item.sellerParticipantId,
      id_buyer_participant: item.buyerParticipantId,
      id_real_player: item.realPlayerId,
      agreed_amount: item.agreedAmount,
      status: item.status,
      creation_date: item.creationDate,
      publish_date: item.publicationDate,
      effective_date: item.effectiveDate,
      reject_date: item.rejectionDate,
    };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ${this.tableName} SET ?`,
      [rowData],
    );

    return this.findOne({ id: String(result.insertId) });
  }

  public async update(id: string, item: Negotiation): Promise<Negotiation | undefined> {
    const rowData = {
      id_tournament: item.tournamentId,
      id_seller_participant: item.sellerParticipantId,
      id_buyer_participant: item.buyerParticipantId,
      id_real_player: item.realPlayerId,
      agreed_amount: item.agreedAmount,
      status: item.status,
      creation_date: item.creationDate,
      publish_date: item.publicationDate,
      effective_date: item.effectiveDate,
      reject_date: item.rejectionDate,
    };

    await pool.query(
      `UPDATE ${this.tableName} SET ? WHERE id_negotiation = ?`,
      [rowData, Number.parseInt(id, 10)],
    );

    return this.findOne({ id });
  }

  public async delete(item: { id: string }): Promise<Negotiation | undefined> {
    const record = await this.findOne(item);
    if (!record) {
      return undefined;
    }

    await pool.query(
      `DELETE FROM ${this.tableName} WHERE id_negotiation = ?`,
      [Number.parseInt(item.id, 10)],
    );

    return record;
  }
}
