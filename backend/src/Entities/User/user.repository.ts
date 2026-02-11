import { Repository } from '../../shared/repository.js';
import { User } from './user.entity.js';

const users = [
    new User(
        'john_doe', 
        'password123', 
        'johnDoe@gmail.com',
        new Date("2024-01-01T00:00:00.000Z"),
        '550e8400-e29b-41d4-a716-446655440000' 
    )
]


export class UserRepository implements Repository<User>{

    public findAll(): User[] | undefined {
        return users;
    }

    public findOne(item: { id: string; }): User | undefined {
        return users.find(u => u.id === item.id);
    }

    public add(item: User): User | undefined {
        users.push(item);
        return item;
    }

    public update(item: User): User | undefined {
        const index = users.findIndex(u => u.id === item.id);
        if (index !== -1) {
            users[index] = {...users[index], ...item};
        }
        return users[index];
    }

    public delete(item: { id: string; }): User | undefined {
        const index = users.findIndex(u => u.id === item.id);
        if (index !== -1) {
            const deletedUser = users[index];
            users.splice(index, 1);
            return deletedUser;
        }
        return undefined;
    }
}