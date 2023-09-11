export const log = console.log;

export const stringify = (object: any) => JSON.stringify(object, null, 2);

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
