import { getOctokit, context } from "@actions/github";

export type GithubContext = typeof context;

export type OctokitInstance = ReturnType<typeof getOctokit>;
