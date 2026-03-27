import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkAccordionModule } from '@angular/cdk/accordion';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../servicios/api.service';

interface RivalPlayerRow {
  realPlayerId: number;
  dependantPlayerId: number;
  name: string;
  totalScore: number;
  position: string;
  translatedValue: number;
  clauseValue: number;
}

@Component({
  selector: 'app-rivals-real-player-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkAccordionModule],
  templateUrl: './rivals-real-player-list.component.html',
  styleUrl: './rivals-real-player-list.component.scss',
})
export class RivalsRealPlayerListComponent {
  @Input({ required: true }) participant!: any;
  @Input({ required: true }) participantSquad: any = null;
  @Input({ required: true }) tournamentId!: number;
  @Input({ required: true }) loggedParticipantId!: number;
  @Input({ required: true }) participantById = new Map<number, any>();
  @Input({ required: true }) realPlayerById = new Map<number, any>();
  @Input({ required: true }) dependantByRealPlayerId = new Map<number, any>();
  @Input({ required: true }) playerClauseByDependantId = new Map<number, any>();
  @Input() clauseEnabled = false;
  @Input() highlighted = false;

  @Output() updated = new EventEmitter<void>();

  expanded = false;

  showModal = false;
  selectedPlayer: RivalPlayerRow | null = null;
  operationAmount = 0;
  modalError = '';
  isSubmitting = false;

  constructor(private readonly apiService: ApiService) {}

  get participantId(): number {
    return this.extractId(this.participant) ?? 0;
  }

  get isOwnerLoggedUser(): boolean {
    return this.participantId === this.loggedParticipantId;
  }

  get username(): string {
    return this.participant?.user?.username ?? `Participant #${this.participantId || '?'}`;
  }

  get totalScore(): number {
    return Number(this.participant?.totalScore ?? 0);
  }

  get starters(): RivalPlayerRow[] {
    const ids = this.normalizeIdCollection(this.participantSquad?.startingRealPlayersIds ?? this.participantSquad?.starting_real_players_ids);
    return ids
      .map((realPlayerId: number) => this.buildPlayerRow(realPlayerId))
      .filter((item: RivalPlayerRow | null): item is RivalPlayerRow => !!item)
      .slice(0, 11);
  }

