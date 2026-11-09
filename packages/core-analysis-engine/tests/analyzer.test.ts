import { describe, expect, it } from 'vitest';
import { analyzeRepository } from '../src/domain/analysis/analyzer.js';

describe('Person 2 Final Deliverable: analyzeRepository', () => {
  it('analyzes prompt example repository correctly end-to-end', async () => {
    const repositoryFiles = [
      {
        path: 'auth.js',
        content: `
          export function authenticate(user) {
            return user.isAuthenticated;
          }
        `,
      },
      {
        path: 'users.js',
        content: `
          import { authenticate } from "./auth.js";
          export function getUser(user) {
            return authenticate(user);
          }
        `,
      },
      {
        path: 'orders.js',
        content: `
          import { authenticate } from "./auth.js";
          export function createOrder(user, item) {
            if (!authenticate(user)) throw new Error("Unauthorized");
            return { id: 1, item };
          }
        `,
      },
      {
        path: 'profile.js',
        content: `
          import { getUser } from "./users.js";
          export function getProfile(user) {
            return { user: getUser(user) };
          }
        `,
      },
      {
        path: 'checkout.js',
        content: `
          import { createOrder } from "./orders.js";
          export function checkout(user, cart) {
            return createOrder(user, cart);
          }
        `,
      },
      {
        path: 'unrelated.js',
        content: `
          export const APP_NAME = "Ripple";
        `,
      },
    ];

    const result = await analyzeRepository({
      repositoryFiles,
      changedFiles: ['auth.js'],
    });

    // High level result shape
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(['HIGH', 'CRITICAL', 'MEDIUM']).toContain(result.riskLevel);
    expect(result.changedFiles).toBe(1);
    expect(result.affectedFiles).toBe(4);

    // Dependencies list (importer -> imported)
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'users.js', target: 'auth.js' }),
        expect.objectContaining({ source: 'orders.js', target: 'auth.js' }),
        expect.objectContaining({ source: 'profile.js', target: 'users.js' }),
        expect.objectContaining({ source: 'checkout.js', target: 'orders.js' }),
      ])
    );

    // Structured files list for Person 3
    const authFile = result.files.find((f) => f.path === 'auth.js');
    const usersFile = result.files.find((f) => f.path === 'users.js');
    const ordersFile = result.files.find((f) => f.path === 'orders.js');
    const profileFile = result.files.find((f) => f.path === 'profile.js');
    const checkoutFile = result.files.find((f) => f.path === 'checkout.js');
    const unrelatedFile = result.files.find((f) => f.path === 'unrelated.js');

    expect(authFile?.type).toBe('changed');
    expect(authFile?.status).toBe('changed');
    expect(authFile?.impactDepth).toBe(0);

    expect(usersFile?.type).toBe('affected');
    expect(usersFile?.status).toBe('direct_affected');
    expect(usersFile?.impactDepth).toBe(1);

    expect(ordersFile?.type).toBe('affected');
    expect(ordersFile?.status).toBe('direct_affected');
    expect(ordersFile?.impactDepth).toBe(1);

    expect(profileFile?.type).toBe('affected');
    expect(profileFile?.status).toBe('indirect_affected');
    expect(profileFile?.impactDepth).toBe(2);

    expect(checkoutFile?.type).toBe('affected');
    expect(checkoutFile?.status).toBe('indirect_affected');
    expect(checkoutFile?.impactDepth).toBe(2);

    expect(unrelatedFile?.type).toBe('unaffected');
    expect(unrelatedFile?.status).toBe('unaffected');

    // Explainable reasons
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(
      result.reasons.some(
        (r) =>
          r.toLowerCase().includes('authentication') ||
          r.toLowerCase().includes('dependency') ||
          r.toLowerCase().includes('affected')
      )
    ).toBe(true);
  });

  it('handles TypeScript repository with index resolution and external packages', async () => {
    const repositoryFiles = [
      {
        path: 'src/config/index.ts',
        content: `export const API_URL = "https://api.example.com";`,
      },
      {
        path: 'src/services/user.service.ts',
        content: `
          import axios from "axios"; // external package
          import { API_URL } from "../config"; // index resolution without extension
          export async function fetchUser() {
            return axios.get(API_URL);
          }
        `,
      },
      {
        path: 'src/controllers/user.controller.ts',
        content: `
          import { fetchUser } from "../services/user.service.js"; // TS ESM .js mapping
          export const handle = () => fetchUser();
        `,
      },
    ];

    const result = await analyzeRepository({
      repositoryFiles,
      changedFiles: ['src/config/index.ts'],
    });

    // External 'axios' must NOT be in dependencies or files
    expect(result.dependencies.some((d) => d.target === 'axios')).toBe(false);
    expect(result.files.some((f) => f.path === 'axios')).toBe(false);

    // Resolved dependencies
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'src/services/user.service.ts',
          target: 'src/config/index.ts',
        }),
        expect.objectContaining({
          source: 'src/controllers/user.controller.ts',
          target: 'src/services/user.service.ts',
        }),
      ])
    );

    const controllerFile = result.files.find(
      (f) => f.path === 'src/controllers/user.controller.ts'
    );
    expect(controllerFile?.status).toBe('indirect_affected');
    expect(controllerFile?.impactDepth).toBe(2);
  });

  it('generates warnings for unresolved local imports without failing', async () => {
    const repositoryFiles = [
      {
        path: 'src/index.ts',
        content: `import { missing } from "./does-not-exist";`,
      },
    ];

    const result = await analyzeRepository({
      repositoryFiles,
      changedFiles: ['src/index.ts'],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) => w.includes('Unresolved local import "./does-not-exist"'))
    ).toBe(true);
    // No false edge created
    expect(result.dependencies).toHaveLength(0);
  });

  it('handles deleted files in changed list with warning and retains visibility', async () => {
    const repositoryFiles = [
      {
        path: 'src/existing.ts',
        content: `export const x = 1;`,
      },
    ];

    const result = await analyzeRepository({
      repositoryFiles,
      changedFiles: [
        {
          path: 'src/deleted-file.ts',
          status: 'deleted',
        },
      ],
    });

    expect(result.warnings.some((w) => w.includes('deleted-file.ts'))).toBe(true);
    const deletedFile = result.files.find((f) => f.path === 'src/deleted-file.ts');
    expect(deletedFile).toBeDefined();
    expect(deletedFile?.type).toBe('changed');
    expect(deletedFile?.prStatus).toBe('deleted');
  });

  it('is deterministic across runs on the same input', async () => {
    const repositoryFiles = [
      { path: 'a.js', content: 'export const a = 1;' },
      { path: 'b.js', content: 'import { a } from "./a.js";' },
    ];

    const run1 = await analyzeRepository({ repositoryFiles, changedFiles: ['a.js'] });
    const run2 = await analyzeRepository({ repositoryFiles, changedFiles: ['a.js'] });

    expect(run1.riskScore).toBe(run2.riskScore);
    expect(run1.riskLevel).toBe(run2.riskLevel);
    expect(run1.affectedFiles).toBe(run2.affectedFiles);
    expect(run1.dependencies).toEqual(run2.dependencies);
  });
});
