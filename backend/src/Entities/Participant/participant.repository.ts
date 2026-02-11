import { Repository } from '../../shared/repository.js';
import { Participant } from './participant.entity.js';

const participants = [
    new Participant(
    "sample",
    "sample",
    0,
    0,
    0,
    0,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class ParticipantRepository implements Repository<Participant> {

    public findAll(): Participant[] | undefined {
        return participants;
    }

    public findOne(item: { id: string; }): Participant | undefined {
        return participants.find(i => i.id === item.id);
    }

    public add(item: Participant): Participant | undefined {
        participants.push(item);
        return item;
    }

    public update(item: Participant): Participant | undefined {
        const index = participants.findIndex(i => i.id === item.id);
        if (index !== -1) {
            participants[index] = {...participants[index], ...item};
        }
        return participants[index];
    }

    public delete(item: { id: string; }): Participant | undefined {
        const index = participants.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = participants[index];
            participants.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
