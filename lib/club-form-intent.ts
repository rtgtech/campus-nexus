export type ClubCreationStep = "details" | "banner";

export function shouldCreateClub(step: ClubCreationStep, submitIntent: string) {
  return step === "banner" && submitIntent === "create-club";
}