  get substitutes(): RivalPlayerRow[] {
    const ids = this.normalizeIdCollection(this.participantSquad?.substitutesRealPlayersIds ?? this.participantSquad?.substitutes_real_players_ids);
    return ids
      .map((realPlayerId: number) => this.buildPlayerRow(realPlayerId))
      .filter((item: RivalPlayerRow | null): item is RivalPlayerRow => !!item);
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  openPlayerModal(player: RivalPlayerRow): void {
    this.selectedPlayer = player;
    this.modalError = '';
    this.operationAmount = Number(player.translatedValue ?? 0);
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedPlayer = null;
    this.operationAmount = 0;
    this.modalError = '';
    this.isSubmitting = false;
  }

  submitPrimaryAction(): void {
    if (!this.selectedPlayer) return;

    if (this.isOwnerLoggedUser) {
      this.submitShielding();
      return;
    }

    this.submitNegotiationOffer();
  }

  payClause(): void {
    if (!this.selectedPlayer) return;
    if (!this.clauseEnabled) {
      this.modalError = 'La cláusula se habilita 14 días después de crear el torneo.';
      return;
    }

    const buyer = this.participantById.get(this.loggedParticipantId);

    if (!buyer) {
      this.modalError = 'No se pudieron resolver comprador/vendedor.';
      return;
    }

    const clause = this.playerClauseByDependantId.get(this.selectedPlayer.dependantPlayerId);
    const clauseId = this.extractId(clause);

    const amount = Number(this.selectedPlayer.clauseValue ?? 0);
    if (amount <= 0) {
      this.modalError = 'La cláusula no tiene un valor válido.';
      return;
    }

    const buyerAvailable = Number(buyer?.availableMoney ?? 0);

    if (buyerAvailable < amount) {
      this.modalError = 'No tenés dinero suficiente para pagar la cláusula.';
      return;
    }

    this.isSubmitting = true;

    this.transferRealPlayer(this.selectedPlayer.realPlayerId, this.participantId, this.loggedParticipantId).pipe(
      switchMap(() => forkJoin({
        transfer: this.apiService.participantTransferMoney({
          fromParticipantId: this.loggedParticipantId,
          toParticipantId: this.participantId,
          amount,
        }),
        ...(clauseId
          ? {
            clause: this.apiService.patchPlayerClause({
              id: clauseId,
              ownerParticipant: this.loggedParticipantId,
              updateDate: new Date(),
            }),
          }
          : {}),
      })),
    ).subscribe({
      next: () => {
        this.closeModal();
        this.updated.emit();
      },
      error: (error: any) => {
        this.modalError = error?.error?.message ?? 'No se pudo pagar la cláusula.';
        this.isSubmitting = false;
      },
    });
  }

  private submitShielding(): void {
    if (!this.selectedPlayer) return;

    const amount = Number(this.operationAmount);
    const owner = this.participantById.get(this.participantId);
    const ownerAvailable = Number(owner?.availableMoney ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      this.modalError = 'Ingresá un monto válido para blindar.';
      return;
    }

    if (amount > ownerAvailable) {
      this.modalError = 'El monto no puede superar tu dinero disponible.';
      return;
    }

    const dependantId = this.selectedPlayer.dependantPlayerId;
    this.isSubmitting = true;

    const applyShielding$ = this.ensureClause(
      dependantId,
      Number(this.selectedPlayer.translatedValue ?? 0),
      this.participantId,
    ).pipe(
      switchMap((playerClause: any) => {
        const playerClauseId = this.extractId(playerClause);
        return this.apiService.applyShieldingToPlayerClause({
          playerClauseId: playerClauseId!,
          participantId: this.participantId,
          amount,
        });
      }),
    );

    applyShielding$.subscribe({
      next: () => {
        this.closeModal();
        this.updated.emit();
      },
      error: (error: any) => {
        this.modalError = error?.error?.message ?? 'No se pudo aplicar el blindaje.';
        this.isSubmitting = false;
      },
    });
  }

  private ensureClause(dependantPlayerId: number, translatedValue: number, ownerParticipantId: number): Observable<any> {
    const existing = this.playerClauseByDependantId.get(dependantPlayerId);
    if (existing) {
      return of(existing);
    }

    const base = Math.max(0, translatedValue + 3_000_000);
    return this.apiService.postPlayerClause({
      tournament: this.tournamentId,
      dependantPlayer: dependantPlayerId,
      ownerParticipant: ownerParticipantId,
      baseClause: base,
      additionalShieldingClause: 0,
      totalClause: base,
      updateDate: new Date(),
    }).pipe(
      switchMap((response: any) => of(response?.data ?? response)),
    );
  }

  private submitNegotiationOffer(): void {
    if (!this.selectedPlayer) return;

    const buyer = this.participantById.get(this.loggedParticipantId);
    if (!buyer) {
      this.modalError = 'No se pudo identificar tu participant.';
      return;
    }

    const amount = Number(this.operationAmount);
    const translatedValue = Number(this.selectedPlayer.translatedValue ?? 0);

    if (!Number.isFinite(amount) || amount <= translatedValue) {
      this.modalError = `La oferta debe ser mayor a $${translatedValue.toLocaleString('es-AR')}.`;
      return;
    }

    const existingNegotiation = this.findExistingNegotiation(this.selectedPlayer.dependantPlayerId);
    const buyerAvailable = Number(buyer?.availableMoney ?? 0);

    if (amount >= buyerAvailable) {
      this.modalError = 'El monto debe ser menor a tu dinero disponible.';
      return;
    }

    this.isSubmitting = true;

    const request$ = existingNegotiation
      ? this.apiService.patchNegotiation({
          id: this.extractId(existingNegotiation)!,
          agreedAmount: amount,
          status: 'active',
          publicationDate: new Date(),
        })
      : this.apiService.postNegotiation({
          tournament: this.tournamentId,
          sellerParticipant: this.participantId,
          buyerParticipant: this.loggedParticipantId,
          dependantPlayer: this.selectedPlayer.dependantPlayerId,
          agreedAmount: amount,
          status: 'active',
          creationDate: new Date(),
          publicationDate: new Date(),
        });

    request$.subscribe({
      next: () => {
        this.closeModal();
        this.updated.emit();
      },
      error: (error: any) => {
        this.modalError = error?.error?.message ?? 'No se pudo guardar la negociación.';
        this.isSubmitting = false;
      },
    });
  }

  private transferRealPlayer(realPlayerId: number, fromParticipantId: number, toParticipantId: number): Observable<unknown> {
    const sellerSquad = this.findSquadForParticipant(fromParticipantId);
    const buyerSquad = this.findSquadForParticipant(toParticipantId);

    if (!sellerSquad || !buyerSquad) {
      return of(null as unknown);
    }

    const sellerStarting = this.normalizeIdCollection(sellerSquad?.startingRealPlayersIds ?? sellerSquad?.starting_real_players_ids)
      .filter((id) => id !== realPlayerId);
    const sellerSubs = this.normalizeIdCollection(sellerSquad?.substitutesRealPlayersIds ?? sellerSquad?.substitutes_real_players_ids)
      .filter((id) => id !== realPlayerId);

    const buyerSubs = this.normalizeIdCollection(buyerSquad?.substitutesRealPlayersIds ?? buyerSquad?.substitutes_real_players_ids);
    if (!buyerSubs.includes(realPlayerId)) {
      buyerSubs.push(realPlayerId);
    }

    return forkJoin({
      seller: this.apiService.patchParticipantSquad({
        id: this.extractId(sellerSquad)!,
        startingRealPlayersIds: sellerStarting,
        substitutesRealPlayersIds: sellerSubs,
      }),
      buyer: this.apiService.patchParticipantSquad({
        id: this.extractId(buyerSquad)!,
        substitutesRealPlayersIds: buyerSubs,
      }),
    }) as Observable<unknown>;
  }

  private findSquadForParticipant(participantId: number): any {
    if (this.participantId === participantId) {
      return this.participantSquad;
    }

    const squadCandidate = Array.from(this.participantById.values())
      .map((participant) => participant?.participantSquad)
      .find((item) => this.extractId(item?.participant) === participantId || this.extractId(item?.participant) === this.extractId(participantId));

    return squadCandidate ?? null;
  }

  private buildPlayerRow(realPlayerId: number): RivalPlayerRow | null {
    const realPlayer = this.realPlayerById.get(realPlayerId);
    if (!realPlayer) return null;

    const dependant = this.dependantByRealPlayerId.get(realPlayerId);
    const dependantId = this.extractId(dependant) ?? 0;

    const clause = dependantId ? this.playerClauseByDependantId.get(dependantId) : null;
    const translatedValue = Number(realPlayer?.translatedValue ?? 0);
    const totalScore = Number(realPlayer?.totalScore ?? 0);

    return {
      realPlayerId,
      dependantPlayerId: dependantId,
      name: realPlayer?.name ?? `Jugador #${realPlayerId}`,
      totalScore,
      position: String(realPlayer?.position ?? '-'),
      translatedValue,
      clauseValue: Number(clause?.totalClause ?? translatedValue + 3_000_000),
    };
  }

  private findExistingNegotiation(dependantPlayerId: number): any | null {
    const participantNegotiations = this.participant?.relatedNegotiations ?? [];
    return participantNegotiations.find((item: any) =>
      this.extractId(item?.dependantPlayer) === dependantPlayerId
      && this.extractId(item?.buyerParticipant) === this.loggedParticipantId
      && this.extractId(item?.sellerParticipant) === this.participantId
      && String(item?.status ?? 'active') !== 'rejected'
      && String(item?.status ?? 'cancelled') !== 'cancelled'
      && String(item?.status ?? 'accepted') !== 'accepted'
    ) ?? null;
  }

  private normalizeIdCollection(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => Number.parseInt(String(item), 10))
        .filter((item) => Number.isFinite(item) && item > 0);
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => Number.parseInt(String(item), 10))
            .filter((item) => Number.isFinite(item) && item > 0);
        }
      } catch {
        return value
          .split(',')
          .map((item) => Number.parseInt(item.replace(/[\[\]\s]/g, ''), 10))
          .filter((item) => Number.isFinite(item) && item > 0);
      }
    }

    return [];
  }

  private extractId(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record['id'] !== undefined) {
        return this.extractId(record['id']);
      }
    }

    return null;
  }
}
