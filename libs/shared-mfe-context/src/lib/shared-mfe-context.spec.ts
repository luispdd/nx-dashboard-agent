import { sharedMfeContext } from './shared-mfe-context';

describe('sharedMfeContext', () => {
  it('should work', () => {
    expect(sharedMfeContext()).toEqual('shared-mfe-context');
  })
})
