// src/types.ts
// src/types.ts
// export type View = 'dashboard' | 'practice' | 'leaderboard' | 'profile' | 'chat';
export type View =
    | "dashboard"
    | "practice"
    | "documents"
    | "quiz"
    | "profile"
    | "reports"
    | "favorites"
    | "reviewbox"
    | "notes"
    | "tests"
    | "History"
    | "met"
    | "ai_teacher" // legacy alias support
    | "chat"; // legacy alias support


// You can add other shared types here in the future, for example:
// export type UserProfile = { ... };