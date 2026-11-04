export { };

declare global {
    namespace Express {
        interface User {
            id: string;
            name: string;
            email: string;
            status: string;
            createdAt: Date;
        }

        interface Request {
            user?: User;
        }
    }
}