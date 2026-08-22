import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { resetExecutionLimitsForTests } from "@/lib/execution-limits";

beforeEach(() => {
  resetExecutionLimitsForTests();
});
