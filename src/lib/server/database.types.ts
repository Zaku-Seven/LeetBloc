// Written by hand to match supabase/migrations. Regenerate with
//   supabase gen types typescript --local > src/lib/server/database.types.ts
// once the Supabase CLI is set up.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProblemRow = {
  id: string;
  source: string;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  content_text: string;
  examples: Json;
  python_stub: string;
  is_paid: boolean;
  fetched_at: string;
};

type PuzzleRow = {
  id: string;
  problem_id: string;
  model: string;
  status: string;
  brute: Json | null;
  optimized: Json | null;
  tests: Json | null;
  distractors: Json;
  created_at: string;
};

type AttemptRow = {
  id: string;
  user_id: string | null;
  puzzle_id: string;
  approach: string;
  workspace: Json;
  passed: boolean;
  tests_passed: number;
  tests_total: number;
  created_at: string;
};

type ProgressRow = {
  user_id: string;
  puzzle_id: string;
  brute_solved_at: string | null;
  optimized_solved_at: string | null;
  attempt_count: number;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: { id: string; display_name?: string | null; created_at?: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      problems: {
        Row: ProblemRow;
        Insert: Omit<ProblemRow, "id" | "tags" | "examples" | "is_paid" | "fetched_at"> &
          Partial<Pick<ProblemRow, "id" | "tags" | "examples" | "is_paid" | "fetched_at">>;
        Update: Partial<ProblemRow>;
        Relationships: [];
      };
      puzzles: {
        Row: PuzzleRow;
        Insert: Pick<PuzzleRow, "problem_id" | "model"> & Partial<Omit<PuzzleRow, "problem_id" | "model">>;
        Update: Partial<PuzzleRow>;
        Relationships: [
          {
            foreignKeyName: "puzzles_problem_id_fkey";
            columns: ["problem_id"];
            isOneToOne: false;
            referencedRelation: "problems";
            referencedColumns: ["id"];
          },
        ];
      };
      attempts: {
        Row: AttemptRow;
        Insert: Omit<AttemptRow, "id" | "created_at" | "user_id"> & Partial<Pick<AttemptRow, "id" | "created_at" | "user_id">>;
        Update: Partial<AttemptRow>;
        Relationships: [
          {
            foreignKeyName: "attempts_puzzle_id_fkey";
            columns: ["puzzle_id"];
            isOneToOne: false;
            referencedRelation: "puzzles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      progress: {
        Row: ProgressRow;
        Insert: Pick<ProgressRow, "user_id" | "puzzle_id"> & Partial<ProgressRow>;
        Update: Partial<ProgressRow>;
        Relationships: [
          {
            foreignKeyName: "progress_puzzle_id_fkey";
            columns: ["puzzle_id"];
            isOneToOne: false;
            referencedRelation: "puzzles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      record_attempt: {
        Args: {
          p_user_id: string;
          p_puzzle_id: string;
          p_approach: string;
          p_workspace: Json;
          p_passed: boolean;
          p_tests_passed: number;
          p_tests_total: number;
          p_solves_brute: boolean;
          p_solves_optimized: boolean;
        };
        Returns: ProgressRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
