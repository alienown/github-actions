import { createPrompt as createPromptInternal } from "../src/changelog-generator";

export function createPrompt({
  vars,
}: {
  vars: {
    version: string;
    commitMessages: string;
    currentVersionContent: string | null;
  };
}): string {
  return createPromptInternal(
    vars.version,
    vars.commitMessages,
    vars.currentVersionContent,
  );
}
