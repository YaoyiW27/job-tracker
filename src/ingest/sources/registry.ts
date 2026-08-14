import { ROLE_KIND } from "../../lib/enums";
import { simplifySource } from "./simplify";
import type { Source } from "./types";

const RAW = "https://raw.githubusercontent.com/SimplifyJobs";
const LISTINGS_PATH = "dev/.github/scripts/listings.json";

/**
 * The active source list. Add a source = add one line here (plus its factory
 * under ./sources). P4 will append Greenhouse/Lever/Ashby feeds the same way.
 */
export const SOURCES: Source[] = [
  simplifySource({
    key: "simplify:new-grad",
    label: "Simplify New-Grad",
    url: `${RAW}/New-Grad-Positions/${LISTINGS_PATH}`,
    roleKind: ROLE_KIND.NEW_GRAD,
  }),
  simplifySource({
    key: "simplify:intern",
    label: "Simplify Summer2027 Internships",
    url: `${RAW}/Summer2027-Internships/${LISTINGS_PATH}`,
    roleKind: ROLE_KIND.INTERN,
  }),
];
