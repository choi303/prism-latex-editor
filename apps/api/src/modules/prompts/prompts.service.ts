const promptLibrary: Array<{
  id: string;
  title: string;
  category: string;
  tone: string;
  body: string;
}> = [];

export function listPrompts() {
  return promptLibrary;
}