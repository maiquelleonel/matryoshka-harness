export type PrimaryStack =
  | "python"
  | "typescript"
  | "go"
  | "rust"
  | "ruby"
  | "php"
  | "unknown";

export type ProjectArchetype =
  | "procedural-cms"
  | "reactive-frontend"
  | "opinionated-framework"
  | "distributed-systems"
  | "generic";

export interface ProjectStack {
  primary: PrimaryStack;
  frameworks: string[];
  testRunner: string | null;
  archetype: ProjectArchetype;
}

export interface DetectResult {
  status: "success" | "error";
  stack: ProjectStack;
  rootPath: string;
  message?: string;
}
