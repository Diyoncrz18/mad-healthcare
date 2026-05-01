export const createQueryBuilder = (result: { data?: any; error?: any }) => {
  const builder: any = {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
    finally: (handler: any) => Promise.resolve(result).finally(handler),
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    is: jest.fn(() => builder),
    like: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
};