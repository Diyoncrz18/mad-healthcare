export const createQueryBuilder = (result: { data?: any; error?: any }) => {
  const builder: any = {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
    finally: (handler: any) => Promise.resolve(result).finally(handler),
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    like: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => Promise.resolve(result)),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
};