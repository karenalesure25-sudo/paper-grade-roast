declare module "bun:test" {
  export const afterEach: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const it: typeof test;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const expect: (value: unknown) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const mock: (<T extends (...args: any[]) => any>(fn: T) => T) & { restore: () => void };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const spyOn: (obj: any, key: string) => { mockImplementation: (fn: (...args: any[]) => any) => void };
}
