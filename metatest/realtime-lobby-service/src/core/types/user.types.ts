export interface AuthenticatedUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    socketId: string;

    firstName: string | null;
    lastName: string | null;

    trophies: number;


}
